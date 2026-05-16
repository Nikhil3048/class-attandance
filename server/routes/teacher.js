const express = require('express');
const router = express.Router();
const { supabaseAdmin } = require('../config/supabase');
const { authenticate, requireRole } = require('../middleware/auth');

router.use(authenticate, requireRole('teacher', 'admin'));

// GET /api/teacher/subjects
router.get('/subjects', async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('subjects')
      .select('*, classes(class_name, id)')
      .eq('teacher_id', req.user.id)
      .order('subject_name');
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/teacher/students/:subjectId — students in subject's class
router.get('/students/:subjectId', async (req, res) => {
  try {
    const { subjectId } = req.params;
    const { data: subject, error: subjectError } = await supabaseAdmin
      .from('subjects').select('class_id').eq('id', subjectId).single();
    if (subjectError) throw subjectError;

    const { data: students, error: studentsError } = await supabaseAdmin
      .from('students')
      .select('id, name, registration_number')
      .eq('class_id', subject.class_id)
      .order('name');
    if (studentsError) throw studentsError;

    // Sort by last 3 digits of registration number
    const sortedData = students.sort((a, b) => {
      const regA = String(a.registration_number || '').trim();
      const regB = String(b.registration_number || '').trim();
      const matchA = regA.match(/\d{3}$/);
      const matchB = regB.match(/\d{3}$/);
      const numA = matchA ? parseInt(matchA[0], 10) : 999;
      const numB = matchB ? parseInt(matchB[0], 10) : 999;
      if (numA !== numB) return numA - numB;
      return a.name.localeCompare(b.name);
    });

    res.json(sortedData);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/teacher/class/:classId/students — manage students in a class
router.get('/class/:classId/students', async (req, res) => {
  try {
    const { classId } = req.params;
    const { data, error } = await supabaseAdmin
      .from('students')
      .select('id, name, registration_number, user_id, created_at')
      .eq('class_id', classId)
      .order('name');
    if (error) throw error;

    // Sort by last 3 digits of registration number
    const sortedData = data.sort((a, b) => {
      const regA = String(a.registration_number || '').trim();
      const regB = String(b.registration_number || '').trim();
      const matchA = regA.match(/\d{3}$/);
      const matchB = regB.match(/\d{3}$/);
      const numA = matchA ? parseInt(matchA[0], 10) : 999;
      const numB = matchB ? parseInt(matchB[0], 10) : 999;
      if (numA !== numB) return numA - numB;
      return a.name.localeCompare(b.name);
    });

    res.json(sortedData);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/teacher/class/:classId/students — add student (with optional login)
router.post('/class/:classId/students', async (req, res) => {
  try {
    const { classId } = req.params;
    const { name, registration_number, create_login, email, password } = req.body;

    if (!name || !registration_number) {
      return res.status(400).json({ error: 'name and registration_number are required' });
    }

    let user_id = null;

    if (create_login && email && password) {
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email, password, email_confirm: true
      });
      if (authError) return res.status(400).json({ error: authError.message });

      const { error: profileError } = await supabaseAdmin
        .from('users')
        .insert({ id: authData.user.id, name, email, role: 'student' });

      if (profileError) {
        await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
        return res.status(400).json({ error: profileError.message });
      }
      user_id = authData.user.id;
    }

    const { data, error } = await supabaseAdmin
      .from('students')
      .insert({ name, registration_number, class_id: classId, user_id })
      .select().single();
    if (error) throw error;

    res.status(201).json({ ...data, login_created: !!user_id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/teacher/class/:classId/students/:studentId — remove student
router.delete('/class/:classId/students/:studentId', async (req, res) => {
  try {
    const { studentId } = req.params;
    const { error } = await supabaseAdmin
      .from('students').delete().eq('id', studentId);
    if (error) throw error;
    res.json({ message: 'Student removed successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/teacher/attendance/:subjectId
router.get('/attendance/:subjectId', async (req, res) => {
  try {
    const { subjectId } = req.params;
    const { date, from_date, to_date } = req.query;

    let query = supabaseAdmin
      .from('attendance')
      .select('*, students(name, registration_number)')
      .eq('subject_id', subjectId)
      .order('date', { ascending: false });

    if (date) query = query.eq('date', date);
    if (from_date) query = query.gte('date', from_date);
    if (to_date) query = query.lte('date', to_date);

    const { data, error } = await query;
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/teacher/attendance/summary/:subjectId
router.get('/attendance/summary/:subjectId', async (req, res) => {
  try {
    const { subjectId } = req.params;

    const { data, error } = await supabaseAdmin
      .from('attendance')
      .select('student_id, status, students(name, registration_number)')
      .eq('subject_id', subjectId);
    if (error) throw error;

    const summaryMap = {};
    data.forEach(record => {
      const sid = record.student_id;
      if (!summaryMap[sid]) {
        summaryMap[sid] = {
          student_id: sid,
          name: record.students?.name,
          registration_number: record.students?.registration_number,
          total: 0, present: 0
        };
      }
      summaryMap[sid].total++;
      if (record.status === 'present') summaryMap[sid].present++;
    });

    const summary = Object.values(summaryMap).map(s => ({
      ...s,
      percentage: s.total > 0 ? Math.round((s.present / s.total) * 100) : 0,
      below_75: s.total > 0 && (s.present / s.total) * 100 < 75
    }));

    res.json(summary.sort((a, b) => a.name?.localeCompare(b.name)));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
