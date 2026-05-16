/**
 * utils.js — Shared UI helpers for AttendanceIQ
 */

// ─── TOAST NOTIFICATIONS ──────────────────────────────────────────────────────
const Toast = {
  show(message, type = 'info', duration = 4000) {
    const icons = {
      success: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>`,
      error:   `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`,
      warning: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
      info:    `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`
    };

    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `${icons[type] || icons.info}<span class="toast-message">${message}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
      toast.classList.add('removing');
      setTimeout(() => toast.remove(), 300);
    }, duration);
  },
  success: (msg) => Toast.show(msg, 'success'),
  error:   (msg) => Toast.show(msg, 'error'),
  warning: (msg) => Toast.show(msg, 'warning'),
  info:    (msg) => Toast.show(msg, 'info')
};

// ─── MODAL HELPER ─────────────────────────────────────────────────────────────
const Modal = {
  overlay: null,
  modal: null,
  init() {
    this.overlay = document.getElementById('modal-overlay');
    this.modal = document.getElementById('modal');
    document.getElementById('modal-close').addEventListener('click', () => this.close());
    this.overlay.addEventListener('click', (e) => { if (e.target === this.overlay) this.close(); });
  },
  open(title, contentHTML) {
    document.getElementById('modal-title').textContent = title;
    document.getElementById('modal-body').innerHTML = contentHTML;
    this.overlay.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  },
  close() {
    this.overlay.classList.add('hidden');
    document.body.style.overflow = '';
  }
};

// ─── LOADING HELPERS ──────────────────────────────────────────────────────────
const setButtonLoading = (btn, isLoading, originalText = null) => {
  const textEl = btn.querySelector('.btn-text') || btn;
  const spinnerEl = btn.querySelector('.btn-spinner');
  if (isLoading) {
    btn.disabled = true;
    if (spinnerEl) spinnerEl.classList.remove('hidden');
    if (textEl !== btn) textEl.style.opacity = '0.5';
  } else {
    btn.disabled = false;
    if (spinnerEl) spinnerEl.classList.add('hidden');
    if (textEl !== btn) textEl.style.opacity = '1';
    if (originalText && textEl !== btn) textEl.textContent = originalText;
  }
};

const showPageLoading = (containerId) => {
  const el = document.getElementById(containerId);
  if (el) el.innerHTML = `
    <div style="display:flex;justify-content:center;align-items:center;padding:4rem;gap:1rem;color:var(--text-muted);">
      <div style="width:24px;height:24px;border:2px solid rgba(99,102,241,0.2);border-top-color:var(--accent);border-radius:50%;animation:spin 0.8s linear infinite;"></div>
      <span style="font-size:0.9rem;">Loading...</span>
    </div>`;
};

// ─── DATE HELPERS ─────────────────────────────────────────────────────────────
const formatDate = (dateStr) => {
  if (!dateStr) return '—';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

const todayISO = () => new Date().toISOString().split('T')[0];

const monthLabel = (monthStr) => {
  const [y, m] = monthStr.split('-');
  return new Date(+y, +m - 1, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
};

// ─── PERCENTAGE HELPERS ───────────────────────────────────────────────────────
const pctClass = (pct) => pct >= 75 ? 'good' : pct >= 60 ? 'warning' : 'danger';
const pctTextClass = (pct) => pct >= 75 ? 'pct-good' : pct >= 60 ? 'pct-warning' : 'pct-danger';

const progressBar = (pct) => `
  <div style="display:flex;align-items:center;gap:0.5rem;">
    <div class="progress-bar" style="flex:1;">
      <div class="progress-fill ${pctClass(pct)}" style="width:${pct}%;"></div>
    </div>
    <span style="font-size:0.8rem;font-weight:600;min-width:2.5rem;text-align:right;">${pct}%</span>
  </div>`;

// ─── CSV DOWNLOAD ─────────────────────────────────────────────────────────────
const downloadCSV = (filename, rows, headers) => {
  const escape = (val) => `"${String(val ?? '').replace(/"/g, '""')}"`;
  const csvContent = [
    headers.map(escape).join(','),
    ...rows.map(r => headers.map(h => escape(r[h])).join(','))
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
};

// ─── CONFIRM DIALOG ───────────────────────────────────────────────────────────
const confirmAction = (message) => window.confirm(message);

// ─── HTML ESCAPE ──────────────────────────────────────────────────────────────
const esc = (str) => String(str ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

// ─── NAV DEFINITIONS ─────────────────────────────────────────────────────────
const NAV_CONFIG = {
  admin: [
    { id: 'dashboard',  label: 'Dashboard',   icon: homeIcon() },
    { id: 'students',   label: 'Students',    icon: usersIcon() },
    { id: 'teachers',   label: 'Teachers',    icon: userCheckIcon() },
    { id: 'classes',    label: 'Classes',     icon: bookIcon() },
    { id: 'subjects',   label: 'Subjects',    icon: fileTextIcon() },
    { id: 'report',     label: 'Attendance Report', icon: barChartIcon() },
    { id: 'requests',   label: 'Signup Requests',   icon: bellIcon() },
  ],
  teacher: [
    { id: 'dashboard',    label: 'Dashboard',        icon: homeIcon() },
    { id: 'mark',         label: 'Mark Attendance',  icon: checkSquareIcon() },
    { id: 'history',      label: 'Attendance History',icon: calIcon() },
    { id: 'class-report', label: 'Class Report',     icon: barChartIcon() },
    { id: 'manage-students', label: 'Manage Students', icon: usersIcon() },
    { id: 'requests',        label: 'Signup Requests',  icon: bellIcon() },
  ],
  student: [
    { id: 'dashboard',  label: 'Dashboard',   icon: homeIcon() },
    { id: 'my-attendance', label: 'My Attendance', icon: calIcon() },
    { id: 'subject-wise',  label: 'Subject-wise',  icon: pieIcon() },
    { id: 'monthly',       label: 'Monthly Summary',icon: barChartIcon() },
  ]
};

// ─── SVG ICONS ────────────────────────────────────────────────────────────────
function homeIcon()      { return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>`; }
function usersIcon()     { return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>`; }
function userCheckIcon() { return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="8.5" cy="7" r="4"/><polyline points="17 11 19 13 23 9"/></svg>`; }
function bookIcon()      { return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/></svg>`; }
function fileTextIcon()  { return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><line x1="10" y1="9" x2="8" y2="9"/></svg>`; }
function barChartIcon()  { return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/><line x1="2" y1="20" x2="22" y2="20"/></svg>`; }
function checkSquareIcon(){ return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg>`; }
function calIcon()       { return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`; }
function pieIcon()       { return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.21 15.89A10 10 0 118 2.83"/><path d="M22 12A10 10 0 0012 2v10z"/></svg>`; }
function editIcon()      { return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`; }
function trashIcon()     { return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg>`; }
function plusIcon()      { return `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`; }
function downloadIcon()  { return `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>`; }
function terminalIcon()  { return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/></svg>`; }
function bellIcon()      { return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg>`; }
function checkIcon()     { return `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>`; }
function xIcon()         { return `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`; }
