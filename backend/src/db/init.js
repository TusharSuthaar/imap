const { getDb, saveDb } = require('../config/db');

function initDatabase() {
  try {
    const db = getDb();

    db.run(`
      CREATE TABLE IF NOT EXISTS contacts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE NOT NULL,
        name TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS emails (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        message_id TEXT UNIQUE NOT NULL,
        from_email TEXT NOT NULL,
        subject TEXT,
        body TEXT,
        received_at TEXT,
        is_processed INTEGER DEFAULT 0,
        contact_id INTEGER REFERENCES contacts(id) ON DELETE SET NULL,
        created_at TEXT DEFAULT (datetime('now'))
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS settings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        key TEXT UNIQUE NOT NULL,
        value TEXT NOT NULL,
        updated_at TEXT DEFAULT (datetime('now'))
      )
    `);

    db.run(`CREATE INDEX IF NOT EXISTS idx_emails_contact_id ON emails(contact_id)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_emails_from_email ON emails(from_email)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_contacts_email ON contacts(email)`);

    saveDb();
    console.log('✅ Database tables initialized successfully');
  } catch (error) {
    console.error('❌ Failed to initialize database:', error.message);
    throw error;
  }
}

module.exports = initDatabase;
