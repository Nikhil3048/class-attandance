const express = require('express');
const router = express.Router();
const { supabaseAdmin } = require('../config/supabase');
const { authenticate, requireRole } = require('../middleware/auth');

// All admin routes require authentication and admin role
router.use(authenticate, requireRole('admin'));

// ─── USERS (Teachers & Students) ─────────────────────────────────────────────

/**
 * GET /api/admin/users
 * Get all users (optionally filter by role)
 */
router.get('/users', async (req, res) => {
  try {
    const { role } = req.query;
    let query = supabaseAdmin.from('users').select('id, name, email, role').order('name');
    if (role) query = query.eq('role', role);
    const { data, error } = await query;
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/admin/users
 * Create a new user (teacher or student account)
 */
router.post('/users', async (req, res) => {
  try {
    const { email, password, name, role } = req.body;
    if (!email || !password || !name || !role) {
      return res.status(400).json({ error: 'email, password, name, and role are required' });
    }
    const validRoles = ['teacher', 'student', 'admin'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email, password, email_confirm: true
    });
    if (authError) return res.status(400).json({ error: authError.message });

    const { error: profileError } = await supabaseAdmin
      .from('users').insert({ id: authData.user.id, name, email, role });

    if (profileError) {
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      return res.status(400).json({ error: profileError.message });
    }

    res.status(201).json({ message: 'User created successfully', userId: authData.user.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * PUT /api/admin/users/:id
 * Update user name, email, or role
 */
router.put('/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, role } = req.body;
    const updates = {};
    if (name) updates.name = name;
    if (email) updates.email = email;
    if (role) updates.role = role;

    const { error } = await supabaseAdmin.from('users').update(updates).eq('id', id);
    if (error) throw error;
    res.json({ message: 'User updated successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * DELETE /api/admin/users/:id
 * Delete a user account
 */
router.delete('/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { error: profileError } = await supabaseAdmin.from('users').delete().eq('id', id);
    if (profileError) throw profileError;
    const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(id);
    if (authError) throw authError;
    res.json({ message: 'User deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── CLASSES ──────────────────────────────────────────────────────────────────

router.get('/classes', async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('classes').select('*').order('class_name');
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/classes', async (req, res) => {
  try {
    const { class_name } = req.body;
    if (!class_name) return res.status(400).json({ error: 'class_name is required' });
    const { data, error } = await supabaseAdmin
      .from('classes').insert({ class_name }).select().single();
    if (error) throw error;
    res.status(201).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/classes/:id', async (req, res) => {
  try {
    const { class_name } = req.body;
    const { error } = await supabaseAdmin
      .from('classes').update({ class_name }).eq('id', req.params.id);
    if (error) throw error;
    res.json({ message: 'Class updated successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/classes/:id', async (req, res) => {
  try {
    const { error } = await supabaseAdmin.from('classes').delete().eq('id', req.params.id);
    if (error) throw error;
    res.json({ message: 'Class deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── SUBJECTS ─────────────────────────────────────────────────────────────────

router.get('/subjects', async (req, res) => {
  try {
    const { class_id } = req.query;
    let query = supabaseAdmin
      .from('subjects')
      .select('*, classes(class_name), users(id, name)')
      .order('subject_name');
    if (class_id) query = query.eq('class_id', class_id);
    const { data, error } = await query;
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/subjects', async (req, res) => {
  try {
    const { subject_name, class_id, teacher_id } = req.body;
    if (!subject_name || !class_id) {
      return res.status(400).json({ error: 'subject_name and class_id are required' });
    }
    const { data, error } = await supabaseAdmin
      .from('subjects').insert({ subject_name, class_id, teacher_id: teacher_id || null }).select().single();
    if (error) throw error;
    res.status(201).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/subjects/:id', async (req, res) => {
  try {
    const { subject_name, class_id, teacher_id } = req.body;
    const updates = {};
    if (subject_name) updates.subject_name = subject_name;
    if (class_id) updates.class_id = class_id;
    if (teacher_id !== undefined) updates.teacher_id = teacher_id;
    const { error } = await supabaseAdmin.from('subjects').update(updates).eq('id', req.params.id);
    if (error) throw error;
    res.json({ message: 'Subject updated successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/subjects/:id', async (req, res) => {
  try {
    const { error } = await supabaseAdmin.from('subjects').delete().eq('id', req.params.id);
    if (error) throw error;
    res.json({ message: 'Subject deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── STUDENTS ─────────────────────────────────────────────────────────────────

router.get('/students', async (req, res) => {
  try {
    const { class_id, search } = req.query;
    let query = supabaseAdmin
      .from('students')
      .select('*, classes(class_name)')
      .order('name');
    if (class_id) query = query.eq('class_id', class_id);
    if (search) query = query.or(`name.ilike.%${search}%,registration_number.ilike.%${search}%`);
    const { data, error } = await query;
    if (error) throw error;

    // Sort by last 3 digits of registration number
    const sortedData = data.sort((a, b) => {
      const regA = String(a.registration_number || '').trim();
      const regB = String(b.registration_number || '').trim();
      
      const matchA = regA.match(/\d{3}$/);
      const matchB = regB.match(/\d{3}$/);
      
      const numA = matchA ? parseInt(matchA[0], 10) : 999;
      const numB = matchB ? parseInt(matchB[0], 10) : 999;
      
      if (numA !== numB) {
        return numA - numB;
      }
      return a.name.localeCompare(b.name);
    });

    res.json(sortedData);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/students', async (req, res) => {
  try {
    const { name, registration_number, class_id, user_id } = req.body;
    if (!name || !registration_number || !class_id) {
      return res.status(400).json({ error: 'name, registration_number, and class_id are required' });
    }
    const { data, error } = await supabaseAdmin
      .from('students')
      .insert({ name, registration_number, class_id, user_id: user_id || null })
      .select().single();
    if (error) throw error;
    res.status(201).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/students/:id', async (req, res) => {
  try {
    const { name, registration_number, class_id } = req.body;
    const updates = {};
    if (name) updates.name = name;
    if (registration_number) updates.registration_number = registration_number;
    if (class_id) updates.class_id = class_id;
    const { error } = await supabaseAdmin.from('students').update(updates).eq('id', req.params.id);
    if (error) throw error;
    res.json({ message: 'Student updated successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/students/:id', async (req, res) => {
  try {
    const { error } = await supabaseAdmin.from('students').delete().eq('id', req.params.id);
    if (error) throw error;
    res.json({ message: 'Student deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── OVERALL ATTENDANCE REPORT ────────────────────────────────────────────────

router.get('/attendance/report', async (req, res) => {
  try {
    const { class_id, subject_id, from_date, to_date } = req.query;
    let query = supabaseAdmin
      .from('attendance')
      .select('*, students(name, registration_number, class_id, classes(class_name)), subjects(subject_name)');

    if (subject_id) query = query.eq('subject_id', subject_id);
    if (from_date) query = query.gte('date', from_date);
    if (to_date) query = query.lte('date', to_date);

    const { data, error } = await query.order('date', { ascending: false });
    if (error) throw error;

    // Filter by class_id if provided
    let filteredData = data;
    if (class_id) {
      filteredData = data.filter(r => r.students?.class_id === class_id);
    }

    res.json(filteredData);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── SETTINGS ─────────────────────────────────────────────────────────────────

const fs = require('fs');
const path = require('path');

function updateEnvFile(key, value) {
  try {
    const envPath = path.join(__dirname, '../../.env');
    if (fs.existsSync(envPath)) {
      let content = fs.readFileSync(envPath, 'utf8');
      const regex = new RegExp(`^${key}=.*`, 'm');
      if (regex.test(content)) {
        content = content.replace(regex, `${key}=${value}`);
      } else {
        content += `\n${key}=${value}`;
      }
      fs.writeFileSync(envPath, content, 'utf8');
      process.env[key] = value; // update in-memory too
    }
  } catch (err) {
    console.error('Failed to write to .env:', err);
  }
}

/**
 * GET /api/admin/settings/teacher-signup-code
 */
router.get('/settings/teacher-signup-code', async (req, res) => {
  try {
    let dbValue = null;
    try {
      const { data, error } = await supabaseAdmin
        .from('settings')
        .select('value')
        .eq('key', 'teacher_signup_code')
        .maybeSingle();
      if (!error && data) {
        dbValue = data.value;
      }
    } catch (e) {
      // settings table might not exist
    }

    const value = dbValue || process.env.TEACHER_SIGNUP_CODE || 'TeacherSecure2026!';
    res.json({ code: value });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/admin/settings/teacher-signup-code
 */
router.post('/settings/teacher-signup-code', async (req, res) => {
  try {
    const { code } = req.body;
    if (!code) {
      return res.status(400).json({ error: 'code is required' });
    }

    // Try DB first
    let dbSuccess = false;
    let dbErrorMsg = '';
    try {
      const { error } = await supabaseAdmin
        .from('settings')
        .upsert({ key: 'teacher_signup_code', value: code });
      if (!error) {
        dbSuccess = true;
      } else {
        dbErrorMsg = error.message;
      }
    } catch (e) {
      dbErrorMsg = e.message;
    }

    // Also update .env file
    updateEnvFile('TEACHER_SIGNUP_CODE', code);

    res.json({ 
      message: 'Teacher signup code updated successfully',
      dbSuccess,
      dbWarning: dbSuccess ? null : `Note: Settings table update failed (${dbErrorMsg}). Updated .env config instead.`
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
