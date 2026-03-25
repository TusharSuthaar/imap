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

/**
 * GET /api/settings
 */
router.get('/', (req, res) => {
  try {
    const rows = queryAll(
      `SELECT key, value FROM settings WHERE key IN ('imap_host', 'imap_port', 'imap_user', 'imap_pass', 'ms_access_token')`
    );

    const settings = {};
    for (const row of rows) {
      settings[row.key] = row.key === 'imap_pass'
        ? (row.value ? '••••••••' : '')
        : row.value;
    }

    const data = {
      imap_host: settings.imap_host || process.env.IMAP_HOST || 'imap.gmail.com',
      imap_port: settings.imap_port || process.env.IMAP_PORT || '993',
      imap_user: settings.imap_user || process.env.IMAP_USER || '',
      imap_pass: settings.imap_pass || (process.env.IMAP_PASS ? '••••••••' : ''),
      is_microsoft_oauth: !!settings.ms_access_token,
      has_credentials: !!(
        (settings.imap_user || process.env.IMAP_USER) &&
        (settings.imap_pass || process.env.IMAP_PASS || settings.ms_access_token)
      ),
    };

    res.json({ success: true, data });
  } catch (error) {
    console.error('Get settings error:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * POST /api/settings
 */
router.post('/', (req, res) => {
  try {
    const { imap_host, imap_port, imap_user, imap_pass } = req.body;

    if (!imap_host || !imap_user) {
      return res.status(400).json({
        success: false,
        message: 'IMAP host and email are required',
      });
    }

    const db = getDb();

    const entries = [
      ['imap_host', imap_host],
      ['imap_port', String(imap_port || 993)],
      ['imap_user', imap_user],
    ];

    if (imap_pass && !imap_pass.includes('••••')) {
      entries.push(['imap_pass', imap_pass]);
    }

    for (const [key, value] of entries) {
      // Try update first, then insert
      db.run(
        `UPDATE settings SET value = ?, updated_at = datetime('now') WHERE key = ?`,
        [value, key]
      );

      // Check if row was affected by checking existence
      const stmt = db.prepare(`SELECT id FROM settings WHERE key = ?`);
      stmt.bind([key]);
      const exists = stmt.step();
      stmt.free();

      if (!exists) {
        db.run(
          `INSERT INTO settings (key, value) VALUES (?, ?)`,
          [key, value]
        );
      }
    }

    saveDb();
    console.log(`✅ IMAP settings updated for ${imap_user}`);
    res.json({ success: true, message: 'Settings saved successfully' });
  } catch (error) {
    console.error('Save settings error:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * POST /api/settings/test
 */
router.post('/test', async (req, res) => {
  const { ImapFlow } = require('imapflow');
  const { getImapConfig } = require('../config/imap');

  try {
    const config = await getImapConfig();

    if (!config.auth.user || (!config.auth.pass && !config.auth.accessToken)) {
      return res.status(400).json({
        success: false,
        message: 'IMAP credentials not configured. Please save your settings first.',
      });
    }

    // Enable logging for debug
    const debugConfig = { ...config, logger: {
      debug: (info) => console.log('IMAP DEBUG:', info.msg),
      info: (info) => console.log('IMAP INFO:', info.msg),
      warn: (info) => console.warn('IMAP WARN:', info.msg),
      error: (info) => console.error('IMAP ERROR:', info.msg),
    }};

    console.log(`🔍 Testing IMAP: ${debugConfig.host}:${debugConfig.port} as ${debugConfig.auth.user}`);

    const client = new ImapFlow(debugConfig);
    await client.connect();
    await client.logout();

    res.json({ success: true, message: 'Connection successful! ✓' });
  } catch (error) {
    const fullMsg = error.responseText || error.response || error.message || String(error);
    console.error('IMAP test error (full):', fullMsg);
    console.error('IMAP test error (stack):', error.stack?.split('\n').slice(0, 3).join('\n'));
    res.status(400).json({
      success: false,
      message: `Connection failed: ${fullMsg}`,
    });
  }
});

/**
 * POST /api/settings/disconnect
 */
router.post('/disconnect', (req, res) => {
  try {
    const db = getDb();
    const keysToDelete = ['imap_host', 'imap_port', 'imap_user', 'imap_pass', 'ms_access_token', 'ms_refresh_token', 'ms_token_expires', 'last_sync_time'];
    const placeholders = keysToDelete.map(() => '?').join(',');
    
    // Wipe settings
    db.run(`DELETE FROM settings WHERE key IN (${placeholders})`, keysToDelete);
    
    // Wipe data
    db.run("DELETE FROM emails");
    db.run("DELETE FROM contacts");
    
    saveDb();
    console.log(`✅ Disconnected account and wiped tokens and data.`);
    res.json({ success: true, message: 'Account disconnected and data cleared.' });
  } catch (error) {
    console.error('Disconnect error:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
