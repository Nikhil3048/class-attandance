const express = require('express');
const router = express.Router();
const { supabaseAdmin } = require('../config/supabase');
const { authenticate, requireRole } = require('../middleware/auth');

router.use(authenticate, requireRole('student', 'admin'));

/**
 * GET /api/student/profile
 * Get the student profile linked to the logged-in user
 */
router.get('/profile', async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('students')
      .select('*, classes(class_name)')
      .eq('user_id', req.user.id)
      .single();
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/student/attendance
 * Get all attendance records for the student
 */
router.get('/attendance', async (req, res) => {
  try {
    // First get the student record
    const { data: student, error: studentError } = await supabaseAdmin
      .from('students')
      .select('id')
      .eq('user_id', req.user.id)
      .single();
    if (studentError) throw studentError;

    const { from_date, to_date, subject_id } = req.query;

    let query = supabaseAdmin
      .from('attendance')
      .select('*, subjects(subject_name, classes(class_name))')
      .eq('student_id', student.id)
      .order('date', { ascending: false });

    if (from_date) query = query.gte('date', from_date);
    if (to_date) query = query.lte('date', to_date);
    if (subject_id) query = query.eq('subject_id', subject_id);

    const { data, error } = await query;
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/student/attendance/summary
 * Get subject-wise attendance summary with percentages
 */
router.get('/attendance/summary', async (req, res) => {
  try {
    const { data: student, error: studentError } = await supabaseAdmin
      .from('students')
      .select('id')
      .eq('user_id', req.user.id)
      .single();
    if (studentError) throw studentError;

    const { data, error } = await supabaseAdmin
      .from('attendance')
      .select('subject_id, status, subjects(subject_name)')
      .eq('student_id', student.id);
    if (error) throw error;

    // Group by subject
    const summaryMap = {};
    data.forEach(record => {
      const sid = record.subject_id;
      if (!summaryMap[sid]) {
        summaryMap[sid] = {
          subject_id: sid,
          subject_name: record.subjects?.subject_name,
          total: 0, present: 0
        };
      }
      summaryMap[sid].total++;
      if (record.status === 'present') summaryMap[sid].present++;
    });

    const summary = Object.values(summaryMap).map(s => ({
      ...s,
      absent: s.total - s.present,
      percentage: s.total > 0 ? Math.round((s.present / s.total) * 100) : 0,
      below_75: s.total > 0 && (s.present / s.total) * 100 < 75
    }));

    res.json(summary.sort((a, b) => a.subject_name?.localeCompare(b.subject_name)));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/student/attendance/monthly
 * Get monthly attendance summary
 */
router.get('/attendance/monthly', async (req, res) => {
  try {
    const { data: student, error: studentError } = await supabaseAdmin
      .from('students')
      .select('id')
      .eq('user_id', req.user.id)
      .single();
    if (studentError) throw studentError;

    const { data, error } = await supabaseAdmin
      .from('attendance')
      .select('date, status')
      .eq('student_id', student.id)
      .order('date');
    if (error) throw error;

    // Group by month
    const monthlyMap = {};
    data.forEach(record => {
      const monthKey = record.date.substring(0, 7); // YYYY-MM
      if (!monthlyMap[monthKey]) {
        monthlyMap[monthKey] = { month: monthKey, total: 0, present: 0 };
      }
      monthlyMap[monthKey].total++;
      if (record.status === 'present') monthlyMap[monthKey].present++;
    });

    const monthly = Object.values(monthlyMap).map(m => ({
      ...m,
      absent: m.total - m.present,
      percentage: m.total > 0 ? Math.round((m.present / m.total) * 100) : 0
    }));

    res.json(monthly);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
