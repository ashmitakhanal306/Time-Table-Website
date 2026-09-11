export const mockData = {
  "school": {
    "id": 1,
    "name": "Test Academy",
    "subdomain": "testacademy2",
    "timezone": "UTC",
    "working_days": null,
    "terms": null
  },
  "grades": [
    {
      "id": 1,
      "name": "Grade 10",
      "tier": "SENIOR",
      "day_end_time": "14:00"
    }
  ],
  "classes": [
    {
      "id": 1,
      "name": "Grade 10A",
      "grade_id": 1
    }
  ],
  "subjects": [
    {
      "id": 1,
      "name": "Mathematics",
      "code": "MATH",
      "is_activity": false,
      "weekly_frequency_default": 5
    },
    {
      "id": 2,
      "name": "PT",
      "code": "PT",
      "is_activity": true,
      "weekly_frequency_default": 2
    }
  ],
  "teachers": [
    {
      "id": 1,
      "name": "Mr Ravi Kumar",
      "email": "kumar@testacademy.edu",
      "max_periods_per_day": 5,
      "qualified_subject_ids": [
        1
      ]
    }
  ],
  "period_slots": [
    {
      "id": 1,
      "tier": "SENIOR",
      "period_number": 0,
      "start_time": "07:30",
      "end_time": "08:00",
      "is_break": false,
      "slot_type": "ZERO"
    },
    {
      "id": 2,
      "tier": "SENIOR",
      "period_number": 1,
      "start_time": "08:00",
      "end_time": "08:40",
      "is_break": false,
      "slot_type": "REGULAR"
    },
    {
      "id": 3,
      "tier": "SENIOR",
      "period_number": 2,
      "start_time": "08:40",
      "end_time": "09:20",
      "is_break": false,
      "slot_type": "REGULAR"
    },
    {
      "id": 4,
      "tier": "SENIOR",
      "period_number": 3,
      "start_time": "09:20",
      "end_time": "09:35",
      "is_break": true,
      "slot_type": "SHORT_BREAK"
    },
    {
      "id": 5,
      "tier": "SENIOR",
      "period_number": 4,
      "start_time": "09:35",
      "end_time": "10:15",
      "is_break": false,
      "slot_type": "REGULAR"
    },
    {
      "id": 6,
      "tier": "SENIOR",
      "period_number": 5,
      "start_time": "10:15",
      "end_time": "10:55",
      "is_break": false,
      "slot_type": "REGULAR"
    },
    {
      "id": 7,
      "tier": "SENIOR",
      "period_number": 6,
      "start_time": "10:55",
      "end_time": "11:25",
      "is_break": true,
      "slot_type": "LUNCH"
    },
    {
      "id": 8,
      "tier": "SENIOR",
      "period_number": 7,
      "start_time": "11:25",
      "end_time": "12:05",
      "is_break": false,
      "slot_type": "REGULAR"
    },
    {
      "id": 9,
      "tier": "SENIOR",
      "period_number": 0,
      "start_time": "07:30",
      "end_time": "08:00",
      "is_break": false,
      "slot_type": "ZERO"
    },
    {
      "id": 10,
      "tier": "SENIOR",
      "period_number": 1,
      "start_time": "08:00",
      "end_time": "08:40",
      "is_break": false,
      "slot_type": "REGULAR"
    },
    {
      "id": 11,
      "tier": "SENIOR",
      "period_number": 2,
      "start_time": "08:40",
      "end_time": "09:20",
      "is_break": false,
      "slot_type": "REGULAR"
    },
    {
      "id": 12,
      "tier": "SENIOR",
      "period_number": 3,
      "start_time": "09:20",
      "end_time": "09:35",
      "is_break": true,
      "slot_type": "SHORT_BREAK"
    },
    {
      "id": 13,
      "tier": "SENIOR",
      "period_number": 4,
      "start_time": "09:35",
      "end_time": "10:15",
      "is_break": false,
      "slot_type": "REGULAR"
    },
    {
      "id": 14,
      "tier": "SENIOR",
      "period_number": 5,
      "start_time": "10:15",
      "end_time": "10:55",
      "is_break": false,
      "slot_type": "REGULAR"
    },
    {
      "id": 15,
      "tier": "SENIOR",
      "period_number": 6,
      "start_time": "10:55",
      "end_time": "11:25",
      "is_break": true,
      "slot_type": "LUNCH"
    },
    {
      "id": 16,
      "tier": "SENIOR",
      "period_number": 7,
      "start_time": "11:25",
      "end_time": "12:05",
      "is_break": false,
      "slot_type": "REGULAR"
    },
    {
      "id": 17,
      "tier": "SENIOR",
      "period_number": 0,
      "start_time": "07:30",
      "end_time": "08:00",
      "is_break": false,
      "slot_type": "ZERO"
    },
    {
      "id": 18,
      "tier": "SENIOR",
      "period_number": 1,
      "start_time": "08:00",
      "end_time": "08:40",
      "is_break": false,
      "slot_type": "REGULAR"
    },
    {
      "id": 19,
      "tier": "SENIOR",
      "period_number": 2,
      "start_time": "08:40",
      "end_time": "09:20",
      "is_break": false,
      "slot_type": "REGULAR"
    },
    {
      "id": 20,
      "tier": "SENIOR",
      "period_number": 3,
      "start_time": "09:20",
      "end_time": "09:35",
      "is_break": true,
      "slot_type": "SHORT_BREAK"
    },
    {
      "id": 21,
      "tier": "SENIOR",
      "period_number": 4,
      "start_time": "09:35",
      "end_time": "10:15",
      "is_break": false,
      "slot_type": "REGULAR"
    },
    {
      "id": 22,
      "tier": "SENIOR",
      "period_number": 5,
      "start_time": "10:15",
      "end_time": "10:55",
      "is_break": false,
      "slot_type": "REGULAR"
    },
    {
      "id": 23,
      "tier": "SENIOR",
      "period_number": 6,
      "start_time": "10:55",
      "end_time": "11:25",
      "is_break": true,
      "slot_type": "LUNCH"
    },
    {
      "id": 24,
      "tier": "SENIOR",
      "period_number": 7,
      "start_time": "11:25",
      "end_time": "12:05",
      "is_break": false,
      "slot_type": "REGULAR"
    },
    {
      "id": 25,
      "tier": "SENIOR",
      "period_number": 0,
      "start_time": "07:30",
      "end_time": "08:00",
      "is_break": false,
      "slot_type": "ZERO"
    },
    {
      "id": 26,
      "tier": "SENIOR",
      "period_number": 1,
      "start_time": "08:00",
      "end_time": "08:40",
      "is_break": false,
      "slot_type": "REGULAR"
    },
    {
      "id": 27,
      "tier": "SENIOR",
      "period_number": 2,
      "start_time": "08:40",
      "end_time": "09:20",
      "is_break": false,
      "slot_type": "REGULAR"
    },
    {
      "id": 28,
      "tier": "SENIOR",
      "period_number": 3,
      "start_time": "09:20",
      "end_time": "09:35",
      "is_break": true,
      "slot_type": "SHORT_BREAK"
    },
    {
      "id": 29,
      "tier": "SENIOR",
      "period_number": 4,
      "start_time": "09:35",
      "end_time": "10:15",
      "is_break": false,
      "slot_type": "REGULAR"
    },
    {
      "id": 30,
      "tier": "SENIOR",
      "period_number": 5,
      "start_time": "10:15",
      "end_time": "10:55",
      "is_break": false,
      "slot_type": "REGULAR"
    },
    {
      "id": 31,
      "tier": "SENIOR",
      "period_number": 6,
      "start_time": "10:55",
      "end_time": "11:25",
      "is_break": true,
      "slot_type": "LUNCH"
    },
    {
      "id": 32,
      "tier": "SENIOR",
      "period_number": 7,
      "start_time": "11:25",
      "end_time": "12:05",
      "is_break": false,
      "slot_type": "REGULAR"
    },
    {
      "id": 33,
      "tier": "SENIOR",
      "period_number": 0,
      "start_time": "07:30",
      "end_time": "08:00",
      "is_break": false,
      "slot_type": "ZERO"
    },
    {
      "id": 34,
      "tier": "SENIOR",
      "period_number": 1,
      "start_time": "08:00",
      "end_time": "08:40",
      "is_break": false,
      "slot_type": "REGULAR"
    },
    {
      "id": 35,
      "tier": "SENIOR",
      "period_number": 2,
      "start_time": "08:40",
      "end_time": "09:20",
      "is_break": false,
      "slot_type": "REGULAR"
    },
    {
      "id": 36,
      "tier": "SENIOR",
      "period_number": 3,
      "start_time": "09:20",
      "end_time": "09:35",
      "is_break": true,
      "slot_type": "SHORT_BREAK"
    },
    {
      "id": 37,
      "tier": "SENIOR",
      "period_number": 4,
      "start_time": "09:35",
      "end_time": "10:15",
      "is_break": false,
      "slot_type": "REGULAR"
    },
    {
      "id": 38,
      "tier": "SENIOR",
      "period_number": 5,
      "start_time": "10:15",
      "end_time": "10:55",
      "is_break": false,
      "slot_type": "REGULAR"
    },
    {
      "id": 39,
      "tier": "SENIOR",
      "period_number": 6,
      "start_time": "10:55",
      "end_time": "11:25",
      "is_break": true,
      "slot_type": "LUNCH"
    },
    {
      "id": 40,
      "tier": "SENIOR",
      "period_number": 7,
      "start_time": "11:25",
      "end_time": "12:05",
      "is_break": false,
      "slot_type": "REGULAR"
    }
  ],
  "requirements": [
    {
      "id": 1,
      "class_section_id": 1,
      "subject_id": 1,
      "weekly_frequency": 5
    }
  ],
  "entries": [
    {
      "id": 1,
      "school_id": 1,
      "day_of_week": 1,
      "period_number": 7,
      "class_section_id": 1,
      "subject_id": 1,
      "teacher_id": 1,
      "room_name": "Room 1",
      "is_manual_override": false,
      "is_published": false
    },
    {
      "id": 2,
      "school_id": 1,
      "day_of_week": 2,
      "period_number": 4,
      "class_section_id": 1,
      "subject_id": 1,
      "teacher_id": 1,
      "room_name": "Room 1",
      "is_manual_override": false,
      "is_published": false
    },
    {
      "id": 3,
      "school_id": 1,
      "day_of_week": 3,
      "period_number": 7,
      "class_section_id": 1,
      "subject_id": 1,
      "teacher_id": 1,
      "room_name": "Room 1",
      "is_manual_override": false,
      "is_published": false
    },
    {
      "id": 4,
      "school_id": 1,
      "day_of_week": 4,
      "period_number": 7,
      "class_section_id": 1,
      "subject_id": 1,
      "teacher_id": 1,
      "room_name": "Room 1",
      "is_manual_override": false,
      "is_published": false
    },
    {
      "id": 5,
      "school_id": 1,
      "day_of_week": 5,
      "period_number": 7,
      "class_section_id": 1,
      "subject_id": 1,
      "teacher_id": 1,
      "room_name": "Room 1",
      "is_manual_override": false,
      "is_published": false
    }
  ]
};
