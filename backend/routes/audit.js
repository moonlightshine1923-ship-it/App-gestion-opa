import express from 'express';
import { query } from '../db.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = express.Router();

// Route visible only by the president
router.get('/', authenticate, authorize('president'), async (req, res) => {
  try {
    const { q, action, limit = 100, offset = 0 } = req.query;
    let sql = 'SELECT * FROM audit_logs WHERE 1=1';
    const params = [];

    if (q) {
      sql += ' AND (user_email LIKE ? OR description LIKE ? OR target_id LIKE ? OR action_type LIKE ?)';
      const like = `%${q}%`;
      params.push(like, like, like, like);
    }

    if (action) {
      sql += ' AND action_type = ?';
      params.push(action);
    }

    sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit, 10), parseInt(offset, 10));

    const logs = await query(sql, params);
    
    // Also get total count for pagination
    let countSql = 'SELECT COUNT(*) as total FROM audit_logs WHERE 1=1';
    const countParams = [];
    if (q) {
      countSql += ' AND (user_email LIKE ? OR description LIKE ? OR target_id LIKE ? OR action_type LIKE ?)';
      const like = `%${q}%`;
      countParams.push(like, like, like, like);
    }
    if (action) {
      countSql += ' AND action_type = ?';
      countParams.push(action);
    }
    const countResult = await query(countSql, countParams);
    const total = countResult[0] ? countResult[0].total : 0;

    res.json({ logs, total });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
