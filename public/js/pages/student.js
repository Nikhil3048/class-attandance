/**
 * student.js — Student dashboard pages
 */
const StudentPages = (() => {

  // ─── DASHBOARD ────────────────────────────────────────────────────────────────
  const renderDashboard = async () => {
    document.getElementById('page-title').textContent = 'My Dashboard';
    showPageLoading('page-content');
    try {
      const [profile, summary] = await Promise.all([
        ApiClient.student.getProfile(),
        ApiClient.student.getSummary()
      ]);

      const overallTotal = summary.reduce((a, s) => a + s.total, 0);
      const overallPresent = summary.reduce((a, s) => a + s.present, 0);
      const overallPct = overallTotal > 0 ? Math.round((overallPresent / overallTotal) * 100) : 0;
      const belowCount = summary.filter(s => s.below_75).length;

      document.getElementById('page-content').innerHTML = `
        <div class="student-profile-banner">
          <div class="profile-badge-avatar">
            ${esc(profile.name.charAt(0).toUpperCase())}
          </div>
          <div class="profile-details">
            <h2>Welcome back, ${esc(profile.name)}!</h2>
            <div class="profile-meta-row">
              <span class="profile-meta-item">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/></svg>
                Class: <strong>${esc(profile.classes?.class_name || '—')}</strong>
              </span>
              <span class="profile-meta-item">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
                Reg No: <strong>${esc(profile.registration_number)}</strong>
              </span>
            </div>
          </div>
        </div>
        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-icon stat-icon-purple">${pieIcon()}</div>
            <div class="stat-info">
              <div class="stat-value ${pctTextClass(overallPct)}">${overallPct}%</div>
              <div class="stat-label">Overall Attendance</div>
            </div>
          </div>
          <div class="stat-card">
            <div class="stat-icon stat-icon-green">${checkSquareIcon()}</div>
            <div class="stat-info">
              <div class="stat-value">${overallPresent}</div>
              <div class="stat-label">Classes Attended</div>
            </div>
          </div>
          <div class="stat-card">
            <div class="stat-icon stat-icon-orange">${fileTextIcon()}</div>
            <div class="stat-info">
              <div class="stat-value">${summary.length}</div>
              <div class="stat-label">Total Subjects</div>
            </div>
          </div>
          <div class="stat-card">
            <div class="stat-icon ${belowCount>0?'stat-icon-orange':'stat-icon-green'}">${barChartIcon()}</div>
            <div class="stat-info">
              <div class="stat-value ${belowCount>0?'pct-warning':'pct-good'}">${belowCount}</div>
              <div class="stat-label">Subjects Below 75%</div>
            </div>
          </div>
        </div>

        ${belowCount > 0 ? `
          <div class="alert alert-warning" style="margin-bottom:1.25rem;">
            <span class="alert-icon">⚠️</span>
            <div class="alert-text">
              You have <strong>${belowCount} subject(s)</strong> with attendance below 75%. 
              <a href="#" onclick="App.navigate('subject-wise')" style="color:inherit;text-decoration:underline;margin-left:0.25rem;">View details →</a>
            </div>
          </div>` : ''}

        <div class="card">
          <div class="card-header">
            <h3 class="card-title">Subject-wise Attendance</h3>
            <button class="btn btn-secondary btn-sm" onclick="App.navigate('subject-wise')">${pieIcon()} Full View</button>
          </div>
          <div class="subject-cards-grid" style="padding:1.25rem;">
            ${summary.length === 0
              ? `<div class="table-empty">${pieIcon()}<p>No attendance records yet</p></div>`
              : summary.map(s => `
                <div class="subject-stat-card" onclick="App.navigate('my-attendance')">
                  <div class="subject-card-name">${esc(s.subject_name)}</div>
                  <div class="subject-pct ${pctTextClass(s.percentage)}">${s.percentage}%</div>
                  ${progressBar(s.percentage)}
                  <div style="display:flex;justify-content:space-between;margin-top:0.5rem;font-size:0.75rem;color:var(--text-muted);">
                    <span>${s.present} Present</span>
                    <span>${s.absent} Absent</span>
                    <span>${s.total} Total</span>
                  </div>
                  ${s.below_75 ? `<div class="badge badge-warning" style="margin-top:0.5rem;">⚠ Below 75%</div>` : ''}
                </div>`).join('')}
          </div>
        </div>`;
    } catch(err) {
      document.getElementById('page-content').innerHTML = `<div class="alert alert-error">${err.message}</div>`;
    }
  };

  // ─── MY ATTENDANCE ────────────────────────────────────────────────────────────
  const renderMyAttendance = async () => {
    document.getElementById('page-title').textContent = 'My Attendance';
    showPageLoading('page-content');
    try {
      const summary = await ApiClient.student.getSummary();
      document.getElementById('page-content').innerHTML = `
        <div class="card" style="margin-bottom:1rem;">
          <div class="card-body">
            <div class="filter-bar">
              <div class="filter-group"><label>Subject</label>
                <select id="my-att-subject">
                  <option value="">All Subjects</option>
                  ${summary.map(s=>`<option value="${s.subject_id}">${esc(s.subject_name)}</option>`).join('')}
                </select>
              </div>
              <div class="filter-group"><label>From Date</label>
                <input type="date" id="my-att-from" /></div>
              <div class="filter-group"><label>To Date</label>
                <input type="date" id="my-att-to" max="${todayISO()}" /></div>
              <div class="filter-group" style="justify-content:flex-end;">
                <button class="btn btn-primary" id="load-my-att">Load</button>
              </div>
            </div>
          </div>
        </div>
        <div id="my-att-result"></div>`;

      document.getElementById('load-my-att').addEventListener('click', loadMyAttendance);
      await loadMyAttendance();
    } catch(err) {
      document.getElementById('page-content').innerHTML = `<div class="alert alert-error">${err.message}</div>`;
    }
  };

  const loadMyAttendance = async () => {
    const subject_id = document.getElementById('my-att-subject')?.value;
    const from_date = document.getElementById('my-att-from')?.value;
    const to_date = document.getElementById('my-att-to')?.value;
    const result = document.getElementById('my-att-result');
    result.innerHTML = `<div style="padding:1.5rem;text-align:center;color:var(--text-muted);">Loading…</div>`;
    try {
      const params = {};
      if (subject_id) params.subject_id = subject_id;
      if (from_date) params.from_date = from_date;
      if (to_date) params.to_date = to_date;
      const data = await ApiClient.student.getAttendance(params);
      if (data.length === 0) {
        result.innerHTML = `<div class="card"><div class="card-body"><div class="table-empty">${calIcon()}<p>No records found</p></div></div></div>`;
        return;
      }
      result.innerHTML = `
        <div class="card">
          <div class="card-header">
            <h3 class="card-title">Records (${data.length})</h3>
            <button class="btn btn-secondary btn-sm" id="dl-my-att">${downloadIcon()} CSV</button>
          </div>
          <div class="table-wrapper">
            <table>
              <thead><tr><th>Date</th><th>Subject</th><th>Status</th></tr></thead>
              <tbody>
                ${data.map(r=>`
                  <tr>
                    <td>${formatDate(r.date)}</td>
                    <td>${esc(r.subjects?.subject_name||'—')}</td>
                    <td><span class="badge badge-${r.status}">${r.status}</span></td>
                  </tr>`).join('')}
              </tbody>
            </table>
          </div>
        </div>`;
      document.getElementById('dl-my-att').addEventListener('click', () => {
        downloadCSV('my_attendance.csv', data.map(r => ({
          Date: r.date, Subject: r.subjects?.subject_name, Status: r.status
        })), ['Date', 'Subject', 'Status']);
      });
    } catch(err) {
      result.innerHTML = `<div class="alert alert-error">${err.message}</div>`;
    }
  };

  // ─── SUBJECT-WISE ─────────────────────────────────────────────────────────────
  const renderSubjectWise = async () => {
    document.getElementById('page-title').textContent = 'Subject-wise Attendance';
    showPageLoading('page-content');
    try {
      const summary = await ApiClient.student.getSummary();
      const warnings = summary.filter(s => s.below_75);
      document.getElementById('page-content').innerHTML = `
        ${warnings.length > 0 ? `
          <div class="alert alert-warning" style="margin-bottom:1.25rem;">
            <span class="alert-icon">⚠️</span>
            <div class="alert-text">
              <strong>${warnings.length} subject(s)</strong> below 75% attendance — 
              ${warnings.map(s=>`<strong>${esc(s.subject_name)}</strong> (${s.percentage}%)`).join(', ')}
            </div>
          </div>` : `
          <div class="alert alert-success" style="margin-bottom:1.25rem;">
            <span class="alert-icon">✅</span>
            <div class="alert-text">
              All subjects are above 75% — Keep it up!
            </div>
          </div>`}
        <div class="card">
          <div class="card-header">
            <h3 class="card-title">Subject-wise Breakdown</h3>
            <button class="btn btn-secondary btn-sm" id="dl-subj">${downloadIcon()} CSV</button>
          </div>
          <div class="table-wrapper">
            <table>
              <thead><tr><th>Subject</th><th>Present</th><th>Absent</th><th>Total</th><th>Attendance %</th><th>Status</th></tr></thead>
              <tbody>
                ${summary.length === 0
                  ? `<tr><td colspan="6"><div class="table-empty">${pieIcon()}<p>No records yet</p></div></td></tr>`
                  : summary.map(s=>`
                    <tr>
                      <td><strong>${esc(s.subject_name)}</strong></td>
                      <td style="color:var(--success)">${s.present}</td>
                      <td style="color:var(--danger)">${s.absent}</td>
                      <td>${s.total}</td>
                      <td>${progressBar(s.percentage)}</td>
                      <td>
                        ${s.below_75
                          ? `<span class="badge badge-warning">⚠ Below 75%</span>`
                          : `<span class="badge badge-present">✓ Good</span>`}
                      </td>
                    </tr>`).join('')}
              </tbody>
            </table>
          </div>
        </div>`;
      document.getElementById('dl-subj').addEventListener('click', () => {
        downloadCSV('subject_attendance.csv', summary.map(s=>({
          Subject: s.subject_name, Present: s.present, Absent: s.absent,
          Total: s.total, Percentage: s.percentage+'%'
        })), ['Subject','Present','Absent','Total','Percentage']);
      });
    } catch(err) {
      document.getElementById('page-content').innerHTML = `<div class="alert alert-error">${err.message}</div>`;
    }
  };

  // ─── MONTHLY SUMMARY ─────────────────────────────────────────────────────────
  const renderMonthly = async () => {
    document.getElementById('page-title').textContent = 'Monthly Summary';
    showPageLoading('page-content');
    try {
      const monthly = await ApiClient.student.getMonthly();
      document.getElementById('page-content').innerHTML = `
        <div class="card">
          <div class="card-header">
            <h3 class="card-title">Monthly Attendance</h3>
            <button class="btn btn-secondary btn-sm" id="dl-monthly">${downloadIcon()} CSV</button>
          </div>
          ${monthly.length === 0
            ? `<div class="card-body"><div class="table-empty">${barChartIcon()}<p>No records yet</p></div></div>`
            : `
            <div class="card-body">
              <div class="monthly-grid" id="monthly-grid">
                ${monthly.map(m => `
                  <div class="month-card">
                    <div class="month-name">${monthLabel(m.month)}</div>
                    ${progressBar(m.percentage)}
                    <div class="month-stats" style="margin-top:0.75rem;">
                      <div>
                        <div class="month-stat-val" style="color:var(--success)">${m.present}</div>
                        <div class="month-stat-lbl">Present</div>
                      </div>
                      <div>
                        <div class="month-stat-val" style="color:var(--danger)">${m.absent}</div>
                        <div class="month-stat-lbl">Absent</div>
                      </div>
                      <div>
                        <div class="month-stat-val">${m.total}</div>
                        <div class="month-stat-lbl">Total</div>
                      </div>
                    </div>
                  </div>`).join('')}
              </div>
            </div>
            <div class="table-wrapper">
              <table>
                <thead><tr><th>Month</th><th>Present</th><th>Absent</th><th>Total</th><th>Attendance %</th></tr></thead>
                <tbody>
                  ${monthly.map(m=>`
                    <tr>
                      <td>${monthLabel(m.month)}</td>
                      <td style="color:var(--success)">${m.present}</td>
                      <td style="color:var(--danger)">${m.absent}</td>
                      <td>${m.total}</td>
                      <td>${progressBar(m.percentage)}</td>
                    </tr>`).join('')}
                </tbody>
              </table>
            </div>`}
        </div>`;
      const dlBtn = document.getElementById('dl-monthly');
      if (dlBtn) dlBtn.addEventListener('click', () => {
        downloadCSV('monthly_attendance.csv', monthly.map(m=>({
          Month: monthLabel(m.month), Present: m.present, Absent: m.absent,
          Total: m.total, Percentage: m.percentage+'%'
        })), ['Month','Present','Absent','Total','Percentage']);
      });
    } catch(err) {
      document.getElementById('page-content').innerHTML = `<div class="alert alert-error">${err.message}</div>`;
    }
  };

  return { renderDashboard, renderMyAttendance, renderSubjectWise, renderMonthly };
})();
