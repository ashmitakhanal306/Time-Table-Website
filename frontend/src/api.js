// src/api.js
import { mockData } from './mockData.js';

const API_BASE = (import.meta.env.VITE_API_URL || '').replace(/\/+$/, '');
const apiUrl = (path) => `${API_BASE}${path}`;

let isDemoMode = false;
let demoState = JSON.parse(JSON.stringify(mockData));

export const getIsDemoMode = () => isDemoMode;

const getHeaders = (token, isJson = true) => {
  const headers = {};
  if (isJson) {
    headers['Content-Type'] = 'application/json';
  }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
};

const handleResponse = async (res) => {
  if (!res.ok) {
    let detail = `Server returned status ${res.status}`;
    try {
      const data = await res.json();
      detail = data.detail || detail;
    } catch (e) {
      if (res.status === 405 || res.status === 404) {
        detail = 'Backend API endpoint not available.';
      }
    }
    throw new Error(detail);
  }
  return res.json();
};

export const api = {
  login: async (email, password) => {
    try {
      const res = await fetch(apiUrl('/api/auth/login'), {
        method: 'POST',
        headers: getHeaders(null),
        body: JSON.stringify({ email, password }),
      });
      return await handleResponse(res);
    } catch (err) {
      console.warn("Backend unavailable, activating Demo Mode fallback:", err.message);
      isDemoMode = true;
      const payload = btoa(JSON.stringify({
        sub: "1",
        role: "ADMIN",
        school_id: 1,
        exp: Math.floor(Date.now() / 1000) + 86400
      }));
      return {
        access_token: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.${payload}.demo_signature`,
        token_type: "bearer",
        user: {
          id: 1,
          email: email || "admin@springdale.edu",
          role: "ADMIN",
          school_id: 1
        }
      };
    }
  },
  
  listSchools: async () => {
    if (isDemoMode) return [demoState.school];
    try {
      const res = await fetch(apiUrl('/api/schools'));
      return await handleResponse(res);
    } catch {
      isDemoMode = true;
      return [demoState.school];
    }
  },
  
  createSchool: async (schoolData) => {
    if (isDemoMode) {
      demoState.school = {
        id: Date.now(),
        name: schoolData.name,
        subdomain: schoolData.subdomain,
        timezone: "Asia/Kolkata",
        working_days: [1, 2, 3, 4, 5],
        terms: ["Term 1"]
      };
      return demoState.school;
    }
    const res = await fetch(apiUrl('/api/schools'), {
      method: 'POST',
      headers: getHeaders(null),
      body: JSON.stringify(schoolData),
    });
    return handleResponse(res);
  },

  getSchool: async (schoolId, token) => {
    if (isDemoMode) return demoState.school;
    try {
      const res = await fetch(apiUrl(`/api/schools/${schoolId}`), {
        headers: getHeaders(token),
      });
      return await handleResponse(res);
    } catch {
      return demoState.school;
    }
  },

  updateSchool: async (schoolId, data, token) => {
    if (isDemoMode) {
      Object.assign(demoState.school, data);
      return demoState.school;
    }
    const res = await fetch(apiUrl(`/api/schools/${schoolId}`), {
      method: 'PUT',
      headers: getHeaders(token),
      body: JSON.stringify(data),
    });
    return handleResponse(res);
  },

  createConfigEntity: async (schoolId, entityType, data, token) => {
    if (isDemoMode) {
      const key = entityType === 'requirements' ? 'requirements' : entityType;
      const list = demoState[key] || [];
      const item = { id: Date.now(), school_id: schoolId, ...data };
      list.push(item);
      demoState[key] = list;
      return item;
    }
    const res = await fetch(apiUrl(`/api/schools/${schoolId}/${entityType}`), {
      method: 'POST',
      headers: getHeaders(token),
      body: JSON.stringify(data),
    });
    return handleResponse(res);
  },

  updateConfigEntity: async (schoolId, entityType, id, data, token) => {
    if (isDemoMode) {
      const key = entityType === 'requirements' ? 'requirements' : entityType;
      const list = demoState[key] || [];
      const idx = list.findIndex(item => item.id === id);
      if (idx !== -1) {
        Object.assign(list[idx], data);
        return list[idx];
      }
      return data;
    }
    const res = await fetch(apiUrl(`/api/schools/${schoolId}/${entityType}/${id}`), {
      method: 'PUT',
      headers: getHeaders(token),
      body: JSON.stringify(data),
    });
    return handleResponse(res);
  },

  deleteConfigEntity: async (schoolId, entityType, id, token) => {
    if (isDemoMode) {
      const key = entityType === 'requirements' ? 'requirements' : entityType;
      demoState[key] = (demoState[key] || []).filter(item => item.id !== id);
      return { status: "deleted" };
    }
    const res = await fetch(apiUrl(`/api/schools/${schoolId}/${entityType}/${id}`), {
      method: 'DELETE',
      headers: getHeaders(token),
    });
    return handleResponse(res);
  },

  updatePeriodStructure: async (schoolId, data, token) => {
    if (isDemoMode) {
      return { status: "success", slots_created: data.slots ? data.slots.length : 0 };
    }
    const res = await fetch(apiUrl(`/api/schools/${schoolId}/period-structure`), {
      method: 'POST',
      headers: getHeaders(token),
      body: JSON.stringify(data),
    });
    return handleResponse(res);
  },
  
  getConfig: async (schoolId, token) => {
    if (isDemoMode) {
      return {
        grades: demoState.grades,
        classes: demoState.classes,
        subjects: demoState.subjects,
        teachers: demoState.teachers,
        requirements: demoState.requirements,
        period_slots: demoState.period_slots,
        activity_blocks: demoState.activity_blocks || []
      };
    }
    try {
      const res = await fetch(apiUrl(`/api/schools/${schoolId}/config`), {
        headers: getHeaders(token),
      });
      return await handleResponse(res);
    } catch {
      return {
        grades: demoState.grades,
        classes: demoState.classes,
        subjects: demoState.subjects,
        teachers: demoState.teachers,
        requirements: demoState.requirements,
        period_slots: demoState.period_slots,
        activity_blocks: demoState.activity_blocks || []
      };
    }
  },
  
  generateTimetable: async (schoolId, token) => {
    if (isDemoMode) {
      return { status: "OPTIMAL", entry_count: demoState.entries.length };
    }
    const res = await fetch(apiUrl(`/api/schools/${schoolId}/timetable/generate`), {
      method: 'POST',
      headers: getHeaders(token),
    });
    return handleResponse(res);
  },
  
  getEntries: async (schoolId, classId, teacherId, token) => {
    if (isDemoMode) {
      let filtered = demoState.entries;
      if (classId) {
        filtered = filtered.filter(e => e.class_section_id === parseInt(classId));
      }
      if (teacherId) {
        filtered = filtered.filter(e => e.teacher_id === parseInt(teacherId));
      }
      return filtered;
    }
    try {
      const params = new URLSearchParams();
      if (classId) params.append('class_id', classId);
      if (teacherId) params.append('teacher_id', teacherId);
      
      const qs = params.toString();
      const url = apiUrl(`/api/schools/${schoolId}/timetable/entries` + (qs ? `?${qs}` : ''));
      
      const res = await fetch(url, {
        headers: getHeaders(token),
      });
      return await handleResponse(res);
    } catch {
      return demoState.entries;
    }
  },

  getEffectiveTimetable: async (schoolId, date, classId = null, teacherId = null, token = null) => {
    if (isDemoMode) {
      let dayOfWeek = 1;
      if (date) {
        const dt = new Date(date + 'T00:00:00');
        dayOfWeek = dt.getDay() === 0 ? 7 : dt.getDay();
      }
      let dayEntries = demoState.entries.filter(e => e.day_of_week === dayOfWeek);
      if (classId) {
        dayEntries = dayEntries.filter(e => e.class_section_id === parseInt(classId));
      }
      const absences = (demoState.absences || []).filter(a => a.date === date && a.substitute_teacher_id);
      const absMap = {};
      absences.forEach(a => {
        absMap[`${a.teacher_id}-${a.period_number}`] = a;
      });

      let effective = dayEntries.map(e => {
        const copy = { ...e, is_substituted: false, original_teacher_id: null };
        const key = `${e.teacher_id}-${e.period_number}`;
        if (absMap[key]) {
          copy.original_teacher_id = e.teacher_id;
          copy.teacher_id = absMap[key].substitute_teacher_id;
          copy.is_substituted = true;
        }
        return copy;
      });

      if (teacherId) {
        effective = effective.filter(e => e.teacher_id === parseInt(teacherId));
      }
      return effective;
    }
    const params = new URLSearchParams({ date });
    if (classId) params.append('class_id', classId);
    if (teacherId) params.append('teacher_id', teacherId);

    const url = apiUrl(`/api/schools/${schoolId}/timetable/effective?${params.toString()}`);
    const res = await fetch(url, {
      headers: getHeaders(token),
    });
    return await handleResponse(res);
  },
  
  overrideEntry: async (schoolId, entryId, overrideData, token) => {
    if (isDemoMode) {
      const entry = demoState.entries.find(e => e.id === entryId);
      if (entry) Object.assign(entry, overrideData, { is_manual_override: true });
      return entry || overrideData;
    }
    const res = await fetch(apiUrl(`/api/schools/${schoolId}/timetable/entries/${entryId}`), {
      method: 'PATCH',
      headers: getHeaders(token),
      body: JSON.stringify(overrideData),
    });
    return handleResponse(res);
  },
  
  publishTimetable: async (schoolId, publish, token) => {
    if (isDemoMode) {
      demoState.entries.forEach(e => e.is_published = publish);
      return { status: "success", published: publish };
    }
    const res = await fetch(apiUrl(`/api/schools/${schoolId}/timetable/publish?publish=${publish}`), {
      method: 'POST',
      headers: getHeaders(token),
    });
    return handleResponse(res);
  },
  
  recommendSubstitutes: async (schoolId, teacherId, date, period, token) => {
    if (isDemoMode) {
      return demoState.teachers.slice(0, 3).map(t => ({
        teacher_id: t.id,
        teacher_name: t.name,
        free_periods_today: 3,
        total_periods_this_week: 15,
        qualified: true,
        reason: "Free during this period"
      }));
    }
    const params = new URLSearchParams({ teacher_id: teacherId, date, period });
    const res = await fetch(apiUrl(`/api/schools/${schoolId}/substitutions/recommend?${params.toString()}`), {
      headers: getHeaders(token),
    });
    const data = await handleResponse(res);
    return Array.isArray(data) ? data : (data.recommendations || []);
  },
  
  assignSubstitute: async (schoolId, assignmentData, token) => {
    if (isDemoMode) {
      demoState.absences = demoState.absences || [];
      demoState.absences.push({
        id: Date.now(),
        school_id: schoolId,
        ...assignmentData
      });
      return { status: "assigned", ...assignmentData };
    }
    const res = await fetch(apiUrl(`/api/schools/${schoolId}/substitutions/assign`), {
      method: 'POST',
      headers: getHeaders(token),
      body: JSON.stringify(assignmentData),
    });
    return handleResponse(res);
  },
  
  downloadExport: async (schoolId, kind, token) => {
    if (isDemoMode) {
      const content = `Timetable Export (${kind.toUpperCase()})\nGenerated in Demo Preview Mode\nSchool: Springdale Academy\nEntries: ${demoState.entries.length}`;
      const blob = new Blob([content], { type: kind === 'excel' ? 'text/csv' : 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = kind === 'excel' ? 'timetable.csv' : 'timetable.txt';
      a.click();
      URL.revokeObjectURL(url);
      return;
    }
    const res = await fetch(apiUrl(`/api/schools/${schoolId}/export/${kind}`), {
      headers: getHeaders(token, false),
    });
    if (!res.ok) {
      let detail = 'An error occurred during export';
      try {
        const data = await res.json();
        detail = data.detail || detail;
      } catch (e) {}
      throw new Error(detail);
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = kind === 'excel' ? 'timetable.xlsx' : 'timetable.pdf';
    a.click();
    URL.revokeObjectURL(url);
  }
};
