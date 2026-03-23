const { getDb } = require('./db');

/**
 * Get IMAP config dynamically — checks DB settings first, falls back to env vars.
 */
function getImapConfig() {
  let host = process.env.IMAP_HOST || 'imap.gmail.com';
  let port = parseInt(process.env.IMAP_PORT) || 993;
  let user = process.env.IMAP_USER || '';
  let pass = process.env.IMAP_PASS || '';

  try {
    const db = getDb();
    const stmt = db.prepare(
      `SELECT key, value FROM settings WHERE key IN ('imap_host', 'imap_port', 'imap_user', 'imap_pass')`
    );

    while (stmt.step()) {
      const row = stmt.getAsObject();
      switch (row.key) {
        case 'imap_host': host = row.value; break;
        case 'imap_port': port = parseInt(row.value) || 993; break;
        case 'imap_user': user = row.value; break;
        case 'imap_pass': pass = row.value; break;
      }
    }
    stmt.free();
  } catch (err) {
    console.warn('Could not read IMAP settings from DB, using env vars');
  }

  return {
    host,
    port,
    secure: true,
    auth: { user, pass },
    logger: false,
  };
}

module.exports = { getImapConfig };
