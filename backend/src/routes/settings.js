const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/auth');
const { getDb, saveDb } = require('../config/db');

router.use(verifyToken);

/**
 * GET /api/settings
 */
router.get('/', (req, res) => {
  try {
    const db = getDb();
    const stmt = db.prepare("SELECT ms_access_token FROM users WHERE id = ?");
    stmt.bind([req.user.id]);
    const user = stmt.step() ? stmt.getAsObject() : null;
    stmt.free();

    const data = {
      is_microsoft_oauth: !!(user && user.ms_access_token)
    };

    res.json({ success: true, data });
  } catch (error) {
    console.error('Get settings error:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * POST /api/settings/disconnect
 */
router.post('/disconnect', (req, res) => {
  try {
    const db = getDb();
    // 1. Wipe Microsoft tokens from User
    db.run(
      `UPDATE users SET ms_access_token = NULL, ms_refresh_token = NULL, ms_token_expires = NULL, updated_at = datetime('now') WHERE id = ?`,
      [req.user.id]
    );

    // 2. Wipe synced data for this user
    db.run("DELETE FROM emails WHERE user_id = ?", [req.user.id]);
    db.run("DELETE FROM contacts WHERE user_id = ?", [req.user.id]);

    // 3. Audit Log
    db.run(
      `INSERT INTO audit_logs (user_id, action, entity_type, details) VALUES (?, 'LOGOUT', 'user', 'User disconnected Microsoft account and wiped local data')`,
      [req.user.id]
    );

    saveDb();
    console.log(`✅ Disconnected account and wiped tokens and data for user ${req.user.email}.`);
    res.json({ success: true, message: 'Account disconnected and data cleared.' });
  } catch (error) {
    console.error('Disconnect error:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
