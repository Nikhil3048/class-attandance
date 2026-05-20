/**
 * api.js — Centralised API client for AttendanceIQ
 * Handles all HTTP calls to the backend with auth headers
 */

const API_BASE = '/api';

const ApiClient = (() => {
  const getToken = () => localStorage.getItem('att_token');

  const headers = () => ({
    'Content-Type': 'application/json',
    ...(getToken() ? { 'Authorization': `Bearer ${getToken()}` } : {})
  });

  const request = async (method, path, body = null) => {
    const opts = { method, headers: headers() };
    if (body) opts.body = JSON.stringify(body);

    try {
      const res = await fetch(`${API_BASE}${path}`, opts);
      const data = await res.json().catch(() => ({}));

      // Token expired or invalid → clear session and return to login screen
      if (res.status === 401) {
        localStorage.removeItem('att_token');
        localStorage.removeItem('att_user');
        window.location.reload();
        return;
      }

      if (!res.ok) throw new Error(data.error || `Request failed: ${res.status}`);
      return data;
    } catch (err) {
      if (err.message === 'Failed to fetch') throw new Error('Cannot connect to server. Is it running?');
      throw err;
    }
  };

  return {
    get:    (path)         => request('GET',    path),
    post:   (path, body)   => request('POST',   path, body),
    put:    (path, body)   => request('PUT',    path, body),
    delete: (path)         => request('DELETE', path),

    // ── Auth ────────────────────────────────────────────────────────
    login:    (email, password) => request('POST', '/auth/login',  { email, password }),
    logout:   ()                => request('POST', '/auth/logout'),

    // ── Admin ────────────────────────────────────────────────────────
    admin: {
      getUsers:       (role)       => request('GET',    `/admin/users${role ? `?role=${role}` : ''}`),
      createUser:     (data)       => request('POST',   '/admin/users', data),
      updateUser:     (id, data)   => request('PUT',    `/admin/users/${id}`, data),
      deleteUser:     (id)         => request('DELETE', `/admin/users/${id}`),

      getClasses:     ()           => request('GET',    '/admin/classes'),
      createClass:    (data)       => request('POST',   '/admin/classes', data),
      updateClass:    (id, data)   => request('PUT',    `/admin/classes/${id}`, data),
      deleteClass:    (id)         => request('DELETE', `/admin/classes/${id}`),

      getSubjects:    (classId)    => request('GET',    `/admin/subjects${classId ? `?class_id=${classId}` : ''}`),
      createSubject:  (data)       => request('POST',   '/admin/subjects', data),
      updateSubject:  (id, data)   => request('PUT',    `/admin/subjects/${id}`, data),
      deleteSubject:  (id)         => request('DELETE', `/admin/subjects/${id}`),

      getStudents:    (params)     => {
        const q = new URLSearchParams(params || {}).toString();
        return request('GET', `/admin/students${q ? `?${q}` : ''}`);
      },
      createStudent:  (data)       => request('POST',   '/admin/students', data),
      updateStudent:  (id, data)   => request('PUT',    `/admin/students/${id}`, data),
      deleteStudent:  (id)         => request('DELETE', `/admin/students/${id}`),

      getReport:      (params)     => {
        const q = new URLSearchParams(params || {}).toString();
        return request('GET', `/admin/attendance/report${q ? `?${q}` : ''}`);
      },
      getTeacherSignupCode: () => request('GET', '/admin/settings/teacher-signup-code'),
      setTeacherSignupCode: (code) => request('POST', '/admin/settings/teacher-signup-code', { code })
    },

    // ── Teacher ──────────────────────────────────────────────────────
    teacher: {
      getSubjects:          ()                  => request('GET', '/teacher/subjects'),
      getStudents:          (subjectId)          => request('GET', `/teacher/students/${subjectId}`),
      getClassStudents:     (classId)            => request('GET', `/teacher/class/${classId}/students`),
      addStudent:           (classId, data)      => request('POST', `/teacher/class/${classId}/students`, data),
      removeStudent:        (classId, studentId) => request('DELETE', `/teacher/class/${classId}/students/${studentId}`),
      getAttendance:        (subjectId, params)  => {
        const q = new URLSearchParams(params || {}).toString();
        return request('GET', `/teacher/attendance/${subjectId}${q ? `?${q}` : ''}`);
      },
      getAttendanceSummary: (subjectId) => request('GET', `/teacher/attendance/summary/${subjectId}`)
    },

    // ── Student ──────────────────────────────────────────────────────
    student: {
      getProfile:   ()       => request('GET', '/student/profile'),
      getAttendance:(params) => {
        const q = new URLSearchParams(params || {}).toString();
        return request('GET', `/student/attendance${q ? `?${q}` : ''}`);
      },
      getSummary:   ()       => request('GET', '/student/attendance/summary'),
      getMonthly:   ()       => request('GET', '/student/attendance/monthly')
    },

    // ── Attendance ───────────────────────────────────────────────────
    attendance: {
      mark:   (data)  => request('POST', '/attendance/mark', data),
      update: (id, status) => request('PUT', `/attendance/${id}`, { status }),
      getDates:(subjectId) => request('GET', `/attendance/dates/${subjectId}`),
      clear:  (data)  => request('DELETE', '/attendance/clear', data)
    },

    // ── SQL Editor (Admin only) ──────────────────────────────────────
    sqlEditor: {
      execute: (sql)  => request('POST', '/sql-editor/execute', { sql }),
      getTables: ()   => request('GET',  '/sql-editor/tables')
    },

    // ── Signup Requests ──────────────────────────────────────────────
    requests: {
      getClasses: () => fetch('/api/requests/classes').then(r => r.json()),
      submit: (data) => fetch('/api/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      }).then(async r => { const d = await r.json(); if (!r.ok) throw new Error(d.error); return d; }),
      getAll:   (status) => request('GET', `/requests${status ? `?status=${status}` : ''}`),
      getCount: ()       => request('GET', '/requests/count'),
      approve:  (id, data)   => request('PUT', `/requests/${id}/approve`, data || {}),
      reject:   (id, reason) => request('PUT', `/requests/${id}/reject`, { reason })
    }
  };
})();

