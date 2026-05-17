const express = require('express');
const router = express.Router();
const { supabaseAdmin } = require('../config/supabase');
const { authenticate, requireRole } = require('../middleware/auth');

router.use(authenticate);

/**
 * POST /api/attendance/mark
 * Mark attendance for multiple students (teacher/admin only)
 * Prevents duplicates automatically
 */
router.post('/mark', requireRole('teacher'), async (req, res) => {
  try {
    const { subject_id, date, records } = req.body;
    // records = [{ student_id, status: 'present'|'absent' }, ...]

    if (!subject_id || !date || !Array.isArray(records) || records.length === 0) {
      return res.status(400).json({ error: 'subject_id, date, and records array are required' });
    }

    // Validate date format
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ error: 'Date must be in YYYY-MM-DD format' });
    }

    // Use upsert to prevent duplicates (unique constraint on student_id+subject_id+date)
    const upsertData = records.map(r => ({
      student_id: r.student_id,
      subject_id,
      date,
      status: r.status === 'present' ? 'present' : 'absent',
      marked_by: req.user.id
    }));

    const { data, error } = await supabaseAdmin
      .from('attendance')
      .upsert(upsertData, {
        onConflict: 'student_id,subject_id,date',
        ignoreDuplicates: false
      })
      .select();

    if (error) throw error;
    res.json({ message: 'Attendance marked successfully', count: data.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * PUT /api/attendance/:id
 * Edit a single attendance record (teacher/admin only)
 */
router.put('/:id', requireRole('teacher'), async (req, res) => {
  try {
    const { status } = req.body;
    if (!['present', 'absent'].includes(status)) {
      return res.status(400).json({ error: 'status must be present or absent' });
    }

    const { error } = await supabaseAdmin
      .from('attendance')
      .update({ status })
      .eq('id', req.params.id);

    if (error) throw error;
    res.json({ message: 'Attendance updated successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/attendance/dates/:subjectId
 * Get all unique dates attendance was taken for a subject
 */
router.get('/dates/:subjectId', requireRole('teacher', 'admin'), async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('attendance')
      .select('date')
      .eq('subject_id', req.params.subjectId)
      .order('date', { ascending: false });

    if (error) throw error;
    const uniqueDates = [...new Set(data.map(r => r.date))];
    res.json(uniqueDates);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * DELETE /api/attendance/clear
 * Clear attendance for a specific subject and date
 */
router.delete('/clear', requireRole('teacher'), async (req, res) => {
  try {
    const { subject_id, date } = req.body;
    if (!subject_id || !date) {
      return res.status(400).json({ error: 'subject_id and date are required' });
    }

    const { error } = await supabaseAdmin
      .from('attendance')
      .delete()
      .eq('subject_id', subject_id)
      .eq('date', date);

    if (error) throw error;
    res.json({ message: 'Attendance cleared successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
