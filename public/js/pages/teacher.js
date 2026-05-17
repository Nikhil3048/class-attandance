/**
 * teacher.js — Teacher dashboard pages
 */
const TeacherPages = (() => {

  // State for mark attendance
  let currentSubjectId = null;
  let currentStudents = [];
  let attendanceStates = {};

  // ─── DASHBOARD ────────────────────────────────────────────────────────────────
  const renderDashboard = async () => {
    document.getElementById('page-title').textContent = 'Teacher Dashboard';
    showPageLoading('page-content');
    try {
      const subjects = await ApiClient.teacher.getSubjects();
      document.getElementById('page-content').innerHTML = `
        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-icon stat-icon-purple">${fileTextIcon()}</div>
            <div class="stat-info"><div class="stat-value">${subjects.length}</div><div class="stat-label">Assigned Subjects</div></div>
          </div>
          <div class="stat-card">
            <div class="stat-icon stat-icon-blue">${usersIcon()}</div>
            <div class="stat-info"><div class="stat-value">${[...new Set(subjects.map(s=>s.classes?.id).filter(Boolean))].length}</div><div class="stat-label">Classes</div></div>
          </div>
        </div>
        <div class="card">
          <div class="card-header">
            <h3 class="card-title">My Subjects</h3>
            <button class="btn btn-primary" onclick="App.navigate('mark')">${checkSquareIcon()} Mark Today's Attendance</button>
          </div>
          <div class="table-wrapper">
            <table>
              <thead><tr><th>Subject</th><th>Class</th><th>Actions</th></tr></thead>
              <tbody>
                ${subjects.length === 0
                  ? `<tr><td colspan="3"><div class="table-empty">${fileTextIcon()}<p>No subjects assigned yet. Contact admin.</p></div></td></tr>`
                  : subjects.map(s=>`
                    <tr>
                      <td><strong>${esc(s.subject_name)}</strong></td>
                      <td>${esc(s.classes?.class_name||'—')}</td>
                      <td>
                        <div style="display:flex;gap:0.4rem;flex-wrap:wrap;">
                          <button class="btn btn-primary btn-sm" onclick="TeacherPages.goMarkAttendance('${s.id}')">Mark</button>
                          <button class="btn btn-secondary btn-sm" onclick="TeacherPages.goHistory('${s.id}')">History</button>
                          <button class="btn btn-secondary btn-sm" onclick="TeacherPages.goReport('${s.id}')">Report</button>
                          <button class="btn btn-secondary btn-sm" onclick="TeacherPages.goManageStudents('${s.classes?.id}','${esc(s.classes?.class_name||'')}')">
                            ${usersIcon()} Students
                          </button>
                        </div>
                      </td>
                    </tr>`).join('')}
              </tbody>
            </table>
          </div>
        </div>`;
    } catch(err) {
      document.getElementById('page-content').innerHTML = `<div class="alert alert-error">${err.message}</div>`;
    }
  };

  // ─── MANAGE STUDENTS ─────────────────────────────────────────────────────────
  const renderManageStudents = async (classId, className) => {
    document.getElementById('page-title').textContent = 'Manage Students';

    // If no classId (clicked from sidebar), show a class picker first
    if (!classId) {
      showPageLoading('page-content');
      try {
        const subjects = await ApiClient.teacher.getSubjects();
        // Deduplicate classes from subjects
        const classMap = {};
        subjects.forEach(s => {
          if (s.classes?.id) classMap[s.classes.id] = s.classes.class_name;
        });
        const classes = Object.entries(classMap);

        if (classes.length === 0) {
          document.getElementById('page-content').innerHTML =
            `<div class="alert alert-warning">No classes assigned to you yet. Contact admin to assign subjects.</div>`;
          return;
        }

        document.getElementById('page-content').innerHTML = `
          <div class="card">
            <div class="card-header"><h3 class="card-title">${usersIcon()} Select a Class</h3></div>
            <div class="card-body">
              <div class="filter-bar">
                <div class="filter-group">
                  <label>Class</label>
                  <select id="picker-class">
                    ${classes.map(([id, name]) => `<option value="${id}">${esc(name)}</option>`).join('')}
                  </select>
                </div>
                <div class="filter-group" style="justify-content:flex-end;">
                  <button class="btn btn-primary" onclick="TeacherPages.pickClass()">Open Class →</button>
                </div>
              </div>
            </div>
          </div>`;
      } catch(err) {
        document.getElementById('page-content').innerHTML = `<div class="alert alert-error">${err.message}</div>`;
      }
      return;
    }

    showPageLoading('page-content');
    try {
      await loadManageStudents(classId, className);
    } catch(err) {
      document.getElementById('page-content').innerHTML = `<div class="alert alert-error">${err.message}</div>`;
    }
  };

  // Called by the class picker button
  const pickClass = () => {
    const sel = document.getElementById('picker-class');
    if (!sel || !sel.value) return;
    const classId   = sel.value;
    const className = sel.options[sel.selectedIndex].text;
    loadManageStudents(classId, className);
    document.getElementById('page-title').textContent = `Manage Students — ${className}`;
  };

  const loadManageStudents = async (classId, className) => {
    const raw = await ApiClient.teacher.getClassStudents(classId);
    // Guard: API may return object with error or non-array on bad classId
    const students = Array.isArray(raw) ? raw : [];

    document.getElementById('page-content').innerHTML = `
      <div style="display:flex;align-items:center;gap:0.75rem;margin-bottom:1.25rem;">
        <button class="btn btn-ghost btn-sm" onclick="App.navigate('dashboard')">← Back</button>
        <h2 style="font-size:1rem;font-weight:700;color:var(--text-primary);">Class: <span style="color:var(--accent-light)">${esc(className)}</span></h2>
      </div>

      <div class="card" style="margin-bottom:1.25rem;">
        <div class="card-header">
          <h3 class="card-title">${usersIcon()} Students (${students.length})</h3>
          <button class="btn btn-primary" onclick="TeacherPages.showAddStudentModal('${classId}','${esc(className)}')">
            ${plusIcon()} Add Student
          </button>
        </div>
        <div class="table-wrapper">
          <table>
            <thead><tr><th>#</th><th>Name</th><th>Reg. No.</th><th>Login</th><th>Action</th></tr></thead>
            <tbody id="students-tbody">
              ${students.length === 0
                ? `<tr><td colspan="5"><div class="table-empty">${usersIcon()}<p>No students in this class yet.</p></div></td></tr>`
                : students.map((s, i) => `
                  <tr id="student-row-${s.id}">
                    <td style="color:var(--text-muted)">${i+1}</td>
                    <td><strong>${esc(s.name)}</strong></td>
                    <td>${esc(s.registration_number)}</td>
                    <td>
                      ${s.user_id
                        ? `<span class="badge badge-present">✓ Has Login</span>`
                        : `<span class="badge badge-warning">No Login</span>`}
                    </td>
                    <td>
                      <button class="btn btn-danger btn-sm" onclick="TeacherPages.removeStudent('${classId}','${esc(className)}','${s.id}','${esc(s.name)}')">
                        ${trashIcon()} Remove
                      </button>
                    </td>
                  </tr>`).join('')}
            </tbody>
          </table>
        </div>
      </div>`;
  };

  const showAddStudentModal = (classId, className) => {
    Modal.open('Add Student to ' + className, `
      <div class="modal-form">
        <div class="form-group">
          <label>Full Name *</label>
          <input type="text" id="new-student-name" placeholder="e.g. Rahul Sharma" />
        </div>
        <div class="form-group">
          <label>Registration Number *</label>
          <input type="text" id="new-student-reg" placeholder="e.g. CS2024001" />
        </div>
        <div style="background:rgba(99,102,241,0.07);border:1px solid rgba(99,102,241,0.15);border-radius:var(--radius);padding:1rem;margin-top:0.5rem;">
          <label style="display:flex;align-items:center;gap:0.5rem;cursor:pointer;font-size:0.875rem;font-weight:600;color:var(--text-primary);">
            <input type="checkbox" id="create-login-check" onchange="TeacherPages.toggleLoginFields()" style="width:auto;"/>
            Also create a login account for this student
          </label>
          <div id="login-fields" style="display:none;margin-top:0.75rem;display:flex;flex-direction:column;gap:0.75rem;">
            <div class="form-group">
              <label>Email</label>
              <input type="email" id="new-student-email" placeholder="student@college.edu" />
            </div>
            <div class="form-group">
              <label>Password</label>
              <input type="password" id="new-student-password" placeholder="Min 8 characters" />
            </div>
          </div>
        </div>
        <div class="modal-actions">
          <button class="btn btn-secondary" onclick="Modal.close()">Cancel</button>
          <button class="btn btn-primary" id="add-student-btn" onclick="TeacherPages.submitAddStudent('${classId}','${esc(className)}')">
            <span class="btn-text">${plusIcon()} Add Student</span>
            <span class="btn-spinner hidden"></span>
          </button>
        </div>
      </div>`);
    // Hide login fields initially
    document.getElementById('login-fields').style.display = 'none';
  };

  const toggleLoginFields = () => {
    const checked = document.getElementById('create-login-check')?.checked;
    const fields = document.getElementById('login-fields');
    if (fields) fields.style.display = checked ? 'flex' : 'none';
  };

  const submitAddStudent = async (classId, className) => {
    const btn = document.getElementById('add-student-btn');
    const name = document.getElementById('new-student-name')?.value.trim();
    const reg  = document.getElementById('new-student-reg')?.value.trim();
    const createLogin = document.getElementById('create-login-check')?.checked;
    const email = document.getElementById('new-student-email')?.value.trim();
    const password = document.getElementById('new-student-password')?.value;

    if (!name || !reg) { Toast.warning('Name and registration number are required'); return; }
    if (createLogin && (!email || !password)) { Toast.warning('Email and password required for login account'); return; }

    setButtonLoading(btn, true);
    try {
      const result = await ApiClient.teacher.addStudent(classId, {
        name, registration_number: reg,
        create_login: createLogin, email, password
      });
      Modal.close();
      Toast.success(`${name} added${result.login_created ? ' with login account' : ''}!`);
      await loadManageStudents(classId, className);
    } catch(err) {
      Toast.error(err.message);
      setButtonLoading(btn, false);
    }
  };

  const removeStudent = async (classId, className, studentId, studentName) => {
    if (!confirmAction(`Remove "${studentName}" from this class? This will also delete their attendance records.`)) return;
    try {
      await ApiClient.teacher.removeStudent(classId, studentId);
      Toast.success(`${studentName} removed`);
      await loadManageStudents(classId, className);
    } catch(err) {
      Toast.error(err.message);
    }
  };

  // ─── MARK ATTENDANCE ──────────────────────────────────────────────────────────
  const renderMark = async (preselectedSubjectId = null) => {
    document.getElementById('page-title').textContent = 'Mark Attendance';
    showPageLoading('page-content');
    try {
      const subjects = await ApiClient.teacher.getSubjects();
      if (subjects.length === 0) {
        document.getElementById('page-content').innerHTML =
          `<div class="alert alert-warning">No subjects assigned to you yet. Please contact admin.</div>`;
        return;
      }

      document.getElementById('page-content').innerHTML = `
        <div class="card" style="margin-bottom:1rem;">
          <div class="card-body">
            <div class="filter-bar">
              <div class="filter-group">
                <label>Subject *</label>
                <select id="att-subject">
                  <option value="">Select subject...</option>
                  ${subjects.map(s=>`<option value="${s.id}" ${preselectedSubjectId===s.id?'selected':''}>${esc(s.subject_name)} — ${esc(s.classes?.class_name||'')}</option>`).join('')}
                </select>
              </div>
              <div class="filter-group">
                <label>Date *</label>
                <input type="date" id="att-date" value="${todayISO()}" max="${todayISO()}" />
              </div>
              <div class="filter-group" style="justify-content:flex-end;">
                <button class="btn btn-primary" id="load-students-btn">Load Students</button>
              </div>
            </div>
          </div>
        </div>
        <div id="attendance-panel"></div>`;

      document.getElementById('load-students-btn').addEventListener('click', loadStudentsForAttendance);

      if (preselectedSubjectId) {
        document.getElementById('att-subject').value = preselectedSubjectId;
        await loadStudentsForAttendance();
      }
    } catch(err) {
      document.getElementById('page-content').innerHTML = `<div class="alert alert-error">${err.message}</div>`;
    }
  };

  const loadStudentsForAttendance = async () => {
    const subjectId = document.getElementById('att-subject')?.value;
    const date = document.getElementById('att-date')?.value;
    const panel = document.getElementById('attendance-panel');

    if (!subjectId || !date) { Toast.warning('Please select a subject and date'); return; }

    currentSubjectId = subjectId;
    panel.innerHTML = `<div style="padding:1.5rem;text-align:center;color:var(--text-muted);">Loading students…</div>`;

    try {
      const [students, existingRecords] = await Promise.all([
        ApiClient.teacher.getStudents(subjectId),
        ApiClient.teacher.getAttendance(subjectId, { date })
      ]);

      currentStudents = students;
      attendanceStates = {};

      existingRecords.forEach(r => { attendanceStates[r.student_id] = r.status; });
      students.forEach(s => { if (!attendanceStates[s.id]) attendanceStates[s.id] = 'absent'; });

      if (students.length === 0) {
        panel.innerHTML = `<div class="alert alert-info">No students in this class yet. <a href="#" onclick="App.navigate('manage-students')" style="color:inherit;text-decoration:underline">Add students →</a></div>`;
        return;
      }

      const isExisting = existingRecords.length > 0;

      panel.innerHTML = `
        <div class="card">
          <div class="card-header">
            <div>
              <h3 class="card-title">Mark Attendance</h3>
              <p style="font-size:0.8rem;color:var(--text-muted);margin-top:0.25rem;">
                ${isExisting ? '⚠️ Editing existing attendance for this date' : `${students.length} students | ${formatDate(date)}`}
              </p>
            </div>
            <div class="card-actions">
              <button class="btn btn-secondary btn-sm" id="mark-all-present">All Present</button>
              <button class="btn btn-secondary btn-sm" id="mark-all-absent">All Absent</button>
            </div>
          </div>
          <div class="card-body">
            <div class="attendance-grid" id="attendance-list">
              ${students.map(s => renderAttendanceCircle(s)).join('')}
            </div>
          </div>
          <div style="padding:1rem 1.5rem;border-top:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;">
            <span id="att-summary" style="font-size:0.875rem;color:var(--text-secondary);">0 present, 0 absent</span>
            <div style="display:flex;gap:0.5rem;">
              ${isExisting ? `<button class="btn btn-danger" id="clear-att-btn">${trashIcon()} Clear Attendance</button>` : ''}
              <button class="btn btn-primary" id="submit-att-btn">
                <span class="btn-text">${isExisting ? 'Update Attendance' : 'Submit Attendance'}</span>
                <span class="btn-spinner hidden"></span>
              </button>
            </div>
          </div>
        </div>`;

      updateSummary();
      document.getElementById('mark-all-present').addEventListener('click', () => setAll('present'));
      document.getElementById('mark-all-absent').addEventListener('click', () => setAll('absent'));
      document.getElementById('submit-att-btn').addEventListener('click', submitAttendance);
      if (isExisting) {
        document.getElementById('clear-att-btn').addEventListener('click', clearAttendance);
      }

    } catch(err) {
      panel.innerHTML = `<div class="alert alert-error">${err.message}</div>`;
    }
  };

  window.tapTimers = {};
  const handleStudentTap = (studentId, name, reg) => {
    if (window.tapTimers[studentId]) {
        // Double tap: clear the timer so the single tap doesn't fire!
        clearTimeout(window.tapTimers[studentId]);
        window.tapTimers[studentId] = null;
        Toast.info(`👤 ${name} — ${reg}`);
    } else {
        // Start a timer. If a second tap doesn't happen in 250ms, it's a single tap.
        window.tapTimers[studentId] = setTimeout(() => {
            window.tapTimers[studentId] = null;
            const currentState = attendanceStates[studentId];
            toggleAtt(studentId, currentState === 'present' ? 'absent' : 'present');
        }, 250);
    }
  };

  const renderAttendanceCircle = (student) => {
    const state = attendanceStates[student.id] || 'absent';
    const regStr = String(student.registration_number || '');
    const lastTwo = regStr.length >= 2 ? regStr.slice(-2) : regStr.padStart(2, '0');
    return `
      <button class="student-circle ${state}" id="circle-${student.id}"
        onclick="TeacherPages.handleStudentTap('${student.id}', '${esc(student.name)}', '${esc(regStr)}')">
        ${esc(lastTwo)}
      </button>`;
  };

  const toggleAtt = (studentId, status) => {
    attendanceStates[studentId] = status;
    const circle = document.getElementById(`circle-${studentId}`);
    if (circle) {
      circle.className = `student-circle ${status}`;
    }
    updateSummary();
  };

  const setAll = (status) => { currentStudents.forEach(s => toggleAtt(s.id, status)); };

  const updateSummary = () => {
    const present = Object.values(attendanceStates).filter(s => s === 'present').length;
    const absent = Object.values(attendanceStates).filter(s => s === 'absent').length;
    const el = document.getElementById('att-summary');
    if (el) el.textContent = `${present} present, ${absent} absent`;
  };

  const submitAttendance = async () => {
    const btn = document.getElementById('submit-att-btn');
    const subjectId = document.getElementById('att-subject')?.value;
    const date = document.getElementById('att-date')?.value;
    if (!subjectId || !date) { Toast.warning('Missing subject or date'); return; }

    const records = currentStudents.map(s => ({
      student_id: s.id, status: attendanceStates[s.id] || 'absent'
    }));

    setButtonLoading(btn, true);
    try {
      await ApiClient.attendance.mark({ subject_id: subjectId, date, records });
      Toast.success('Attendance saved successfully!');
      await loadStudentsForAttendance(); // refresh UI to show "Editing" state
    } catch(err) {
      Toast.error(err.message);
    }
    setButtonLoading(btn, false);
  };

  const clearAttendance = async () => {
    const subjectId = document.getElementById('att-subject')?.value;
    const date = document.getElementById('att-date')?.value;
    if (!subjectId || !date) return;
    if (!confirmAction(`Are you sure you want to completely clear attendance for this subject on ${formatDate(date)}?`)) return;

    const btn = document.getElementById('clear-att-btn');
    setButtonLoading(btn, true);
    try {
      await ApiClient.attendance.clear({ subject_id: subjectId, date });
      Toast.success('Attendance cleared');
      await loadStudentsForAttendance(); // reset UI
    } catch(err) {
      Toast.error(err.message);
      setButtonLoading(btn, false);
    }
  };

  // ─── HISTORY ─────────────────────────────────────────────────────────────────
  const renderHistory = async (preselectedSubjectId = null) => {
    document.getElementById('page-title').textContent = 'Attendance History';
    showPageLoading('page-content');
    try {
      const subjects = await ApiClient.teacher.getSubjects();
      document.getElementById('page-content').innerHTML = `
        <div class="card" style="margin-bottom:1rem;">
          <div class="card-body">
            <div class="filter-bar">
              <div class="filter-group"><label>Subject</label>
                <select id="hist-subject">
                  <option value="">Select subject...</option>
                  ${subjects.map(s=>`<option value="${s.id}" ${preselectedSubjectId===s.id?'selected':''}>${esc(s.subject_name)} — ${esc(s.classes?.class_name||'')}</option>`).join('')}
                </select>
              </div>
              <div class="filter-group"><label>From</label><input type="date" id="hist-from" /></div>
              <div class="filter-group"><label>To</label><input type="date" id="hist-to" max="${todayISO()}" /></div>
              <div class="filter-group" style="justify-content:flex-end;">
                <button class="btn btn-primary" id="load-hist-btn">Load</button>
              </div>
            </div>
          </div>
        </div>
        <div id="history-result"></div>`;

      document.getElementById('load-hist-btn').addEventListener('click', loadHistory);
      if (preselectedSubjectId) { document.getElementById('hist-subject').value = preselectedSubjectId; await loadHistory(); }
    } catch(err) {
      document.getElementById('page-content').innerHTML = `<div class="alert alert-error">${err.message}</div>`;
    }
  };

  const loadHistory = async () => {
    const subjectId = document.getElementById('hist-subject')?.value;
    const from = document.getElementById('hist-from')?.value;
    const to = document.getElementById('hist-to')?.value;
    if (!subjectId) { Toast.warning('Please select a subject'); return; }
    const result = document.getElementById('history-result');
    result.innerHTML = `<div style="padding:1.5rem;text-align:center;color:var(--text-muted);">Loading…</div>`;
    try {
      const params = {};
      if (from) params.from_date = from;
      if (to) params.to_date = to;
      const data = await ApiClient.teacher.getAttendance(subjectId, params);
      if (data.length === 0) {
        result.innerHTML = `<div class="card"><div class="card-body"><div class="table-empty">${calIcon()}<p>No records found</p></div></div></div>`;
        return;
      }
      result.innerHTML = `
        <div class="card">
          <div class="card-header">
            <h3 class="card-title">History (${data.length} records)</h3>
            <button class="btn btn-secondary btn-sm" id="dl-hist">${downloadIcon()} CSV</button>
          </div>
          <div class="table-wrapper">
            <table>
              <thead><tr><th>Date</th><th>Student</th><th>Reg. No.</th><th>Status</th><th>Edit</th></tr></thead>
              <tbody>
                ${data.map(r=>`
                  <tr>
                    <td>${formatDate(r.date)}</td>
                    <td>${esc(r.students?.name)}</td>
                    <td>${esc(r.students?.registration_number)}</td>
                    <td><span class="badge badge-${r.status}">${r.status}</span></td>
                    <td>
                      <select class="att-status-select" data-id="${r.id}" style="padding:0.3rem 0.5rem;font-size:0.8rem;width:auto;">
                        <option value="present" ${r.status==='present'?'selected':''}>Present</option>
                        <option value="absent"  ${r.status==='absent'?'selected':''}>Absent</option>
                      </select>
                    </td>
                  </tr>`).join('')}
              </tbody>
            </table>
          </div>
        </div>`;

      document.querySelectorAll('.att-status-select').forEach(sel => {
        sel.addEventListener('change', async (e) => {
          try {
            await ApiClient.attendance.update(e.target.dataset.id, e.target.value);
            Toast.success('Updated!');
            const badge = e.target.closest('tr').querySelector('.badge');
            badge.className = `badge badge-${e.target.value}`;
            badge.textContent = e.target.value;
          } catch(err) { Toast.error(err.message); }
        });
      });

      document.getElementById('dl-hist').addEventListener('click', () => {
        downloadCSV('attendance_history.csv', data.map(r => ({
          Date: r.date, Student: r.students?.name, 'Reg No': r.students?.registration_number, Status: r.status
        })), ['Date', 'Student', 'Reg No', 'Status']);
      });
    } catch(err) {
      result.innerHTML = `<div class="alert alert-error">${err.message}</div>`;
    }
  };

  // ─── CLASS REPORT ─────────────────────────────────────────────────────────────
  const renderClassReport = async (preselectedSubjectId = null) => {
    document.getElementById('page-title').textContent = 'Class Report';
    showPageLoading('page-content');
    try {
      const subjects = await ApiClient.teacher.getSubjects();
      document.getElementById('page-content').innerHTML = `
        <div class="card" style="margin-bottom:1rem;">
          <div class="card-body">
            <div class="filter-bar">
              <div class="filter-group"><label>Subject</label>
                <select id="rep-subject">
                  <option value="">Select subject...</option>
                  ${subjects.map(s=>`<option value="${s.id}" ${preselectedSubjectId===s.id?'selected':''}>${esc(s.subject_name)}</option>`).join('')}
                </select>
              </div>
              <div class="filter-group" style="justify-content:flex-end;">
                <button class="btn btn-primary" id="load-report-btn">Generate Report</button>
              </div>
            </div>
          </div>
        </div>
        <div id="class-report-result"></div>`;
      document.getElementById('load-report-btn').addEventListener('click', loadClassReport);
      if (preselectedSubjectId) { document.getElementById('rep-subject').value = preselectedSubjectId; await loadClassReport(); }
    } catch(err) {
      document.getElementById('page-content').innerHTML = `<div class="alert alert-error">${err.message}</div>`;
    }
  };

  const loadClassReport = async () => {
    const subjectId = document.getElementById('rep-subject')?.value;
    if (!subjectId) { Toast.warning('Please select a subject'); return; }
    const result = document.getElementById('class-report-result');
    result.innerHTML = `<div style="padding:1.5rem;text-align:center;color:var(--text-muted);">Generating…</div>`;
    try {
      const data = await ApiClient.teacher.getAttendanceSummary(subjectId);
      if (data.length === 0) {
        result.innerHTML = `<div class="card"><div class="card-body"><div class="table-empty">${barChartIcon()}<p>No attendance data yet</p></div></div></div>`;
        return;
      }
      const warnings = data.filter(s => s.below_75);
      result.innerHTML = `
        ${warnings.length > 0 ? `<div class="alert alert-warning" style="margin-bottom:1rem;">⚠️ ${warnings.length} student(s) below 75% attendance</div>` : ''}
        <div class="card">
          <div class="card-header">
            <h3 class="card-title">Class Attendance Summary</h3>
            <button class="btn btn-secondary btn-sm" id="dl-class-rep">${downloadIcon()} Download CSV</button>
          </div>
          <div class="table-wrapper">
            <table>
              <thead><tr><th>#</th><th>Student</th><th>Reg. No.</th><th>Present</th><th>Total</th><th>Attendance %</th></tr></thead>
              <tbody>
                ${data.map((s, i) => `
                  <tr>
                    <td style="color:var(--text-muted)">${i+1}</td>
                    <td>
                      <strong>${esc(s.name)}</strong>
                      ${s.below_75 ? `<span class="badge badge-warning" style="margin-left:0.35rem;">⚠ Low</span>` : ''}
                    </td>
                    <td>${esc(s.registration_number)}</td>
                    <td style="color:var(--success)">${s.present}</td>
                    <td>${s.total}</td>
                    <td>${progressBar(s.percentage)}</td>
                  </tr>`).join('')}
              </tbody>
            </table>
          </div>
        </div>`;
      document.getElementById('dl-class-rep').addEventListener('click', () => {
        downloadCSV('class_report.csv', data.map(s => ({
          Name: s.name, 'Reg No': s.registration_number, Present: s.present,
          Total: s.total, Percentage: s.percentage + '%', Warning: s.below_75 ? 'Yes' : 'No'
        })), ['Name', 'Reg No', 'Present', 'Total', 'Percentage', 'Warning']);
      });
    } catch(err) {
      result.innerHTML = `<div class="alert alert-error">${err.message}</div>`;
    }
  };

  // ─── HELPERS ──────────────────────────────────────────────────────────────────
  const goMarkAttendance = (subjectId) => App.navigate('mark', subjectId);
  const goHistory  = (subjectId) => App.navigate('history', subjectId);
  const goReport   = (subjectId) => App.navigate('class-report', subjectId);
  const goManageStudents = (classId, className) => App.navigate('manage-students', { classId, className });

  // ─── SIGNUP REQUESTS (teacher's classes only) ────────────────────────────────
  const renderRequests = async () => {
    document.getElementById('page-title').textContent = 'Signup Requests';
    showPageLoading('page-content');
    try {
      const pending = await ApiClient.requests.getAll('pending');
      document.getElementById('page-content').innerHTML = `
        ${pending.length > 0
          ? `<div class="alert alert-warning" style="margin-bottom:1rem;">🔔 <strong>${pending.length} pending</strong> request(s) for your classes</div>`
          : `<div class="alert alert-success" style="margin-bottom:1rem;">✅ No pending requests for your classes</div>`}
        <div class="card">
          <div class="card-header">
            <h3 class="card-title">${bellIcon()} Pending Requests <span class="badge badge-warning" style="margin-left:0.5rem;">${pending.length}</span></h3>
          </div>
          <div class="requests-grid">
            ${pending.length === 0
              ? `<div class="table-empty" style="padding:1.5rem;">${bellIcon()}<p>No pending requests for your classes</p></div>`
              : pending.map(r => `
                <div class="request-card" id="req-${r.id}">
                  <div class="request-card-info">
                    <strong>${esc(r.name)}</strong>
                    <span>${esc(r.email)} &nbsp;·&nbsp; Class: <strong>${esc(r.classes?.class_name||'—')}</strong> &nbsp;·&nbsp; ${formatDate(r.created_at?.split('T')[0])}</span>
                  </div>
                  <div class="request-card-actions">
                    <button class="btn btn-primary btn-sm" onclick="TeacherPages.approveRequest('${r.id}','${esc(r.name)}')">
                      ${checkIcon()} Approve
                    </button>
                    <button class="btn btn-danger btn-sm" onclick="TeacherPages.rejectRequest('${r.id}','${esc(r.name)}')">
                      ${xIcon()} Reject
                    </button>
                  </div>
                </div>`).join('')}
          </div>
        </div>`;
      updateRequestBadge(pending.length);
    } catch(err) {
      document.getElementById('page-content').innerHTML = `<div class="alert alert-error">${err.message}</div>`;
    }
  };

  const approveRequest = async (id, name) => {
    if (!confirmAction(`Approve "${name}"? This will create their student account immediately.`)) return;
    try {
      const res = await ApiClient.requests.approve(id, {});
      Toast.success(res.message);
      renderRequests();
    } catch(err) {
      Toast.error(err.message);
    }
  };

  const confirmApprove = async (id) => {}; // kept for compatibility

  const rejectRequest = async (id, name) => {
    Modal.open('Reject Signup — ' + name, `
      <div class="modal-form">
        <div class="form-group">
          <label>Reason (optional)</label>
          <input type="text" id="reject-reason" placeholder="e.g. Not enrolled in this class" />
        </div>
        <div class="modal-actions">
          <button class="btn btn-secondary" onclick="Modal.close()">Cancel</button>
          <button class="btn btn-danger" id="reject-btn" onclick="TeacherPages.confirmReject('${id}')">
            <span class="btn-text">${xIcon()} Reject</span>
            <span class="btn-spinner hidden"></span>
          </button>
        </div>
      </div>`);
  };

  const confirmReject = async (id) => {
    const btn = document.getElementById('reject-btn');
    const reason = document.getElementById('reject-reason')?.value.trim();
    setButtonLoading(btn, true);
    try {
      const res = await ApiClient.requests.reject(id, reason);
      Modal.close();
      Toast.success(res.message);
      renderRequests();
    } catch(err) {
      Toast.error(err.message);
      setButtonLoading(btn, false);
    }
  };

  return {
    renderDashboard, renderMark, renderHistory, renderClassReport, renderManageStudents, renderRequests,
    toggleAtt, goMarkAttendance, goHistory, goReport, goManageStudents,
    showAddStudentModal, toggleLoginFields, submitAddStudent, removeStudent, pickClass,
    approveRequest, confirmApprove, rejectRequest, confirmReject
  };
})();

