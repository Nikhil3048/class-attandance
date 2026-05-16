const express = require('express');
const router = express.Router();
const { supabaseAdmin } = require('../config/supabase');
const { authenticate, requireRole } = require('../middleware/auth');

// ─── PUBLIC: Get classes list (for signup form, no auth needed) ───────────────
router.get('/classes', async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('classes').select('id, class_name').order('class_name');
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── PUBLIC: Submit a signup request ─────────────────────────────────────────
router.post('/', async (req, res) => {
  try {
    const { name, email, password, class_id, registration_number } = req.body;

    if (!name || !email || !password || !class_id || !registration_number) {
      return res.status(400).json({ error: 'name, email, password, class_id, and registration_number are required' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    // Check if email already has a pending request
    const { data: existing } = await supabaseAdmin
      .from('signup_requests')
      .select('id, status')
      .eq('email', email)
      .eq('status', 'pending')
      .maybeSingle();

    if (existing) {
      return res.status(409).json({ error: 'A signup request for this email is already pending review.' });
    }

    // Check email not already registered
    const { data: existingUser } = await supabaseAdmin
      .from('users').select('id').eq('email', email).maybeSingle();
    if (existingUser) {
      return res.status(409).json({ error: 'This email is already registered. Please sign in.' });
    }

    const { data, error } = await supabaseAdmin
      .from('signup_requests')
      .insert({ name, email, temp_password: password, class_id, registration_number, status: 'pending' })
      .select('id').single();

    if (error) throw error;

    res.status(201).json({
      message: 'Signup request submitted! An admin or teacher will review it shortly.',
      requestId: data.id
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
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
      // Only show requests for classes where this teacher has a subject
      const { data: subjects } = await supabaseAdmin
        .from('subjects').select('class_id').eq('teacher_id', req.user.id);
      const classIds = [...new Set((subjects || []).map(s => s.class_id))];
      if (classIds.length === 0) return res.json([]);
      query = query.in('class_id', classIds);
    } else if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { data, error } = await query;
    if (error) throw error;
    res.json(data);
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
      query = query.in('class_id', classIds);
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

    // Use registration number from the signup request itself
    const regNo = request.registration_number || `STU${Date.now().toString().slice(-6)}`;

    // 1. Create Supabase auth user
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: request.email,
      password: request.temp_password,
      email_confirm: true
    });
    if (authError) return res.status(400).json({ error: authError.message });

    // 2. Create users profile
    const { error: profileError } = await supabaseAdmin
      .from('users')
      .insert({ id: authData.user.id, name: request.name, email: request.email, role: 'student' });

    if (profileError) {
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      return res.status(400).json({ error: profileError.message });
    }

    // 3. Create student record
    const { error: studentError } = await supabaseAdmin
      .from('students')
      .insert({
        name: request.name,
        registration_number: regNo,
        class_id: request.class_id,
        user_id: authData.user.id
      });

    if (studentError) {
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      return res.status(400).json({ error: studentError.message });
    }

    // 4. Mark request as approved and clear password
    await supabaseAdmin
      .from('signup_requests')
      .update({
        status: 'approved',
        reviewed_by: req.user.id,
        reviewed_at: new Date().toISOString(),
        temp_password: ''  // clear stored password
      })
      .eq('id', id);

    res.json({ message: `${request.name} approved! Account created with reg. no. ${regNo}` });
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
      .from('signup_requests').select('id, status, name').eq('id', id).single();

    if (fetchError || !request) return res.status(404).json({ error: 'Request not found' });
    if (request.status !== 'pending') {
      return res.status(400).json({ error: `Request is already ${request.status}` });
    }

    await supabaseAdmin
      .from('signup_requests')
      .update({
        status: 'rejected',
        reviewed_by: req.user.id,
        reviewed_at: new Date().toISOString(),
        reject_reason: reason || null,
        temp_password: ''
      })
      .eq('id', id);

    res.json({ message: `${request.name}'s signup request has been rejected.` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
