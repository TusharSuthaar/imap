const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/auth');
const { getDb } = require('../config/db');

function queryAll(sql, params = []) {
  const db = getDb();
  const stmt = db.prepare(sql);
  if (params.length) stmt.bind(params);
  const rows = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject());
  }
  stmt.free();
  return rows;
}

function queryOne(sql, params = []) {
  const rows = queryAll(sql, params);
  return rows.length > 0 ? rows[0] : null;
}

// Secure routes
router.use(verifyToken);

/**
 * GET /api/contacts
 */
router.get('/', (req, res) => {
  try {
    const rows = queryAll(`
      SELECT 
        c.id, 
        c.email, 
        c.name, 
        c.created_at,
        COUNT(e.id) AS email_count
      FROM contacts c
      LEFT JOIN emails e ON c.id = e.contact_id
      WHERE c.user_id = ?
      GROUP BY c.id
      ORDER BY c.created_at DESC
    `, [req.user.id]);
    res.json({ success: true, data: rows });
  } catch (error) {
    console.error('Get contacts error:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/contacts/:id
 */
router.get('/:id', (req, res) => {
  try {
    const { id } = req.params;

    const contact = queryOne('SELECT * FROM contacts WHERE id = ? AND user_id = ?', [parseInt(id), req.user.id]);
    if (!contact) {
      return res.status(404).json({ success: false, message: 'Contact not found' });
    }

    const unreadCountRow = queryOne('SELECT COUNT(*) as count FROM emails WHERE contact_id = ? AND is_read = 0 AND user_id = ?', [contact.id, req.user.id]);
    const unreadCount = unreadCountRow ? unreadCountRow.count : 0;

    const emails = queryAll(`
      SELECT id, message_id, subject, body, received_at, is_read, category
      FROM emails 
      WHERE contact_id = ? AND user_id = ?
      ORDER BY received_at DESC
    `, [contact.id, req.user.id]);

    res.json({ 
      success: true, 
      data: {
        ...contact,
        unread_count: unreadCount,
        emails
      }
    });
  } catch (error) {
    console.error('Get contact error:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
