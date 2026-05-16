/**
 * app.js — Main application controller
 * Handles auth, routing, and sidebar navigation
 */

const App = (() => {
  let currentUser = null;
  let currentPage = null;
  let refreshTimer = null;

  // ─── INIT ─────────────────────────────────────────────────────────────────────
  const init = async () => {
    Modal.init();

    // Check for saved session
    const token = localStorage.getItem('att_token');
    const savedUser = localStorage.getItem('att_user');

    if (token && savedUser) {
      try {
        currentUser = JSON.parse(savedUser);
        showApp();
        scheduleTokenRefresh();
        navigate('dashboard');
      } catch {
        clearSession();
        showAuth();
      }
    } else {
      showAuth();
    }

    // Auth form
    document.getElementById('login-form').addEventListener('submit', handleLogin);
    document.getElementById('logout-btn').addEventListener('click', handleLogout);
    document.getElementById('mobile-menu-btn').addEventListener('click', openSidebar);
    document.getElementById('sidebar-overlay').addEventListener('click', closeSidebar);

    // Password toggle
    document.getElementById('toggle-pwd').addEventListener('click', () => {
      const input = document.getElementById('login-password');
      input.type = input.type === 'password' ? 'text' : 'password';
    });

    // Hide loading overlay
    setTimeout(() => {
      const overlay = document.getElementById('loading-overlay');
      overlay.classList.add('fade-out');
      setTimeout(() => overlay.remove(), 400);
    }, 600);

    // Signup form
    document.getElementById('signup-form').addEventListener('submit', handleSignup);
    // Load classes for signup dropdown
    ApiClient.requests.getClasses().then(classes => {
      const sel = document.getElementById('signup-class');
      if (sel && Array.isArray(classes)) {
        sel.innerHTML = `<option value="">Select your class…</option>` +
          classes.map(c => `<option value="${c.id}">${c.class_name}</option>`).join('');
      }
    }).catch(() => {});
  };

  // ─── AUTH ─────────────────────────────────────────────────────────────────────
  const handleLogin = async (e) => {
    e.preventDefault();
    const btn = document.getElementById('login-btn');
    const errEl = document.getElementById('auth-error');
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;

    errEl.classList.add('hidden');

    if (!email || !password) {
      errEl.textContent = 'Please enter email and password';
      errEl.classList.remove('hidden');
      return;
    }

    setButtonLoading(btn, true);
    try {
      const data = await ApiClient.login(email, password);
      localStorage.setItem('att_token', data.token);
      localStorage.setItem('att_user', JSON.stringify(data.user));
      if (data.refresh_token) localStorage.setItem('att_refresh_token', data.refresh_token);
      if (data.expires_at)    localStorage.setItem('att_expires_at',    data.expires_at);
      currentUser = data.user;
      showApp();
      scheduleTokenRefresh();
      loadRequestBadge();
      navigate('dashboard');
      Toast.success(`Welcome back, ${data.user.name}!`);
    } catch(err) {
      errEl.textContent = err.message;
      errEl.classList.remove('hidden');
      setButtonLoading(btn, false);
    }
  };

  const handleSignup = async (e) => {
    e.preventDefault();
    const btn = document.getElementById('signup-btn');
    const errEl = document.getElementById('signup-error');
    const successEl = document.getElementById('signup-success');
    const name            = document.getElementById('signup-name').value.trim();
    const email           = document.getElementById('signup-email').value.trim();
    const password        = document.getElementById('signup-password').value;
    const registration_number = document.getElementById('signup-reg').value.trim();
    const class_id        = document.getElementById('signup-class').value;

    errEl.classList.add('hidden');
    successEl.classList.add('hidden');

    if (!name || !email || !password || !registration_number || !class_id) {
      errEl.textContent = 'All fields are required';
      errEl.classList.remove('hidden');
      return;
    }

    setButtonLoading(btn, true);
    try {
      const res = await ApiClient.requests.submit({ name, email, password, registration_number, class_id });
      successEl.textContent = res.message;
      successEl.classList.remove('hidden');
      document.getElementById('signup-form').reset();
    } catch(err) {
      errEl.textContent = err.message;
      errEl.classList.remove('hidden');
    }
    setButtonLoading(btn, false);
  };

  const handleLogout = async () => {
    try { await ApiClient.logout(); } catch {}
    clearSession();
    showAuth();
    Toast.info('Signed out');
  };

  const clearSession = () => {
    localStorage.removeItem('att_token');
    localStorage.removeItem('att_user');
    localStorage.removeItem('att_refresh_token');
    localStorage.removeItem('att_expires_at');
    currentUser = null;
    currentPage = null;
    if (refreshTimer) { clearTimeout(refreshTimer); refreshTimer = null; }
  };

  // ─── AUTO TOKEN REFRESH ───────────────────────────────────────────────────────
  const scheduleTokenRefresh = () => {
    if (refreshTimer) clearTimeout(refreshTimer);
    const expiresAt = parseInt(localStorage.getItem('att_expires_at') || '0', 10);
    if (!expiresAt) return;
    // Refresh 2 minutes before expiry
    const msUntilRefresh = (expiresAt * 1000) - Date.now() - (2 * 60 * 1000);
    if (msUntilRefresh <= 0) {
      doTokenRefresh();
      return;
    }
    refreshTimer = setTimeout(doTokenRefresh, msUntilRefresh);
  };

  const doTokenRefresh = async () => {
    const refreshToken = localStorage.getItem('att_refresh_token');
    if (!refreshToken) return;
    try {
      const data = await ApiClient.post('/auth/refresh', { refresh_token: refreshToken });
      localStorage.setItem('att_token', data.token);
      if (data.refresh_token) localStorage.setItem('att_refresh_token', data.refresh_token);
      if (data.expires_at)    localStorage.setItem('att_expires_at',    data.expires_at);
      scheduleTokenRefresh(); // schedule the next refresh
    } catch {
      // Refresh failed — session truly expired, log out cleanly
      clearSession();
      showAuth();
      Toast.warning('Your session expired. Please sign in again.');
    }
  };

  // ─── SCREEN SWITCHING ─────────────────────────────────────────────────────────
  const showAuth = () => {
    document.getElementById('auth-screen').classList.remove('hidden');
    document.getElementById('app').classList.add('hidden');
    setButtonLoading(document.getElementById('login-btn'), false);
    document.getElementById('login-email').value = '';
    document.getElementById('login-password').value = '';
    document.getElementById('auth-error').classList.add('hidden');
    showLoginTab(); // always reset to login tab on logout
  };

  // ─── AUTH TABS ────────────────────────────────────────────────────────────────
  const showLoginTab = () => {
    document.getElementById('login-panel').style.display = '';
    document.getElementById('signup-panel').style.display = 'none';
    document.getElementById('tab-login').classList.add('active');
    document.getElementById('tab-signup').classList.remove('active');
  };

  const showSignupTab = () => {
    document.getElementById('login-panel').style.display = 'none';
    document.getElementById('signup-panel').style.display = '';
    document.getElementById('tab-login').classList.remove('active');
    document.getElementById('tab-signup').classList.add('active');
  };

  const showApp = () => {
    document.getElementById('auth-screen').classList.add('hidden');
    document.getElementById('app').classList.remove('hidden');
    buildSidebar();
    updateUserUI();
  };

  // ─── SIDEBAR SETUP ────────────────────────────────────────────────────────────
  const buildSidebar = () => {
    if (!currentUser) return;
    const nav = document.getElementById('sidebar-nav');
    const items = NAV_CONFIG[currentUser.role] || [];
    nav.innerHTML = items.map(item => `
      <div class="nav-item" data-page="${item.id}" id="nav-${item.id}" onclick="App.navigate('${item.id}')">
        ${item.icon}
        <span>${item.label}</span>
        ${item.id === 'requests' ? '<span class="nav-badge hidden" id="requests-badge">0</span>' : ''}
      </div>`).join('');
  };

  const updateUserUI = () => {
    if (!currentUser) return;
    const initial = currentUser.name.charAt(0).toUpperCase();
    document.getElementById('user-avatar').textContent = initial;
    document.getElementById('topbar-avatar').textContent = initial;
    document.getElementById('sidebar-user-name').textContent = currentUser.name;
    document.getElementById('topbar-user-name').textContent = currentUser.name;
    const roleBadge = document.getElementById('sidebar-user-role');
    roleBadge.textContent = currentUser.role;
    roleBadge.className = `user-role-badge role-${currentUser.role}`;
  };

  const setActiveNav = (pageId) => {
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    const active = document.getElementById(`nav-${pageId}`);
    if (active) active.classList.add('active');
  };

  // ─── ROUTING ──────────────────────────────────────────────────────────────────
  const navigate = (page, extra = null) => {
    currentPage = page;
    setActiveNav(page);
    closeSidebar();

    const role = currentUser?.role;
    const content = document.getElementById('page-content');
    content.innerHTML = '';

    switch(role) {
      case 'admin':   navigateAdmin(page, extra);   break;
      case 'teacher': navigateTeacher(page, extra); break;
      case 'student': navigateStudent(page, extra); break;
      default:
        content.innerHTML = `<div class="alert alert-error">Unknown role: ${role}</div>`;
    }
  };

  const navigateAdmin = (page) => {
    switch(page) {
      case 'dashboard': AdminPages.renderDashboard(); break;
      case 'students':  AdminPages.renderStudents();  break;
      case 'teachers':  AdminPages.renderTeachers();  break;
      case 'classes':   AdminPages.renderClasses();   break;
      case 'subjects':  AdminPages.renderSubjects();  break;
      case 'report':    AdminPages.renderReport();    break;
      case 'requests':  AdminPages.renderRequests();  break;
      default: AdminPages.renderDashboard();
    }
  };

  const navigateTeacher = (page, extra) => {
    switch(page) {
      case 'dashboard':       TeacherPages.renderDashboard(); break;
      case 'mark':            TeacherPages.renderMark(extra); break;
      case 'history':         TeacherPages.renderHistory(extra); break;
      case 'class-report':    TeacherPages.renderClassReport(extra); break;
      case 'manage-students': {
        const classId   = extra?.classId   || '';
        const className = extra?.className || 'Class';
        TeacherPages.renderManageStudents(classId, className);
        break;
      }
      case 'requests': TeacherPages.renderRequests(); break;
      default: TeacherPages.renderDashboard();
    }
  };

  const navigateStudent = (page) => {
    switch(page) {
      case 'dashboard':    StudentPages.renderDashboard();    break;
      case 'my-attendance':StudentPages.renderMyAttendance(); break;
      case 'subject-wise': StudentPages.renderSubjectWise();  break;
      case 'monthly':      StudentPages.renderMonthly();      break;
      default: StudentPages.renderDashboard();
    }
  };

  // ─── MOBILE SIDEBAR ───────────────────────────────────────────────────────────
  const openSidebar = () => {
    document.getElementById('sidebar').classList.add('open');
    document.getElementById('sidebar-overlay').classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  };

  const closeSidebar = () => {
    document.getElementById('sidebar').classList.remove('open');
    document.getElementById('sidebar-overlay').classList.add('hidden');
    document.body.style.overflow = '';
  };

  // ─── REQUEST BADGE ────────────────────────────────────────────────────────────
  const loadRequestBadge = async () => {
    const role = currentUser?.role;
    if (role !== 'admin' && role !== 'teacher') return;
    try {
      const { count } = await ApiClient.requests.getCount();
      updateRequestBadge(count);
    } catch {}
  };

  return { init, navigate, currentUser: () => currentUser, showLoginTab, showSignupTab };
})();

// Global helper used by admin.js and teacher.js renderRequests
function updateRequestBadge(count) {
  const badge = document.getElementById('requests-badge');
  if (!badge) return;
  badge.textContent = count;
  badge.classList.toggle('hidden', count === 0);
}

// Boot up
document.addEventListener('DOMContentLoaded', App.init);
