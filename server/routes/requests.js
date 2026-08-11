const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { supabaseAdmin } = require('../config/supabase');
const { authenticate, requireRole } = require('../middleware/auth');
const { getSetting } = require('../config/settingsManager');

// Helper to encrypt/decrypt temporary sensitive data stored briefly in DB
const ENCRYPTION_KEY = crypto.scryptSync(
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.JWT_SECRET || 'AttendanceIQ-Secure-Secret-Key-2026',
  'attendance-iq-salt',
  32
);

function encryptText(text) {
  if (!text) return '';
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', ENCRYPTION_KEY, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const tag = cipher.getAuthTag().toString('hex');
  return `enc:${iv.toString('hex')}:${tag}:${encrypted}`;
}

function decryptText(encryptedText) {
  if (!encryptedText) return '';
  if (!encryptedText.startsWith('enc:')) return encryptedText; // Fallback for legacy plain records
  try {
    const parts = encryptedText.split(':');
    if (parts.length !== 4) return encryptedText;
    const iv = Buffer.from(parts[1], 'hex');
    const tag = Buffer.from(parts[2], 'hex');
    const encrypted = parts[3];
    const decipher = crypto.createDecipheriv('aes-256-gcm', ENCRYPTION_KEY, iv);
    decipher.setAuthTag(tag);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (err) {
    console.error('Decryption failed for signup request password:', err);
    return '';
  }
}

// ─── PUBLIC: Get classes list (for signup form, no auth needed) ───────────────
router.get('/classes', async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('classes').select('id, class_name').order('class_name');
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch classes' });
  }
});

