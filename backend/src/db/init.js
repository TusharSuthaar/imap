const { getDb, saveDb } = require('../config/db');

function initDatabase() {
  try {
    const db = getDb();

    // Users table
    db.run(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT,
        email TEXT UNIQUE NOT NULL,
        ms_access_token TEXT,
        ms_refresh_token TEXT,
        ms_token_expires TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      )
    `);

    // Contacts table
    db.run(`
      CREATE TABLE IF NOT EXISTS contacts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        email TEXT NOT NULL,
        name TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        UNIQUE(user_id, email)
      )
    `);

    // Emails table
    db.run(`
      CREATE TABLE IF NOT EXISTS emails (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        message_id TEXT NOT NULL,
        from_email TEXT NOT NULL,
        subject TEXT,
        body TEXT,
        received_at TEXT,
        is_processed INTEGER DEFAULT 0,
        is_read INTEGER DEFAULT 1,
        contact_id INTEGER REFERENCES contacts(id) ON DELETE SET NULL,
        category TEXT DEFAULT 'Inbox',
        to_address TEXT,
        cc_address TEXT,
        bcc_address TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        UNIQUE(user_id, message_id)
      )
    `);

    // Audit logs table
    db.run(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        action TEXT NOT NULL,
        entity_type TEXT,
        entity_id TEXT,
        details TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      )
    `);

    // Settings table (Global settings like OAuth Client ID overrides if needed)
    db.run(`
      CREATE TABLE IF NOT EXISTS settings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        key TEXT UNIQUE NOT NULL,
        value TEXT NOT NULL,
        updated_at TEXT DEFAULT (datetime('now'))
      )
    `);

    // Indexes
    const addIndex = (sql) => {
      try { db.run(sql); } catch (e) { /* ignore if exists */ }
    };
    addIndex("CREATE INDEX idx_emails_contact_id ON emails(contact_id)");
    addIndex("CREATE INDEX idx_emails_from_email ON emails(from_email)");
    addIndex("CREATE INDEX idx_emails_user_id ON emails(user_id)");
    addIndex("CREATE INDEX idx_contacts_user_id ON contacts(user_id)");
    addIndex("CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id)");

    saveDb();
    console.log('✅ Database tables initialized successfully');
  } catch (error) {
    console.error('❌ Database initialization failed:', error.message);
  }
}

module.exports = initDatabase;
