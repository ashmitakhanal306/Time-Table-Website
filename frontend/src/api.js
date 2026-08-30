// src/api.js
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
    let detail = 'An error occurred';
    try {
      const data = await res.json();
      detail = data.detail || detail;
    } catch (e) {
      // Not JSON
    }
    throw new Error(detail);
  }
  return res.json();
};

export const api = {
  login: async (email, password) => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: getHeaders(null),
      body: JSON.stringify({ email, password }),
    });
    return handleResponse(res);
  },
  
  listSchools: async () => {
    const res = await fetch('/api/schools');
    return handleResponse(res);
  },
  
  createSchool: async (schoolData) => {
    const res = await fetch('/api/schools', {
      method: 'POST',
      headers: getHeaders(null),
      body: JSON.stringify(schoolData),
    });
    return handleResponse(res);
  },

  createConfigEntity: async (schoolId, entityType, data, token) => {
    const res = await fetch(`/api/schools/${schoolId}/${entityType}`, {
      method: 'POST',
      headers: getHeaders(token),
      body: JSON.stringify(data),
    });
    return handleResponse(res);
  },

  updateConfigEntity: async (schoolId, entityType, id, data, token) => {
    const res = await fetch(`/api/schools/${schoolId}/${entityType}/${id}`, {
      method: 'PUT',
      headers: getHeaders(token),
      body: JSON.stringify(data),
    });
    return handleResponse(res);
  },

  deleteConfigEntity: async (schoolId, entityType, id, token) => {
    const res = await fetch(`/api/schools/${schoolId}/${entityType}/${id}`, {
      method: 'DELETE',
      headers: getHeaders(token),
    });
    return handleResponse(res);
  },

  updatePeriodStructure: async (schoolId, data, token) => {
    const res = await fetch(`/api/schools/${schoolId}/period-structure`, {
      method: 'POST',
      headers: getHeaders(token),
      body: JSON.stringify(data),
    });
    return handleResponse(res);
  },
  
  getConfig: async (schoolId, token) => {
    const res = await fetch(`/api/schools/${schoolId}/config`, {
      headers: getHeaders(token),
    });
    return handleResponse(res);
  },
  
  generateTimetable: async (schoolId, token) => {
    const res = await fetch(`/api/schools/${schoolId}/timetable/generate`, {
      method: 'POST',
      headers: getHeaders(token),
    });
    return handleResponse(res);
  },
  
  getEntries: async (schoolId, classId, teacherId, token) => {
    const params = new URLSearchParams();
    if (classId) params.append('class_id', classId);
    if (teacherId) params.append('teacher_id', teacherId);
    
    const qs = params.toString();
    const url = `/api/schools/${schoolId}/timetable/entries` + (qs ? `?${qs}` : '');
    
    const res = await fetch(url, {
      headers: getHeaders(token),
    });
    return handleResponse(res);
  },
  
  overrideEntry: async (schoolId, entryId, overrideData, token) => {
    const res = await fetch(`/api/schools/${schoolId}/timetable/entries/${entryId}`, {
      method: 'PATCH',
      headers: getHeaders(token),
      body: JSON.stringify(overrideData),
    });
    return handleResponse(res);
  },
  
  publishTimetable: async (schoolId, publish, token) => {
    const res = await fetch(`/api/schools/${schoolId}/timetable/publish?publish=${publish}`, {
      method: 'POST',
      headers: getHeaders(token),
    });
    return handleResponse(res);
  },
  
  recommendSubstitutes: async (schoolId, teacherId, date, period, token) => {
    const params = new URLSearchParams({ teacher_id: teacherId, date, period });
    const res = await fetch(`/api/schools/${schoolId}/substitutions/recommend?${params.toString()}`, {
      headers: getHeaders(token),
    });
    return handleResponse(res);
  },
  
  assignSubstitute: async (schoolId, assignmentData, token) => {
    const res = await fetch(`/api/schools/${schoolId}/substitutions/assign`, {
      method: 'POST',
      headers: getHeaders(token),
      body: JSON.stringify(assignmentData),
    });
    return handleResponse(res);
  },
  
  downloadExport: async (schoolId, kind, token) => {
    const res = await fetch(`/api/schools/${schoolId}/export/${kind}`, {
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