// ─── PUBLIC: Submit a signup request ─────────────────────────────────────────
router.post('/', async (req, res) => {
  try {
    const { name, email, password, class_id, role, registration_number, subject_name, teacher_code, is_le } = req.body;

    if (!name || !email || !password || !class_id || !role) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const cleanEmail = String(email).trim().toLowerCase();
    const cleanName = String(name).trim();

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    if (password.length < 6 || password.length > 128) {
      return res.status(400).json({ error: 'Password must be between 6 and 128 characters' });
    }

    if (!['student', 'teacher'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role for signup request' });
    }

    if (role === 'teacher') {
      const expectedCode = await getSetting('teacher_signup_code', 'TeacherSecure2026!');
      const cleanInput = String(teacher_code || '').trim();
      const cleanExpected = String(expectedCode || '').trim();
      if (!cleanInput || cleanInput !== cleanExpected) {
        return res.status(403).json({ error: 'Invalid Teacher Signup Code' });
      }
    }

    // Check if email already has a pending request
    const { data: existing } = await supabaseAdmin
      .from('signup_requests')
      .select('id, status')
      .eq('email', cleanEmail)
      .eq('status', 'pending')
      .maybeSingle();

    if (existing) {
      return res.status(409).json({ error: 'A signup request for this email is already pending review.' });
    }

    // Check email not already registered
    const { data: existingUser } = await supabaseAdmin
      .from('users').select('id').eq('email', cleanEmail).maybeSingle();
    if (existingUser) {
      return res.status(409).json({ error: 'This email is already registered. Please sign in.' });
    }

    // Securely encrypt temporary password before storing
    const encryptedPassword = encryptText(password);

    const { data, error } = await supabaseAdmin
      .from('signup_requests')
      .insert({ 
        name: cleanName, 
        email: cleanEmail, 
        temp_password: encryptedPassword, 
        class_id, 
        role, 
        registration_number: registration_number ? String(registration_number).trim() : null, 
        is_le: role === 'student' ? Boolean(is_le) : false,
        subject_name: subject_name ? String(subject_name).trim() : null, 
        status: 'pending' 
      })
      .select('id').single();

    if (error) throw error;

    res.status(201).json({
      message: 'Signup request submitted! An admin or teacher will review it shortly.',
      requestId: data.id
    });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to submit signup request' });
  }
});

// ─── AUTH REQUIRED from here ─────────────────────────────────────────────────
router.use(authenticate);

// GET /api/requests — list requests (admin sees all, teacher sees their classes)
router.get('/', async (req, res) => {
  try {
    const { status } = req.query;

    let query = supabaseAdmin
      .from('signup_requests')
      .select('*, classes(class_name)')
      .order('created_at', { ascending: false });

    if (status) query = query.eq('status', status);

    if (req.user.role === 'teacher') {
      // Teachers ONLY see 'student' requests for their classes
      const { data: subjects } = await supabaseAdmin
        .from('subjects').select('class_id').eq('teacher_id', req.user.id);
      const classIds = [...new Set((subjects || []).map(s => s.class_id))];
      if (classIds.length === 0) return res.json([]);
      query = query.in('class_id', classIds).eq('role', 'student');
    } else if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { data, error } = await query;
    if (error) throw error;

    // Sanitize temp_password out of response so encrypted hashes are not sent to frontend
    const sanitizedData = (data || []).map(r => {
      const { temp_password, ...rest } = r;
      return rest;
    });

    res.json(sanitizedData);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/requests/count — pending count badge
router.get('/count', async (req, res) => {
  try {
    let query = supabaseAdmin
      .from('signup_requests')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending');

    if (req.user.role === 'teacher') {
      const { data: subjects } = await supabaseAdmin
        .from('subjects').select('class_id').eq('teacher_id', req.user.id);
      const classIds = [...new Set((subjects || []).map(s => s.class_id))];
      if (classIds.length === 0) return res.json({ count: 0 });
      query = query.in('class_id', classIds).eq('role', 'student');
    } else if (req.user.role !== 'admin') {
      return res.json({ count: 0 });
    }

    const { count, error } = await query;
    if (error) throw error;
    res.json({ count: count || 0 });
  } catch (err) {
    res.json({ count: 0 });
  }
});

// PUT /api/requests/:id/approve — approve a request
router.put('/:id/approve', requireRole('admin', 'teacher'), async (req, res) => {
  try {
    const { id } = req.params;

    const { data: request, error: fetchError } = await supabaseAdmin
      .from('signup_requests').select('*').eq('id', id).single();

    if (fetchError || !request) return res.status(404).json({ error: 'Request not found' });
    if (request.status !== 'pending') {
      return res.status(400).json({ error: `Request is already ${request.status}` });
    }

    const reqRole = request.role || 'student';

    // Teacher Scope Verification: Teachers can ONLY approve student requests for their classes
    if (req.user.role === 'teacher') {
      if (reqRole !== 'student') {
        return res.status(403).json({ error: 'Teachers can only approve student signup requests' });
      }
      const { data: subjects } = await supabaseAdmin
        .from('subjects').select('class_id').eq('teacher_id', req.user.id);
      const teacherClassIds = (subjects || []).map(s => s.class_id);
      if (!teacherClassIds.includes(request.class_id)) {
        return res.status(403).json({ error: 'You are not authorized to approve requests for this class' });
      }
    }

    // Decrypt stored temporary password
    const rawPassword = decryptText(request.temp_password);
    if (!rawPassword) {
      return res.status(400).json({ error: 'Unable to decrypt password for this request' });
    }

    // 1. Create Supabase auth user
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: request.email,
      password: rawPassword,
      email_confirm: true
    });
    if (authError) return res.status(400).json({ error: authError.message });

    // 2. Create users profile
    const { error: profileError } = await supabaseAdmin
      .from('users')
      .insert({ id: authData.user.id, name: request.name, email: request.email, role: reqRole });

    if (profileError) {
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      return res.status(400).json({ error: profileError.message });
    }

    let successMessage = '';

    if (reqRole === 'teacher') {
      // 3a. Create or Update Subject for Teacher
      const subjectName = request.subject_name || 'General';
      const { data: existingSubject } = await supabaseAdmin
        .from('subjects')
        .select('id')
        .eq('class_id', request.class_id)
        .ilike('subject_name', subjectName)
        .maybeSingle();

      if (existingSubject) {
        await supabaseAdmin.from('subjects')
          .update({ teacher_id: authData.user.id })
          .eq('id', existingSubject.id);
      } else {
        await supabaseAdmin.from('subjects')
          .insert({ 
            subject_name: subjectName, 
            class_id: request.class_id, 
            teacher_id: authData.user.id 
          });
      }
      successMessage = `${request.name} approved as a Teacher for ${subjectName}!`;
    } else {
      // 3b. Create student record
      const regNo = request.registration_number || `STU${Date.now().toString().slice(-6)}`;
      const { error: studentError } = await supabaseAdmin
        .from('students')
        .insert({
          name: request.name,
          registration_number: regNo,
          class_id: request.class_id,
          user_id: authData.user.id,
          is_le: Boolean(request.is_le)
        });

      if (studentError) {
        await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
        return res.status(400).json({ error: studentError.message });
      }
      successMessage = `${request.name} approved! Account created with reg. no. ${regNo}`;
    }

    // 4. Mark request as approved and clear password completely
    await supabaseAdmin
      .from('signup_requests')
      .update({
        status: 'approved',
        reviewed_by: req.user.id,
        reviewed_at: new Date().toISOString(),
        temp_password: ''  // clear temporary password
      })
      .eq('id', id);

    res.json({ message: successMessage });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/requests/:id/reject — reject a request
router.put('/:id/reject', requireRole('admin', 'teacher'), async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const { data: request, error: fetchError } = await supabaseAdmin
      .from('signup_requests').select('id, class_id, role, status, name').eq('id', id).single();

    if (fetchError || !request) return res.status(404).json({ error: 'Request not found' });
    if (request.status !== 'pending') {
      return res.status(400).json({ error: `Request is already ${request.status}` });
    }

    // Teacher Scope Verification: Teachers can ONLY reject student requests for their classes
    if (req.user.role === 'teacher') {
      if (request.role !== 'student') {
        return res.status(403).json({ error: 'Teachers can only review student signup requests' });
      }
      const { data: subjects } = await supabaseAdmin
        .from('subjects').select('class_id').eq('teacher_id', req.user.id);
      const teacherClassIds = (subjects || []).map(s => s.class_id);
      if (!teacherClassIds.includes(request.class_id)) {
        return res.status(403).json({ error: 'You are not authorized to reject requests for this class' });
      }
    }

    await supabaseAdmin
      .from('signup_requests')
      .update({
        status: 'rejected',
        reviewed_by: req.user.id,
        reviewed_at: new Date().toISOString(),
        reject_reason: reason ? String(reason).trim() : null,
        temp_password: '' // clear temporary password
      })
      .eq('id', id);

    res.json({ message: `${request.name}'s signup request has been rejected.` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
