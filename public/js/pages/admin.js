/**
 * admin.js — Admin panel pages
 */
const AdminPages = (() => {

  // ─── DASHBOARD ──────────────────────────────────────────────────────────────
  const renderDashboard = async () => {
    document.getElementById('page-title').textContent = 'Admin Dashboard';
    const content = document.getElementById('page-content');
    content.innerHTML = `<div class="stats-grid" id="admin-stats"></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;margin-top:0.5rem;" id="admin-quick-cards"></div>`;

    try {
      const [users, classes, subjects, students] = await Promise.all([
        ApiClient.admin.getUsers(),
        ApiClient.admin.getClasses(),
        ApiClient.admin.getSubjects(),
        ApiClient.admin.getStudents()
      ]);

      const teachers = users.filter(u => u.role === 'teacher');
      const studentUsers = users.filter(u => u.role === 'student');

      document.getElementById('admin-stats').innerHTML = `
        ${statCard('Total Students', students.length, 'stat-icon-purple', usersIcon())}
        ${statCard('Total Teachers', teachers.length, 'stat-icon-blue', userCheckIcon())}
        ${statCard('Classes', classes.length, 'stat-icon-green', bookIcon())}
        ${statCard('Subjects', subjects.length, 'stat-icon-orange', fileTextIcon())}`;

      document.getElementById('admin-quick-cards').innerHTML = `
        <div class="card">
          <div class="card-header"><h3 class="card-title">Recent Classes</h3>
            <button class="btn btn-primary btn-sm" onclick="App.navigate('classes')">${plusIcon()} Manage</button>
          </div>
          <div class="table-wrapper"><table>
            <thead><tr><th>Class Name</th></tr></thead>
            <tbody>${classes.slice(0,5).map(c=>`<tr><td>${esc(c.class_name)}</td></tr>`).join('')||`<tr><td class="table-empty"><p>No classes yet</p></td></tr>`}</tbody>
          </table></div>
        </div>
        <div class="card">
          <div class="card-header"><h3 class="card-title">Recent Subjects</h3>
            <button class="btn btn-primary btn-sm" onclick="App.navigate('subjects')">${plusIcon()} Manage</button>
          </div>
          <div class="table-wrapper"><table>
            <thead><tr><th>Subject</th><th>Class</th></tr></thead>
            <tbody>${subjects.slice(0,5).map(s=>`<tr><td>${esc(s.subject_name)}</td><td>${esc(s.classes?.class_name||'—')}</td></tr>`).join('')||`<tr><td colspan="2" class="table-empty"><p>No subjects yet</p></td></tr>`}</tbody>
          </table></div>
        </div>`;
    } catch(err) {
      content.innerHTML = `<div class="alert alert-error">${err.message}</div>`;
    }
  };

  const statCard = (label, value, iconClass, icon) => `
    <div class="stat-card">
      <div class="stat-icon ${iconClass}">${icon}</div>
      <div class="stat-info">
        <div class="stat-value">${value}</div>
        <div class="stat-label">${label}</div>
      </div>
    </div>`;

  // ─── STUDENTS ────────────────────────────────────────────────────────────────
  const renderStudents = async () => {
    document.getElementById('page-title').textContent = 'Manage Students';
    const content = document.getElementById('page-content');
    showPageLoading('page-content');

    try {
      const [students, classes] = await Promise.all([
        ApiClient.admin.getStudents(),
        ApiClient.admin.getClasses()
      ]);

      content.innerHTML = `
        <div class="card">
          <div class="card-header">
            <h3 class="card-title">Students (${students.length})</h3>
            <div class="card-actions">
              <div class="filter-bar" style="margin:0;">
                <input type="text" id="student-search" placeholder="Search name or reg.no…" style="min-width:200px;" />
                <select id="student-class-filter">
                  <option value="">All Classes</option>
                  ${classes.map(c=>`<option value="${c.id}">${esc(c.class_name)}</option>`).join('')}
                </select>
              </div>
              <button class="btn btn-primary" id="add-student-btn">${plusIcon()} Add Student</button>
            </div>
          </div>
          <div class="table-wrapper" id="students-table-wrapper">
            ${renderStudentsTable(students)}
          </div>
        </div>`;

      document.getElementById('add-student-btn').addEventListener('click', () => openStudentModal(null, classes));

      let searchTimer;
      document.getElementById('student-search').addEventListener('input', (e) => {
        clearTimeout(searchTimer);
        searchTimer = setTimeout(() => filterStudents(classes), 300);
      });
      document.getElementById('student-class-filter').addEventListener('change', () => filterStudents(classes));

    } catch(err) {
      content.innerHTML = `<div class="alert alert-error">${err.message}</div>`;
    }
  };

  const filterStudents = async (classes) => {
    const search = document.getElementById('student-search')?.value;
    const class_id = document.getElementById('student-class-filter')?.value;
    const wrapper = document.getElementById('students-table-wrapper');
    if (!wrapper) return;
    wrapper.innerHTML = `<div style="padding:1rem;color:var(--text-muted);font-size:0.85rem;">Loading…</div>`;
    try {
      const params = {};
      if (search) params.search = search;
      if (class_id) params.class_id = class_id;
      const students = await ApiClient.admin.getStudents(params);
      wrapper.innerHTML = renderStudentsTable(students, classes);
    } catch(err) { wrapper.innerHTML = `<div class="alert alert-error" style="margin:1rem;">${err.message}</div>`; }
  };

  const renderStudentsTable = (students, classes) => `
    <table>
      <thead><tr><th>#</th><th>Name</th><th>Reg. No.</th><th>Class</th><th>Actions</th></tr></thead>
      <tbody id="students-tbody">
        ${students.length === 0
          ? `<tr><td colspan="5"><div class="table-empty">${usersIcon()}<p>No students found</p></div></td></tr>`
          : students.map((s, i) => `
            <tr>
              <td style="color:var(--text-muted)">${i+1}</td>
              <td><strong>${esc(s.name)}</strong></td>
              <td><code style="font-size:0.8rem;background:rgba(255,255,255,0.05);padding:0.15rem 0.4rem;border-radius:4px;">${esc(s.registration_number)}</code></td>
              <td>${esc(s.classes?.class_name || '—')}</td>
              <td>
                <div style="display:flex;gap:0.4rem;">
                  <button class="btn btn-secondary btn-sm btn-icon" onclick="AdminPages.editStudent('${s.id}')" title="Edit">${editIcon()}</button>
                  <button class="btn btn-danger btn-sm btn-icon" onclick="AdminPages.deleteStudent('${s.id}','${esc(s.name)}')" title="Delete">${trashIcon()}</button>
                </div>
              </td>
            </tr>`).join('')}
      </tbody>
    </table>`;

  const openStudentModal = (student, classes) => {
    const isEdit = !!student;
    Modal.open(isEdit ? 'Edit Student' : 'Add Student', `
      <form class="modal-form" id="student-form">
        <div class="form-group"><label>Full Name *</label>
          <input type="text" id="sname" value="${isEdit ? esc(student.name) : ''}" placeholder="Student full name" required /></div>
        <div class="form-group"><label>Registration Number *</label>
          <input type="text" id="sreg" value="${isEdit ? esc(student.registration_number) : ''}" placeholder="e.g. CS2024001" required /></div>
        <div class="form-group"><label>Class *</label>
          <select id="sclass">
            <option value="">Select class...</option>
            ${classes.map(c=>`<option value="${c.id}" ${isEdit && student.class_id===c.id?'selected':''}>${esc(c.class_name)}</option>`).join('')}
          </select>
        </div>
        <div id="student-modal-error"></div>
        <div class="modal-actions">
          <button type="button" class="btn btn-secondary" onclick="Modal.close()">Cancel</button>
          <button type="submit" class="btn btn-primary" id="student-save-btn">
            <span class="btn-text">${isEdit ? 'Save Changes' : 'Add Student'}</span>
            <span class="btn-spinner hidden"></span>
          </button>
        </div>
      </form>`);

    document.getElementById('student-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = document.getElementById('student-save-btn');
      const errEl = document.getElementById('student-modal-error');
      const data = {
        name: document.getElementById('sname').value.trim(),
        registration_number: document.getElementById('sreg').value.trim(),
        class_id: document.getElementById('sclass').value
      };
      if (!data.name || !data.registration_number || !data.class_id) {
        errEl.innerHTML = `<div class="alert alert-error">All fields are required</div>`;
        return;
      }
      setButtonLoading(btn, true);
      try {
        if (isEdit) await ApiClient.admin.updateStudent(student.id, data);
        else await ApiClient.admin.createStudent(data);
        Modal.close();
        Toast.success(isEdit ? 'Student updated!' : 'Student added!');
        renderStudents();
      } catch(err) {
        errEl.innerHTML = `<div class="alert alert-error">${err.message}</div>`;
        setButtonLoading(btn, false);
      }
    });
  };

  const editStudent = async (id) => {
    try {
      const [students, classes] = await Promise.all([ApiClient.admin.getStudents(), ApiClient.admin.getClasses()]);
      const student = students.find(s => s.id === id);
      if (student) openStudentModal(student, classes);
    } catch(err) { Toast.error(err.message); }
  };

  const deleteStudent = async (id, name) => {
    if (!confirmAction(`Delete student "${name}"? This will also delete their attendance records.`)) return;
    try {
      await ApiClient.admin.deleteStudent(id);
      Toast.success('Student deleted');
      renderStudents();
    } catch(err) { Toast.error(err.message); }
  };

  // ─── TEACHERS ────────────────────────────────────────────────────────────────
  const renderTeachers = async () => {
    document.getElementById('page-title').textContent = 'Manage Teachers';
    showPageLoading('page-content');
    try {
      const teachers = await ApiClient.admin.getUsers('teacher');
      document.getElementById('page-content').innerHTML = `
        <div class="card">
          <div class="card-header">
            <h3 class="card-title">Teachers (${teachers.length})</h3>
            <button class="btn btn-primary" id="add-teacher-btn">${plusIcon()} Add Teacher</button>
          </div>
          <div class="table-wrapper">
            <table>
              <thead><tr><th>#</th><th>Name</th><th>Email</th><th>Actions</th></tr></thead>
              <tbody>
                ${teachers.length === 0
                  ? `<tr><td colspan="4"><div class="table-empty">${userCheckIcon()}<p>No teachers yet</p></div></td></tr>`
                  : teachers.map((t, i) => `
                    <tr>
                      <td style="color:var(--text-muted)">${i+1}</td>
                      <td><strong>${esc(t.name)}</strong></td>
                      <td style="color:var(--text-secondary)">${esc(t.email)}</td>
                      <td>
                        <div style="display:flex;gap:0.4rem;">
                          <button class="btn btn-secondary btn-sm btn-icon" onclick="AdminPages.editUserModal('${t.id}','teacher')" title="Edit">${editIcon()}</button>
                          <button class="btn btn-danger btn-sm btn-icon" onclick="AdminPages.deleteUser('${t.id}','${esc(t.name)}')" title="Delete">${trashIcon()}</button>
                        </div>
                      </td>
                    </tr>`).join('')}
              </tbody>
            </table>
          </div>
        </div>`;
      document.getElementById('add-teacher-btn').addEventListener('click', () => openUserModal(null, 'teacher'));
    } catch(err) {
      document.getElementById('page-content').innerHTML = `<div class="alert alert-error">${err.message}</div>`;
    }
  };

  const openUserModal = (user, role) => {
    const isEdit = !!user;
    Modal.open(isEdit ? `Edit ${role}` : `Add ${role}`, `
      <form class="modal-form" id="user-form">
        <div class="form-group"><label>Full Name *</label>
          <input type="text" id="uname" value="${isEdit ? esc(user.name) : ''}" placeholder="Full name" required /></div>
        <div class="form-group"><label>Email *</label>
          <input type="email" id="uemail" value="${isEdit ? esc(user.email) : ''}" placeholder="email@college.edu" ${isEdit?'disabled':''} required /></div>
        ${!isEdit ? `<div class="form-group"><label>Password *</label>
          <input type="password" id="upwd" placeholder="Min 6 characters" required /></div>` : ''}
        <div id="user-modal-error"></div>
        <div class="modal-actions">
          <button type="button" class="btn btn-secondary" onclick="Modal.close()">Cancel</button>
          <button type="submit" class="btn btn-primary" id="user-save-btn">
            <span class="btn-text">${isEdit ? 'Save Changes' : `Add ${role}`}</span>
            <span class="btn-spinner hidden"></span>
          </button>
        </div>
      </form>`);

    document.getElementById('user-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = document.getElementById('user-save-btn');
      const errEl = document.getElementById('user-modal-error');
      const name = document.getElementById('uname').value.trim();
      const email = document.getElementById('uemail')?.value?.trim();
      const password = document.getElementById('upwd')?.value;
      if (!name || (!isEdit && (!email || !password))) {
        errEl.innerHTML = `<div class="alert alert-error">All fields required</div>`; return;
      }
      setButtonLoading(btn, true);
      try {
        if (isEdit) await ApiClient.admin.updateUser(user.id, { name });
        else await ApiClient.admin.createUser({ name, email, password, role });
        Modal.close();
        Toast.success(isEdit ? 'Updated!' : 'Created!');
        role === 'teacher' ? renderTeachers() : null;
      } catch(err) {
        errEl.innerHTML = `<div class="alert alert-error">${err.message}</div>`;
        setButtonLoading(btn, false);
      }
    });
  };

  const editUserModal = async (id, role) => {
    try {
      const users = await ApiClient.admin.getUsers(role);
      const user = users.find(u => u.id === id);
      if (user) openUserModal(user, role);
    } catch(err) { Toast.error(err.message); }
  };

  const deleteUser = async (id, name) => {
    if (!confirmAction(`Delete "${name}"? This cannot be undone.`)) return;
    try {
      await ApiClient.admin.deleteUser(id);
      Toast.success('User deleted');
      renderTeachers();
    } catch(err) { Toast.error(err.message); }
  };

  // ─── CLASSES ─────────────────────────────────────────────────────────────────
  const renderClasses = async () => {
    document.getElementById('page-title').textContent = 'Manage Classes';
    showPageLoading('page-content');
    try {
      const classes = await ApiClient.admin.getClasses();
      document.getElementById('page-content').innerHTML = `
        <div class="card">
          <div class="card-header">
            <h3 class="card-title">Classes (${classes.length})</h3>
            <button class="btn btn-primary" id="add-class-btn">${plusIcon()} Add Class</button>
          </div>
          <div class="table-wrapper">
            <table>
              <thead><tr><th>#</th><th>Class Name</th><th>Actions</th></tr></thead>
              <tbody>
                ${classes.length === 0
                  ? `<tr><td colspan="3"><div class="table-empty">${bookIcon()}<p>No classes yet</p></div></td></tr>`
                  : classes.map((c, i) => `
                    <tr>
                      <td style="color:var(--text-muted)">${i+1}</td>
                      <td><strong>${esc(c.class_name)}</strong></td>
                      <td>
                        <div style="display:flex;gap:0.4rem;">
                          <button class="btn btn-secondary btn-sm btn-icon" onclick="AdminPages.editClass('${c.id}','${esc(c.class_name)}')" title="Edit">${editIcon()}</button>
                          <button class="btn btn-danger btn-sm btn-icon" onclick="AdminPages.deleteClass('${c.id}','${esc(c.class_name)}')" title="Delete">${trashIcon()}</button>
                        </div>
                      </td>
                    </tr>`).join('')}
              </tbody>
            </table>
          </div>
        </div>`;
      document.getElementById('add-class-btn').addEventListener('click', () => openClassModal());
    } catch(err) {
      document.getElementById('page-content').innerHTML = `<div class="alert alert-error">${err.message}</div>`;
    }
  };

  const openClassModal = (id, existingName) => {
    const isEdit = !!id;
    Modal.open(isEdit ? 'Edit Class' : 'Add Class', `
      <form class="modal-form" id="class-form">
        <div class="form-group"><label>Class Name *</label>
          <input type="text" id="cname" value="${existingName || ''}" placeholder="e.g. CS-A 2024" required /></div>
        <div id="class-modal-error"></div>
        <div class="modal-actions">
          <button type="button" class="btn btn-secondary" onclick="Modal.close()">Cancel</button>
          <button type="submit" class="btn btn-primary" id="class-save-btn">
            <span class="btn-text">${isEdit ? 'Save Changes' : 'Add Class'}</span>
            <span class="btn-spinner hidden"></span>
          </button>
        </div>
      </form>`);
    document.getElementById('class-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = document.getElementById('class-save-btn');
      const errEl = document.getElementById('class-modal-error');
      const class_name = document.getElementById('cname').value.trim();
      if (!class_name) { errEl.innerHTML = `<div class="alert alert-error">Class name is required</div>`; return; }
      setButtonLoading(btn, true);
      try {
        if (isEdit) await ApiClient.admin.updateClass(id, { class_name });
        else await ApiClient.admin.createClass({ class_name });
        Modal.close(); Toast.success(isEdit ? 'Class updated!' : 'Class added!');
        renderClasses();
      } catch(err) {
        errEl.innerHTML = `<div class="alert alert-error">${err.message}</div>`;
        setButtonLoading(btn, false);
      }
    });
  };

  const editClass = (id, name) => openClassModal(id, name);
  const deleteClass = async (id, name) => {
    if (!confirmAction(`Delete class "${name}"?`)) return;
    try { await ApiClient.admin.deleteClass(id); Toast.success('Class deleted'); renderClasses(); }
    catch(err) { Toast.error(err.message); }
  };

  // ─── SUBJECTS ────────────────────────────────────────────────────────────────
  const renderSubjects = async () => {
    document.getElementById('page-title').textContent = 'Manage Subjects';
    showPageLoading('page-content');
    try {
      const [subjects, classes, teachers] = await Promise.all([
        ApiClient.admin.getSubjects(),
        ApiClient.admin.getClasses(),
        ApiClient.admin.getUsers('teacher')
      ]);
      document.getElementById('page-content').innerHTML = `
        <div class="card">
          <div class="card-header">
            <h3 class="card-title">Subjects (${subjects.length})</h3>
            <div class="card-actions">
              <select id="subject-class-filter" style="padding:0.55rem 0.875rem;font-size:0.85rem;">
                <option value="">All Classes</option>
                ${classes.map(c=>`<option value="${c.id}">${esc(c.class_name)}</option>`).join('')}
              </select>
              <button class="btn btn-primary" id="add-subject-btn">${plusIcon()} Add Subject</button>
            </div>
          </div>
          <div class="table-wrapper" id="subjects-table-wrapper">
            ${renderSubjectsTable(subjects)}
          </div>
        </div>`;
      document.getElementById('add-subject-btn').addEventListener('click', () => openSubjectModal(null, classes, teachers));
      document.getElementById('subject-class-filter').addEventListener('change', async (e) => {
        const class_id = e.target.value;
        const filtered = await ApiClient.admin.getSubjects(class_id || undefined);
        document.getElementById('subjects-table-wrapper').innerHTML = renderSubjectsTable(filtered);
      });
    } catch(err) {
      document.getElementById('page-content').innerHTML = `<div class="alert alert-error">${err.message}</div>`;
    }
  };

  const renderSubjectsTable = (subjects) => `
    <table>
      <thead><tr><th>#</th><th>Subject</th><th>Class</th><th>Teacher</th><th>Actions</th></tr></thead>
      <tbody>
        ${subjects.length === 0
          ? `<tr><td colspan="5"><div class="table-empty">${fileTextIcon()}<p>No subjects yet</p></div></td></tr>`
          : subjects.map((s, i) => `
            <tr>
              <td style="color:var(--text-muted)">${i+1}</td>
              <td><strong>${esc(s.subject_name)}</strong></td>
              <td>${esc(s.classes?.class_name||'—')}</td>
              <td>${esc(s.users?.name||'Unassigned')}</td>
              <td>
                <div style="display:flex;gap:0.4rem;">
                  <button class="btn btn-secondary btn-sm btn-icon" onclick="AdminPages.editSubjectModal('${s.id}')" title="Edit">${editIcon()}</button>
                  <button class="btn btn-danger btn-sm btn-icon" onclick="AdminPages.deleteSubject('${s.id}','${esc(s.subject_name)}')" title="Delete">${trashIcon()}</button>
                </div>
              </td>
            </tr>`).join('')}
      </tbody>
    </table>`;

  const openSubjectModal = (subject, classes, teachers) => {
    const isEdit = !!subject;
    Modal.open(isEdit ? 'Edit Subject' : 'Add Subject', `
      <form class="modal-form" id="subject-form">
        <div class="form-group"><label>Subject Name *</label>
          <input type="text" id="sname" value="${isEdit ? esc(subject.subject_name) : ''}" placeholder="e.g. Data Structures" required /></div>
        <div class="form-group"><label>Class *</label>
          <select id="sclass">
            <option value="">Select class...</option>
            ${classes.map(c=>`<option value="${c.id}" ${isEdit&&subject.class_id===c.id?'selected':''}>${esc(c.class_name)}</option>`).join('')}
          </select>
        </div>
        <div class="form-group"><label>Assign Teacher</label>
          <select id="steacher">
            <option value="">Unassigned</option>
            ${teachers.map(t=>`<option value="${t.id}" ${isEdit&&subject.teacher_id===t.id?'selected':''}>${esc(t.name)}</option>`).join('')}
          </select>
        </div>
        <div id="subject-modal-error"></div>
        <div class="modal-actions">
          <button type="button" class="btn btn-secondary" onclick="Modal.close()">Cancel</button>
          <button type="submit" class="btn btn-primary" id="subject-save-btn">
            <span class="btn-text">${isEdit ? 'Save Changes' : 'Add Subject'}</span>
            <span class="btn-spinner hidden"></span>
          </button>
        </div>
      </form>`);
    document.getElementById('subject-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = document.getElementById('subject-save-btn');
      const errEl = document.getElementById('subject-modal-error');
      const data = {
        subject_name: document.getElementById('sname').value.trim(),
        class_id: document.getElementById('sclass').value,
        teacher_id: document.getElementById('steacher').value || null
      };
      if (!data.subject_name || !data.class_id) {
        errEl.innerHTML = `<div class="alert alert-error">Subject name and class are required</div>`; return;
      }
      setButtonLoading(btn, true);
      try {
        if (isEdit) await ApiClient.admin.updateSubject(subject.id, data);
        else await ApiClient.admin.createSubject(data);
        Modal.close(); Toast.success(isEdit ? 'Subject updated!' : 'Subject added!');
        renderSubjects();
      } catch(err) {
        errEl.innerHTML = `<div class="alert alert-error">${err.message}</div>`;
        setButtonLoading(btn, false);
      }
    });
  };

  const editSubjectModal = async (id) => {
    try {
      const [subjects, classes, teachers] = await Promise.all([
        ApiClient.admin.getSubjects(), ApiClient.admin.getClasses(), ApiClient.admin.getUsers('teacher')
      ]);
      const subject = subjects.find(s => s.id === id);
      if (subject) openSubjectModal(subject, classes, teachers);
    } catch(err) { Toast.error(err.message); }
  };

  const deleteSubject = async (id, name) => {
    if (!confirmAction(`Delete subject "${name}"?`)) return;
    try { await ApiClient.admin.deleteSubject(id); Toast.success('Subject deleted'); renderSubjects(); }
    catch(err) { Toast.error(err.message); }
  };

  // ─── ATTENDANCE REPORT ────────────────────────────────────────────────────────
  const renderReport = async () => {
    document.getElementById('page-title').textContent = 'Attendance Report';
    showPageLoading('page-content');
    try {
      const [classes, subjects] = await Promise.all([ApiClient.admin.getClasses(), ApiClient.admin.getSubjects()]);
      document.getElementById('page-content').innerHTML = `
        <div class="card" style="margin-bottom:1rem;">
          <div class="card-body">
            <div class="filter-bar">
              <div class="filter-group"><label>Class</label>
                <select id="rep-class">
                  <option value="">All Classes</option>
                  ${classes.map(c=>`<option value="${c.id}">${esc(c.class_name)}</option>`).join('')}
                </select>
              </div>
              <div class="filter-group"><label>Subject</label>
                <select id="rep-subject">
                  <option value="">All Subjects</option>
                  ${subjects.map(s=>`<option value="${s.id}">${esc(s.subject_name)} (${esc(s.classes?.class_name||'')})</option>`).join('')}
                </select>
              </div>
              <div class="filter-group"><label>From Date</label>
                <input type="date" id="rep-from" max="${todayISO()}" /></div>
              <div class="filter-group"><label>To Date</label>
                <input type="date" id="rep-to" max="${todayISO()}" /></div>
              <div class="filter-group" style="justify-content:flex-end;">
                <button class="btn btn-primary" id="rep-load-btn">Load Report</button>
              </div>
            </div>
          </div>
        </div>
        <div id="report-result"></div>`;

      document.getElementById('rep-load-btn').addEventListener('click', loadReport);
    } catch(err) {
      document.getElementById('page-content').innerHTML = `<div class="alert alert-error">${err.message}</div>`;
    }
  };

  const loadReport = async () => {
    const params = {
      class_id: document.getElementById('rep-class').value,
      subject_id: document.getElementById('rep-subject').value,
      from_date: document.getElementById('rep-from').value,
      to_date: document.getElementById('rep-to').value
    };
    Object.keys(params).forEach(k => { if (!params[k]) delete params[k]; });
    const resultEl = document.getElementById('report-result');
    resultEl.innerHTML = `<div style="padding:2rem;text-align:center;color:var(--text-muted);">Loading report…</div>`;
    try {
      const data = await ApiClient.admin.getReport(params);
      if (data.length === 0) {
        resultEl.innerHTML = `<div class="card"><div class="card-body"><div class="table-empty">${barChartIcon()}<p>No attendance records found for selected filters</p></div></div></div>`;
        return;
      }
      // Aggregate by student
      const studentMap = {};
      data.forEach(r => {
        const key = r.student_id;
        if (!studentMap[key]) {
          studentMap[key] = {
            name: r.students?.name, reg: r.students?.registration_number,
            class: r.students?.classes?.class_name, total: 0, present: 0
          };
        }
        studentMap[key].total++;
        if (r.status === 'present') studentMap[key].present++;
      });
      const rows = Object.values(studentMap).sort((a, b) => a.name?.localeCompare(b.name));

      resultEl.innerHTML = `
        <div class="card">
          <div class="card-header">
            <h3 class="card-title">Report (${data.length} records)</h3>
            <button class="btn btn-secondary" id="download-report-btn">${downloadIcon()} Download CSV</button>
          </div>
          <div class="table-wrapper">
            <table>
              <thead><tr><th>#</th><th>Student</th><th>Reg. No.</th><th>Class</th><th>Present</th><th>Total</th><th>Attendance</th></tr></thead>
              <tbody>
                ${rows.map((r, i) => {
                  const pct = r.total > 0 ? Math.round((r.present/r.total)*100) : 0;
                  return `<tr>
                    <td style="color:var(--text-muted)">${i+1}</td>
                    <td><strong>${esc(r.name)}</strong>${pct < 75 ? ' <span class="badge badge-warning" style="margin-left:0.35rem;">⚠ Low</span>' : ''}</td>
                    <td>${esc(r.reg)}</td>
                    <td>${esc(r.class||'—')}</td>
                    <td style="color:var(--success)">${r.present}</td>
                    <td>${r.total}</td>
                    <td>${progressBar(pct)}</td>
                  </tr>`;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>`;

      document.getElementById('download-report-btn').addEventListener('click', () => {
        downloadCSV('attendance_report.csv', rows.map(r => ({
          Name: r.name, 'Reg. No.': r.reg, Class: r.class,
          Present: r.present, Total: r.total,
          Percentage: r.total > 0 ? Math.round((r.present/r.total)*100)+'%' : '0%'
        })), ['Name', 'Reg. No.', 'Class', 'Present', 'Total', 'Percentage']);
      });
    } catch(err) {
      resultEl.innerHTML = `<div class="alert alert-error">${err.message}</div>`;
    }
  };

  // ─── SIGNUP REQUESTS ─────────────────────────────────────────────────────────
  const renderRequests = async () => {
    document.getElementById('page-title').textContent = 'Signup Requests';
    showPageLoading('page-content');
    try {
      const [pending, approved, rejected] = await Promise.all([
        ApiClient.requests.getAll('pending'),
        ApiClient.requests.getAll('approved'),
        ApiClient.requests.getAll('rejected')
      ]);

      document.getElementById('page-content').innerHTML = `
        ${pending.length > 0
          ? `<div class="alert alert-warning" style="margin-bottom:1rem;">
               🔔 <strong>${pending.length} pending request(s)</strong> waiting for your review
             </div>`
          : `<div class="alert alert-success" style="margin-bottom:1rem;">✅ No pending requests</div>`}

        <div class="card" style="margin-bottom:1rem;">
          <div class="card-header">
            <h3 class="card-title">${bellIcon()} Pending Requests <span class="badge badge-warning" style="margin-left:0.5rem;">${pending.length}</span></h3>
          </div>
          <div class="requests-grid">
            ${pending.length === 0
              ? `<div class="table-empty" style="padding:1.5rem;">${bellIcon()}<p>No pending requests</p></div>`
              : pending.map(r => `
                <div class="request-card" id="req-${r.id}">
                  <div class="request-card-info">
                    <strong>${esc(r.name)}</strong>
                    <span class="badge ${r.role === 'teacher' ? 'badge-primary' : 'badge-secondary'}" style="font-size:0.7rem; padding:2px 6px; margin-left:4px;">
                      ${r.role === 'teacher' ? '👨‍🏫 Teacher' : '🎓 Student'}
                    </span>
                    <div style="margin-top:0.3rem;">
                      ${esc(r.email)} &nbsp;·&nbsp; Class: <strong>${esc(r.classes?.class_name||'—')}</strong>
                      ${r.role === 'teacher' ? `&nbsp;·&nbsp; Subject: <strong>${esc(r.subject_name||'—')}</strong>` : ''}
                      &nbsp;·&nbsp; ${formatDate(r.created_at?.split('T')[0])}
                    </div>
                  </div>
                  <div class="request-card-actions">
                    <button class="btn btn-primary btn-sm" onclick="AdminPages.approveRequest('${r.id}','${esc(r.name)}')">
                      ${checkIcon()} Approve
                    </button>
                    <button class="btn btn-danger btn-sm" onclick="AdminPages.rejectRequest('${r.id}','${esc(r.name)}')">
                      ${xIcon()} Reject
                    </button>
                  </div>
                </div>`).join('')}
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <h3 class="card-title">Recent History</h3>
          </div>
          <div class="table-wrapper">
            <table>
              <thead><tr><th>Name</th><th>Email</th><th>Class</th><th>Status</th><th>Date</th></tr></thead>
              <tbody>
                ${[...approved, ...rejected].length === 0
                  ? `<tr><td colspan="5"><div class="table-empty"><p>No history yet</p></div></td></tr>`
                  : [...approved, ...rejected].sort((a,b) => new Date(b.reviewed_at||b.created_at) - new Date(a.reviewed_at||a.created_at)).map(r => `
                    <tr>
                      <td><strong>${esc(r.name)}</strong><br><span style="font-size:0.75rem;color:var(--text-muted);">${r.role === 'teacher' ? 'Teacher' : 'Student'}</span></td>
                      <td>${esc(r.email)}</td>
                      <td>${esc(r.classes?.class_name||'—')}${r.role==='teacher' ? `<br><span style="font-size:0.75rem;">Subject: ${esc(r.subject_name||'—')}</span>` : ''}</td>
                      <td><span class="badge badge-${r.status === 'approved' ? 'present' : 'absent'}">${r.status}</span></td>
                      <td>${formatDate((r.reviewed_at||r.created_at)?.split('T')[0])}</td>
                    </tr>`).join('')}
              </tbody>
            </table>
          </div>
        </div>`;

      // Update badge
      updateRequestBadge(pending.length);
    } catch(err) {
      document.getElementById('page-content').innerHTML = `<div class="alert alert-error">${err.message}</div>`;
    }
  };

  const approveRequest = async (id, name) => {
    if (!confirmAction(`Approve "${name}"? This will create their account immediately.`)) return;
    try {
      const res = await ApiClient.requests.approve(id, {});
      Toast.success(res.message);
      renderRequests();
    } catch(err) {
      Toast.error(err.message);
    }
  };

  const confirmApprove = async (id, name) => {}; // kept for compatibility

  const rejectRequest = async (id, name) => {
    Modal.open('Reject Signup — ' + name, `
      <div class="modal-form">
        <div class="form-group">
          <label>Reason (optional)</label>
          <input type="text" id="reject-reason" placeholder="e.g. Not enrolled in this class" />
        </div>
        <div class="modal-actions">
          <button class="btn btn-secondary" onclick="Modal.close()">Cancel</button>
          <button class="btn btn-danger" id="reject-btn" onclick="AdminPages.confirmReject('${id}','${esc(name)}')">
            <span class="btn-text">${xIcon()} Reject Request</span>
            <span class="btn-spinner hidden"></span>
          </button>
        </div>
      </div>`);
  };

  const confirmReject = async (id, name) => {
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

  // ─── SETTINGS ────────────────────────────────────────────────────────────────
  const renderSettings = async () => {
    document.getElementById('page-title').textContent = 'System Settings';
    const content = document.getElementById('page-content');
    showPageLoading('page-content');

    try {
      const data = await ApiClient.admin.getTeacherSignupCode();
      const code = data.code || '';

      content.innerHTML = `
        <div class="card" style="max-width: 600px;">
          <div class="card-header">
            <h3 class="card-title">Registration Settings</h3>
          </div>
          <div class="card-body">
            <form id="settings-form" class="modal-form" style="padding:0;">
              <div class="form-group">
                <label for="set-teacher-code">Teacher Signup Verification Code</label>
                <div class="password-wrapper">
                  <input type="password" id="set-teacher-code" value="${esc(code)}" placeholder="Enter security secret key" required />
                  <button type="button" class="toggle-password" id="toggle-settings-pwd" aria-label="Toggle password visibility" style="top:50%; transform:translateY(-50%);">
                    <svg id="settings-eye-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                      <circle cx="12" cy="12" r="3"/>
                    </svg>
                  </button>
                </div>
                <p style="font-size:0.75rem; color:var(--text-muted); margin-top:0.4rem;">
                  This secret key is required when teachers register for a new account.
                </p>
              </div>

              <div id="settings-error" class="alert alert-error hidden" style="margin-top:1rem;"></div>
              <div id="settings-success" class="alert alert-success hidden" style="margin-top:1rem;"></div>

              <div style="margin-top:1.5rem; display:flex; justify-content:flex-end;">
                <button type="submit" class="btn btn-primary" id="settings-save-btn">
                  <span class="btn-text">Save Settings</span>
                  <span class="btn-spinner hidden"></span>
                </button>
              </div>
            </form>
          </div>
        </div>
      `;

      // Password toggle click listener
      document.getElementById('toggle-settings-pwd').addEventListener('click', () => {
        const input = document.getElementById('set-teacher-code');
        input.type = input.type === 'password' ? 'text' : 'password';
      });

      // Submit listener
      document.getElementById('settings-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = document.getElementById('settings-save-btn');
        const errEl = document.getElementById('settings-error');
        const successEl = document.getElementById('settings-success');
        const newCode = document.getElementById('set-teacher-code').value.trim();

        errEl.classList.add('hidden');
        successEl.classList.add('hidden');

        if (!newCode) {
          errEl.textContent = 'Verification code cannot be empty.';
          errEl.classList.remove('hidden');
          return;
        }

        setButtonLoading(btn, true);
        try {
          const res = await ApiClient.admin.setTeacherSignupCode(newCode);
          if (res.dbWarning) {
            Toast.warning(res.dbWarning);
          } else {
            Toast.success('Settings saved successfully!');
          }
          successEl.textContent = res.message;
          successEl.classList.remove('hidden');
        } catch (err) {
          errEl.textContent = err.message;
          errEl.classList.remove('hidden');
        } finally {
          setButtonLoading(btn, false);
        }
      });

    } catch (err) {
      content.innerHTML = `<div class="alert alert-error">${err.message}</div>`;
    }
  };

  return {
    renderDashboard, renderStudents, renderTeachers, renderClasses,
    renderSubjects, renderReport, renderRequests, renderSettings,
    editStudent, deleteStudent,
    editUserModal, deleteUser,
    editClass, deleteClass,
    editSubjectModal, deleteSubject,
    approveRequest, confirmApprove, rejectRequest, confirmReject
  };
})();
