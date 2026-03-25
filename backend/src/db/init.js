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
        is_read INTEGER DEFAULT 1,
        contact_id INTEGER REFERENCES contacts(id) ON DELETE SET NULL,
        category TEXT DEFAULT 'Inbox',
        to_address TEXT,
        cc_address TEXT,
        bcc_address TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      )
    `);

    const addColumn = (sql) => {
      try { db.run(sql); } catch (e) { /* ignore */ }
    };

    addColumn("ALTER TABLE emails ADD COLUMN category TEXT DEFAULT 'Inbox'");
    addColumn("ALTER TABLE emails ADD COLUMN to_address TEXT");
    addColumn("ALTER TABLE emails ADD COLUMN cc_address TEXT");
    addColumn("ALTER TABLE emails ADD COLUMN bcc_address TEXT");
    addColumn("ALTER TABLE emails ADD COLUMN is_read INTEGER DEFAULT 1");

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
