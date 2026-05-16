/**
 * sql-editor.js — Admin-only SQL Editor page for AttendanceIQ
 * Features: syntax highlighting, query execution, schema browser, history, snippets
 */

const SqlEditorPage = (() => {
  let queryHistory = JSON.parse(localStorage.getItem('sql_history') || '[]');
  let schemaTables = [];
  let currentResults = [];
  let currentColumns = [];

  // ─── QUERY SNIPPETS ───────────────────────────────────────────────────────────
  const SNIPPETS = [
    {
      label: 'All Users',
      icon: '👥',
      sql: `SELECT id, name, email, role, created_at\nFROM users\nORDER BY name;`
    },
    {
      label: 'All Classes',
      icon: '🏫',
      sql: `SELECT id, class_name, created_at\nFROM classes\nORDER BY class_name;`
    },
    {
      label: 'All Students',
      icon: '🎓',
      sql: `SELECT s.id, s.name, s.registration_number,\n       c.class_name, s.created_at\nFROM students s\nJOIN classes c ON c.id = s.class_id\nORDER BY s.name;`
    },
    {
      label: 'All Subjects',
      icon: '📚',
      sql: `SELECT sub.id, sub.subject_name,\n       c.class_name,\n       u.name AS teacher_name\nFROM subjects sub\nJOIN classes c ON c.id = sub.class_id\nLEFT JOIN users u ON u.id = sub.teacher_id\nORDER BY sub.subject_name;`
    },
    {
      label: 'Attendance Today',
      icon: '📋',
      sql: `SELECT a.date, a.status,\n       s.name AS student_name,\n       sub.subject_name\nFROM attendance a\nJOIN students s ON s.id = a.student_id\nJOIN subjects sub ON sub.id = a.subject_id\nWHERE a.date = CURRENT_DATE\nORDER BY a.date DESC;`
    },
    {
      label: 'Attendance Summary',
      icon: '📊',
      sql: `SELECT s.name AS student_name,\n       sub.subject_name,\n       COUNT(*) FILTER (WHERE a.status = 'present') AS present,\n       COUNT(*) FILTER (WHERE a.status = 'absent') AS absent,\n       COUNT(*) AS total,\n       ROUND(\n         100.0 * COUNT(*) FILTER (WHERE a.status = 'present') / COUNT(*), 1\n       ) AS percentage\nFROM attendance a\nJOIN students s ON s.id = a.student_id\nJOIN subjects sub ON sub.id = a.subject_id\nGROUP BY s.name, sub.subject_name\nORDER BY s.name, sub.subject_name;`
    },
    {
      label: 'Low Attendance (<75%)',
      icon: '⚠️',
      sql: `SELECT s.name AS student_name,\n       sub.subject_name,\n       ROUND(\n         100.0 * COUNT(*) FILTER (WHERE a.status = 'present') / COUNT(*), 1\n       ) AS attendance_pct\nFROM attendance a\nJOIN students s ON s.id = a.student_id\nJOIN subjects sub ON sub.id = a.subject_id\nGROUP BY s.name, sub.subject_name\nHAVING ROUND(\n  100.0 * COUNT(*) FILTER (WHERE a.status = 'present') / COUNT(*), 1\n) < 75\nORDER BY attendance_pct ASC;`
    },
    {
      label: 'Recent Records',
      icon: '🕐',
      sql: `SELECT a.date, a.status,\n       s.name AS student,\n       sub.subject_name AS subject,\n       u.name AS marked_by\nFROM attendance a\nJOIN students s ON s.id = a.student_id\nJOIN subjects sub ON sub.id = a.subject_id\nLEFT JOIN users u ON u.id = a.marked_by\nORDER BY a.created_at DESC\nLIMIT 50;`
    }
  ];

  // ─── RENDER ───────────────────────────────────────────────────────────────────
  const render = () => {
    const content = document.getElementById('page-content');
    document.getElementById('page-title').textContent = 'SQL Editor';

    content.innerHTML = `
      <div class="sql-editor-layout">

        <!-- LEFT PANEL: Schema Browser -->
        <aside class="sql-sidebar">
          <div class="sql-sidebar-section">
            <div class="sql-sidebar-header">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>
              Schema Browser
            </div>
            <div id="schema-browser">
              <div class="schema-loading">
                <div class="mini-spinner"></div> Loading schema…
              </div>
            </div>
          </div>

          <div class="sql-sidebar-section">
            <div class="sql-sidebar-header">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
              Quick Snippets
            </div>
            <div class="snippet-list">
              ${SNIPPETS.map((s, i) => `
                <button class="snippet-btn" onclick="SqlEditorPage.loadSnippet(${i})" title="${esc(s.label)}">
                  <span class="snippet-icon">${s.icon}</span>
                  <span class="snippet-label">${esc(s.label)}</span>
                </button>`).join('')}
            </div>
          </div>
        </aside>

        <!-- RIGHT PANEL: Editor + Results -->
        <div class="sql-main">

          <!-- Editor toolbar -->
          <div class="sql-toolbar">
            <div class="sql-toolbar-left">
              <button id="sql-run-btn" class="btn btn-primary sql-run-btn" onclick="SqlEditorPage.executeQuery()">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                <span class="btn-text">Run Query</span>
                <span class="btn-spinner hidden"></span>
              </button>
              <button class="btn btn-ghost sql-toolbar-btn" onclick="SqlEditorPage.formatQuery()" title="Format SQL">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="15" y2="12"/><line x1="3" y1="18" x2="9" y2="18"/></svg>
                Format
              </button>
              <button class="btn btn-ghost sql-toolbar-btn" onclick="SqlEditorPage.clearEditor()" title="Clear editor">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 6H5l1.5 14.5h11L19 6z"/><path d="M8.5 6V4a.5.5 0 01.5-.5h6a.5.5 0 01.5.5v2"/></svg>
                Clear
              </button>
            </div>
            <div class="sql-toolbar-right">
              <span id="sql-status-badge" class="sql-status-badge"></span>
              <button class="btn btn-ghost sql-toolbar-btn" onclick="SqlEditorPage.showHistory()" title="Query history">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                History
              </button>
              <button id="sql-export-btn" class="btn btn-ghost sql-toolbar-btn hidden" onclick="SqlEditorPage.exportCSV()">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                Export CSV
              </button>
            </div>
          </div>

          <!-- Keyboard shortcut hint -->
          <div class="sql-shortcut-hint">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M6 8h.01M10 8h.01M14 8h.01M18 8h.01M8 12h.01M12 12h.01M16 12h.01M7 16h10"/></svg>
            Press <kbd>Ctrl+Enter</kbd> to run
          </div>

          <!-- Code Editor -->
          <div class="sql-editor-container">
            <div class="sql-line-numbers" id="sql-line-numbers">1</div>
            <textarea
              id="sql-editor"
              class="sql-editor"
              placeholder="-- Write your SQL here…&#10;SELECT * FROM users LIMIT 10;"
              spellcheck="false"
              autocomplete="off"
              autocorrect="off"
              autocapitalize="off"
            ></textarea>
          </div>

          <!-- Results Panel -->
          <div class="sql-results-panel" id="sql-results-panel">
            <div class="sql-results-empty">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>
              <p>Run a query to see results</p>
            </div>
          </div>
        </div>
      </div>
    `;

    initEditor();
    loadSchema();
  };

  // ─── EDITOR INIT ──────────────────────────────────────────────────────────────
  const initEditor = () => {
    const editor = document.getElementById('sql-editor');
    const lineNums = document.getElementById('sql-line-numbers');

    // Set default query
    editor.value = `-- Welcome to AttendanceIQ SQL Editor\n-- Tip: Use Ctrl+Enter to run your query\n\nSELECT * FROM users\nLIMIT 10;`;
    updateLineNumbers();

    editor.addEventListener('input', () => {
      updateLineNumbers();
      syncScroll();
    });

    editor.addEventListener('scroll', syncScroll);

    editor.addEventListener('keydown', (e) => {
      // Ctrl+Enter → Run
      if (e.ctrlKey && e.key === 'Enter') {
        e.preventDefault();
        executeQuery();
        return;
      }
      // Tab → Insert 2 spaces
      if (e.key === 'Tab') {
        e.preventDefault();
        const start = editor.selectionStart;
        const end = editor.selectionEnd;
        editor.value = editor.value.slice(0, start) + '  ' + editor.value.slice(end);
        editor.selectionStart = editor.selectionEnd = start + 2;
        updateLineNumbers();
      }
    });

    function updateLineNumbers() {
      const lines = editor.value.split('\n').length;
      lineNums.innerHTML = Array.from({length: lines}, (_, i) => i + 1).join('<br>');
    }

    function syncScroll() {
      lineNums.scrollTop = editor.scrollTop;
    }
  };

  // ─── SCHEMA BROWSER ───────────────────────────────────────────────────────────
  const loadSchema = async () => {
    try {
      const data = await ApiClient.get('/sql-editor/tables');
      schemaTables = data.tables || [];
      renderSchema();
    } catch (err) {
      document.getElementById('schema-browser').innerHTML =
        `<div class="schema-error">⚠ ${esc(err.message)}</div>`;
    }
  };

  const renderSchema = () => {
    const el = document.getElementById('schema-browser');
    if (!schemaTables.length) {
      el.innerHTML = `<div class="schema-error">No tables found</div>`;
      return;
    }

    el.innerHTML = schemaTables.map(t => `
      <div class="schema-table">
        <div class="schema-table-header" onclick="SqlEditorPage.toggleSchemaTable('${esc(t.table_name)}')">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="schema-chevron" id="chev-${esc(t.table_name)}"><polyline points="9 18 15 12 9 6"/></svg>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18"/></svg>
          <span class="schema-table-name">${esc(t.table_name)}</span>
          <span class="schema-col-count">${t.column_count || (t.columns || []).length} cols</span>
        </div>
        <div class="schema-columns hidden" id="schema-cols-${esc(t.table_name)}">
          ${(t.columns || []).map(c => `
            <div class="schema-column" onclick="SqlEditorPage.insertColumnName('${esc(c.column_name)}')">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="1"/></svg>
              <span class="col-name">${esc(c.column_name)}</span>
              <span class="col-type">${esc(c.data_type || '')}</span>
            </div>`).join('')}
          ${!(t.columns || []).length ? `<div class="schema-column no-cols">No column info</div>` : ''}
          <button class="schema-quick-select" onclick="SqlEditorPage.quickSelect('${esc(t.table_name)}')">
            SELECT * FROM ${esc(t.table_name)} LIMIT 10
          </button>
        </div>
      </div>
    `).join('');
  };

  const toggleSchemaTable = (tableName) => {
    const cols = document.getElementById(`schema-cols-${tableName}`);
    const chev = document.getElementById(`chev-${tableName}`);
    if (cols) {
      cols.classList.toggle('hidden');
      if (chev) chev.style.transform = cols.classList.contains('hidden') ? '' : 'rotate(90deg)';
    }
  };

  const insertColumnName = (colName) => {
    const editor = document.getElementById('sql-editor');
    const pos = editor.selectionStart;
    editor.value = editor.value.slice(0, pos) + colName + editor.value.slice(pos);
    editor.selectionStart = editor.selectionEnd = pos + colName.length;
    editor.focus();
  };

  const quickSelect = (tableName) => {
    const editor = document.getElementById('sql-editor');
    editor.value = `SELECT *\nFROM ${tableName}\nLIMIT 10;`;
    editor.focus();
    executeQuery();
  };

  // ─── EXECUTE QUERY ────────────────────────────────────────────────────────────
  const executeQuery = async () => {
    const editor = document.getElementById('sql-editor');
    const sql = editor.value.trim();

    if (!sql || sql.startsWith('--')) {
      Toast.warning('Please enter a SQL query to run.');
      return;
    }

    const btn = document.getElementById('sql-run-btn');
    const panel = document.getElementById('sql-results-panel');
    const badge = document.getElementById('sql-status-badge');

    setButtonLoading(btn, true);
    badge.textContent = '';
    badge.className = 'sql-status-badge';

    panel.innerHTML = `
      <div class="sql-results-loading">
        <div class="mini-spinner"></div>
        <span>Executing query…</span>
      </div>`;

    try {
      const result = await ApiClient.post('/sql-editor/execute', { sql });

      // Save to history
      addToHistory(sql, result.rowCount, result.duration, false);

      currentResults = result.data || [];
      currentColumns = result.columns || [];

      renderResults(result);

      badge.textContent = `${result.rowCount} row${result.rowCount !== 1 ? 's' : ''} · ${result.duration}ms`;
      badge.className = 'sql-status-badge badge-success';

      if (result.isDangerous) {
        Toast.warning('⚠ Dangerous query executed. Check results carefully.');
      }

      // Show export button
      if (currentResults.length > 0) {
        document.getElementById('sql-export-btn').classList.remove('hidden');
      }

    } catch (err) {
      addToHistory(sql, 0, 0, true);
      renderError(err.message);
      badge.textContent = 'Error';
      badge.className = 'sql-status-badge badge-error';
    } finally {
      setButtonLoading(btn, false);
    }
  };

  // ─── RENDER RESULTS ───────────────────────────────────────────────────────────
  const renderResults = (result) => {
    const panel = document.getElementById('sql-results-panel');

    if (!result.data || result.data.length === 0) {
      panel.innerHTML = `
        <div class="sql-results-info">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
          <span>Query executed successfully. ${result.rowCount === 0 ? 'No rows returned.' : `${result.rowCount} rows affected.`}</span>
        </div>`;
      return;
    }

    const cols = result.columns;
    const rows = result.data;

    panel.innerHTML = `
      <div class="sql-results-meta">
        <span class="results-count">${rows.length} row${rows.length !== 1 ? 's' : ''}</span>
        <span class="results-time">${result.duration}ms</span>
      </div>
      <div class="sql-table-wrapper">
        <table class="sql-results-table">
          <thead>
            <tr>
              <th class="row-num-col">#</th>
              ${cols.map(c => `<th title="${esc(c)}">${esc(c)}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${rows.map((row, i) => `
              <tr>
                <td class="row-num-col">${i + 1}</td>
                ${cols.map(c => `<td class="${getCellClass(row[c])}" title="${esc(String(row[c] ?? ''))}">${formatCell(row[c])}</td>`).join('')}
              </tr>`).join('')}
          </tbody>
        </table>
      </div>
    `;
  };

  const renderError = (message) => {
    const panel = document.getElementById('sql-results-panel');
    panel.innerHTML = `
      <div class="sql-error-panel">
        <div class="sql-error-icon">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
        </div>
        <div class="sql-error-content">
          <p class="sql-error-title">Query Error</p>
          <p class="sql-error-msg">${esc(message)}</p>
          ${message.includes('run_sql') ? `
            <div class="sql-error-hint">
              <strong>Setup Required:</strong> Create this helper function in your Supabase SQL Editor:
              <pre class="setup-code">CREATE OR REPLACE FUNCTION run_sql(query text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result jsonb;
BEGIN
  EXECUTE 'SELECT jsonb_agg(row_to_json(t)) FROM (' || query || ') t' INTO result;
  RETURN COALESCE(result, '[]'::jsonb);
END;
$$;</pre>
            </div>` : ''}
        </div>
      </div>`;
  };

  // ─── CELL FORMATTING ──────────────────────────────────────────────────────────
  const formatCell = (val) => {
    if (val === null || val === undefined) return `<span class="cell-null">NULL</span>`;
    if (typeof val === 'boolean') return `<span class="cell-bool cell-bool-${val}">${val}</span>`;
    const str = String(val);
    // Truncate long values
    if (str.length > 80) return `<span title="${esc(str)}">${esc(str.slice(0, 80))}…</span>`;
    return esc(str);
  };

  const getCellClass = (val) => {
    if (val === null || val === undefined) return 'cell-null-col';
    if (typeof val === 'boolean') return 'cell-bool-col';
    if (typeof val === 'number') return 'cell-num-col';
    return '';
  };

  // ─── HISTORY ──────────────────────────────────────────────────────────────────
  const addToHistory = (sql, rows, duration, isError) => {
    queryHistory.unshift({ sql, rows, duration, isError, ts: Date.now() });
    if (queryHistory.length > 50) queryHistory = queryHistory.slice(0, 50);
    localStorage.setItem('sql_history', JSON.stringify(queryHistory));
  };

  const showHistory = () => {
    if (!queryHistory.length) {
      Toast.info('No query history yet.');
      return;
    }

    const html = `
      <div class="history-list">
        ${queryHistory.slice(0, 20).map((h, i) => `
          <div class="history-item ${h.isError ? 'history-error' : ''}">
            <div class="history-meta">
              <span class="history-time">${new Date(h.ts).toLocaleTimeString()}</span>
              <span class="history-rows">${h.isError ? '❌ Error' : `✓ ${h.rows} rows · ${h.duration}ms`}</span>
            </div>
            <pre class="history-sql">${esc(h.sql.slice(0, 200))}${h.sql.length > 200 ? '…' : ''}</pre>
            <button class="btn btn-sm btn-ghost" onclick="SqlEditorPage.loadHistoryItem(${i}); Modal.close();">
              Load this query
            </button>
          </div>`).join('')}
      </div>`;

    Modal.open('Query History', html);
  };

  const loadHistoryItem = (index) => {
    const item = queryHistory[index];
    if (!item) return;
    document.getElementById('sql-editor').value = item.sql;
  };

  // ─── SNIPPETS ─────────────────────────────────────────────────────────────────
  const loadSnippet = (index) => {
    const snippet = SNIPPETS[index];
    if (!snippet) return;
    document.getElementById('sql-editor').value = snippet.sql;
    document.getElementById('sql-editor').focus();
    Toast.info(`Loaded: ${snippet.label}`);
  };

  // ─── FORMAT ───────────────────────────────────────────────────────────────────
  const formatQuery = () => {
    const editor = document.getElementById('sql-editor');
    let sql = editor.value;
    // Basic SQL formatter
    const keywords = ['SELECT', 'FROM', 'WHERE', 'JOIN', 'LEFT JOIN', 'RIGHT JOIN', 'INNER JOIN',
      'ON', 'AND', 'OR', 'ORDER BY', 'GROUP BY', 'HAVING', 'LIMIT', 'OFFSET',
      'INSERT INTO', 'VALUES', 'UPDATE', 'SET', 'DELETE FROM', 'CREATE TABLE',
      'ALTER TABLE', 'DROP TABLE', 'WITH', 'UNION', 'UNION ALL'];

    keywords.forEach(kw => {
      const regex = new RegExp(`\\b${kw}\\b`, 'gi');
      sql = sql.replace(regex, '\n' + kw);
    });

    // Clean up multiple newlines
    sql = sql.replace(/\n{3,}/g, '\n\n').trim();
    editor.value = sql;
    Toast.info('Query formatted');
  };

  // ─── CLEAR ────────────────────────────────────────────────────────────────────
  const clearEditor = () => {
    document.getElementById('sql-editor').value = '';
    document.getElementById('sql-results-panel').innerHTML = `
      <div class="sql-results-empty">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>
        <p>Run a query to see results</p>
      </div>`;
    document.getElementById('sql-status-badge').textContent = '';
    document.getElementById('sql-export-btn').classList.add('hidden');
    currentResults = [];
    currentColumns = [];
  };

  // ─── EXPORT CSV ───────────────────────────────────────────────────────────────
  const exportCSV = () => {
    if (!currentResults.length) {
      Toast.warning('No results to export.');
      return;
    }
    const filename = `query-result-${new Date().toISOString().slice(0,10)}.csv`;
    downloadCSV(filename, currentResults, currentColumns);
    Toast.success('CSV downloaded!');
  };

  // ─── PUBLIC API ───────────────────────────────────────────────────────────────
  return {
    render,
    executeQuery,
    formatQuery,
    clearEditor,
    exportCSV,
    showHistory,
    loadHistoryItem,
    loadSnippet,
    toggleSchemaTable,
    insertColumnName,
    quickSelect
  };
})();
