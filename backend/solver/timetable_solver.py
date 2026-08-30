from ortools.sat.python import cp_model
from backend.models import (
    School, GradeLevel, ClassSection, Subject, ClassSubjectRequirement,
    Teacher, PeriodSlot, ActivityBlock
)
from collections import defaultdict

WEIGHT_SAME_DAY_REPEAT = 5
WEIGHT_SPECIALIST_IMBALANCE = 1

def generate_timetable(db, school_id, time_limit_seconds=30):
    classes = db.query(ClassSection).filter_by(school_id=school_id).all()
    grade_levels = {g.id: g for g in db.query(GradeLevel).filter_by(school_id=school_id).all()}
    subjects = {s.id: s for s in db.query(Subject).filter_by(school_id=school_id).all()}
    reqs = db.query(ClassSubjectRequirement).filter_by(school_id=school_id).all()
    teachers = db.query(Teacher).filter_by(school_id=school_id).all()
    slots = db.query(PeriodSlot).filter_by(school_id=school_id, is_break=False).all()
    activity_blocks = db.query(ActivityBlock).filter_by(school_id=school_id).all()
    
    # Pre-checks: Demand vs Supply
    demand_by_subject = defaultdict(int)
    for r in reqs:
        demand_by_subject[r.subject_id] += r.weekly_frequency
        
    supply_by_subject = defaultdict(int)
    for t in teachers:
        if t.qualified_subject_ids:
            for s_id in t.qualified_subject_ids:
                supply_by_subject[s_id] += t.max_periods_per_day * 5
                
    for s_id, demand in demand_by_subject.items():
        supply = supply_by_subject[s_id]
        if demand > supply:
            s_name = subjects[s_id].name
            return {
                "status": "INFEASIBLE",
                "entries": [],
                "infeasibility_reason": f"Subject '{s_name}': weekly demand ({demand}) exceeds the combined capacity of its qualified teacher(s) ({supply})."
            }
            
    model = cp_model.CpModel()
    
    blocks_by_tier = defaultdict(list)
    for ab in activity_blocks:
        blocks_by_tier[ab.grade_tier].append(ab)
        
    valid_slots = defaultdict(lambda: defaultdict(set))
    for slot in slots:
        if slot.slot_type == "REGULAR":
            valid_slots[slot.tier][slot.day_of_week].add(slot.period_number)
            
    allowed_subjects = defaultdict(lambda: defaultdict(dict))
    activity_subject_ids_per_tier = defaultdict(set)
    
    for tier, blocks in blocks_by_tier.items():
        for ab in blocks:
            for act_code in ab.activity_types:
                for s in subjects.values():
                    if s.code == act_code:
                        activity_subject_ids_per_tier[tier].add(s.id)
                        
    for tier, days in valid_slots.items():
        for d, periods in days.items():
            for p in periods:
                in_block = False
                for ab in blocks_by_tier[tier]:
                    if ab.day_of_week == d and ab.start_period <= p <= ab.end_period:
                        allowed_sub_ids = []
                        for code in ab.activity_types:
                            for s in subjects.values():
                                if s.code == code:
                                    allowed_sub_ids.append(s.id)
                        allowed_subjects[tier][d][p] = set(allowed_sub_ids)
                        in_block = True
                        break
                if not in_block:
                    allowed_subjects[tier][d][p] = None
                    
    qualified_teachers = defaultdict(list)
    for t in teachers:
        for s_id in (t.qualified_subject_ids or []):
            qualified_teachers[s_id].append(t)
            
    X = {}
    class_reqs = defaultdict(list)
    for r in reqs:
        class_reqs[r.class_section_id].append(r)
        
    num_vars = 0
    for c in classes:
        tier = grade_levels[c.grade_id].tier
        for r in class_reqs[c.id]:
            s_id = r.subject_id
            for d, periods in valid_slots[tier].items():
                for p in periods:
                    allowed = allowed_subjects[tier][d][p]
                    can_schedule = False
                    if allowed is not None:
                        if s_id in allowed:
                            can_schedule = True
                    else:
                        if s_id not in activity_subject_ids_per_tier[tier]:
                            can_schedule = True
                            
                    if can_schedule:
                        for t in qualified_teachers[s_id]:
                            v = model.NewBoolVar(f"X_c{c.id}_s{s_id}_t{t.id}_d{d}_p{p}")
                            X[(c.id, s_id, t.id, d, p)] = v
                            num_vars += 1
                            
    for c in classes:
        tier = grade_levels[c.grade_id].tier
        for d, periods in valid_slots[tier].items():
            for p in periods:
                vars_for_cdp = [v for k, v in X.items() if k[0] == c.id and k[3] == d and k[4] == p]
                if vars_for_cdp:
                    model.AddAtMostOne(vars_for_cdp)
                    
    all_d_p = set((k[3], k[4]) for k in X.keys())
    for t in teachers:
        for d, p in all_d_p:
            vars_for_tdp = [v for k, v in X.items() if k[2] == t.id and k[3] == d and k[4] == p]
            if vars_for_tdp:
                model.AddAtMostOne(vars_for_tdp)
                
    for c in classes:
        for r in class_reqs[c.id]:
            vars_for_cs = [v for k, v in X.items() if k[0] == c.id and k[1] == r.subject_id]
            model.Add(sum(vars_for_cs) == r.weekly_frequency)
            
    all_d = set(k[3] for k in X.keys())
    for t in teachers:
        for d in all_d:
            vars_for_td = [v for k, v in X.items() if k[2] == t.id and k[3] == d]
            if vars_for_td:
                model.Add(sum(vars_for_td) <= t.max_periods_per_day)

    obj_vars = []
    for c in classes:
        for r in class_reqs[c.id]:
            for d in all_d:
                vars_for_csd = [v for k, v in X.items() if k[0] == c.id and k[1] == r.subject_id and k[3] == d]
                if vars_for_csd:
                    over = model.NewIntVar(0, len(vars_for_csd), f"over_c{c.id}_s{r.subject_id}_d{d}")
                    model.Add(over >= sum(vars_for_csd) - 1)
                    obj_vars.append(WEIGHT_SAME_DAY_REPEAT * over)
                    
    activity_subject_ids = set(s.id for s in subjects.values() if s.is_activity)
    specialist_teachers = [t for t in teachers if t.qualified_subject_ids and any(s_id in activity_subject_ids for s_id in t.qualified_subject_ids)]
            
    if len(specialist_teachers) > 1:
        specialist_loads = []
        for t in specialist_teachers:
            vars_for_t = [v for k, v in X.items() if k[2] == t.id]
            load_var = model.NewIntVar(0, 100, f"load_t{t.id}")
            model.Add(load_var == sum(vars_for_t))
            specialist_loads.append(load_var)
            
        max_load = model.NewIntVar(0, 100, "max_specialist_load")
        min_load = model.NewIntVar(0, 100, "min_specialist_load")
        model.AddMaxEquality(max_load, specialist_loads)
        model.AddMinEquality(min_load, specialist_loads)
        obj_vars.append(WEIGHT_SPECIALIST_IMBALANCE * (max_load - min_load))
        
    model.Minimize(sum(obj_vars))
    
    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = time_limit_seconds
    solver.parameters.num_search_workers = 8
    
    print(f"[Solver] Num variables: {num_vars}, Num constraints: {len(model.Proto().constraints)}")
    
    status = solver.Solve(model)
    
    if status == cp_model.OPTIMAL:
        status_str = "OPTIMAL"
    elif status == cp_model.FEASIBLE:
        status_str = "FEASIBLE"
    elif status == cp_model.INFEASIBLE:
        status_str = "INFEASIBLE"
    elif status == cp_model.UNKNOWN:
        status_str = "TIMEOUT"
    else:
        status_str = "UNKNOWN"
        
    if status_str in ("OPTIMAL", "FEASIBLE"):
        entries = []
        for k, v in X.items():
            if solver.Value(v):
                entries.append({
                    "class_section_id": k[0],
                    "subject_id": k[1],
                    "teacher_id": k[2],
                    "day_of_week": k[3],
                    "period_number": k[4],
                    "room_name": f"Room {k[0]}"
                })
        return {
            "status": status_str,
            "entries": entries,
            "infeasibility_reason": None
        }
    else:
        return {
            "status": status_str,
            "entries": [],
            "infeasibility_reason": "The solver could not find a valid schedule." if status_str == "INFEASIBLE" else "Timeout reached."
        }
