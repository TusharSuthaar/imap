const express = require('express');
const router = express.Router();
const { getDb, saveDb } = require('../config/db');

/**
 * Helper: run a SELECT and return all rows as objects.
 */
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
      GROUP BY c.id
      ORDER BY c.created_at DESC
    `);
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

    const contact = queryOne('SELECT * FROM contacts WHERE id = ?', [parseInt(id)]);
    if (!contact) {
      return res.status(404).json({ success: false, message: 'Contact not found' });
    }

    const emails = queryAll(
      'SELECT * FROM emails WHERE contact_id = ? ORDER BY received_at DESC',
      [parseInt(id)]
    );

    res.json({
      success: true,
      data: { contact, emails },
    });
  } catch (error) {
    console.error('Get contact detail error:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
