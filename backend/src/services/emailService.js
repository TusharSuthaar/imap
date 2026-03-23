const { ImapFlow } = require('imapflow');
const { simpleParser } = require('mailparser');
const { getDb, saveDb } = require('../config/db');
const { getImapConfig } = require('../config/imap');

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
 * Helper: run a SELECT and return the first row as an object, or null.
 */
function queryOne(sql, params = []) {
  const rows = queryAll(sql, params);
  return rows.length > 0 ? rows[0] : null;
}

/**
 * Find or create a contact by email address.
 */
function findOrCreateContact(email, name) {
  const db = getDb();

  const existing = queryOne('SELECT id FROM contacts WHERE email = ?', [email]);
  if (existing) return existing.id;

  db.run('INSERT INTO contacts (email, name) VALUES (?, ?)', [email, name || null]);
  saveDb();

  const row = queryOne('SELECT last_insert_rowid() as id');
  return row.id;
}

/**
 * Store a parsed email into the database.
 */
function storeEmail(parsedEmail) {
  const db = getDb();
  const messageId = parsedEmail.messageId || `generated-${Date.now()}-${Math.random()}`;
  const fromAddress = parsedEmail.from?.value?.[0]?.address || 'unknown@unknown.com';
  const fromName = parsedEmail.from?.value?.[0]?.name || null;
  const subject = parsedEmail.subject || '(No Subject)';
  const body = parsedEmail.text || parsedEmail.html || '';
  const receivedAt = parsedEmail.date
    ? new Date(parsedEmail.date).toISOString()
    : new Date().toISOString();

  // Check for duplicate
  const duplicate = queryOne('SELECT id FROM emails WHERE message_id = ?', [messageId]);
  if (duplicate) return { skipped: true, messageId };

  // Find or create the contact
  const contactId = findOrCreateContact(fromAddress, fromName);

  // Insert the email
  db.run(
    `INSERT INTO emails (message_id, from_email, subject, body, received_at, is_processed, contact_id)
     VALUES (?, ?, ?, ?, ?, 1, ?)`,
    [messageId, fromAddress, subject, body, receivedAt, contactId]
  );
  saveDb();

  const row = queryOne('SELECT last_insert_rowid() as id');
  const email = queryOne('SELECT * FROM emails WHERE id = ?', [row.id]);
  return { skipped: false, email };
}

/**
 * Fetch the last N unseen emails from the IMAP inbox.
 */
async function fetchEmails(limit = 10) {
  const imapConfig = getImapConfig();

  if (!imapConfig.auth.user || !imapConfig.auth.pass) {
    throw new Error(
      'IMAP credentials not configured. Go to Settings to add your email account.'
    );
  }

  const client = new ImapFlow(imapConfig);
  const results = { fetched: 0, skipped: 0, errors: [], emails: [] };

  try {
    await client.connect();
    console.log('📧 Connected to IMAP server');

    const lock = await client.getMailboxLock('INBOX');

    try {
      const messages = [];
      for await (const msg of client.fetch(
        { seen: false },
        { source: true, uid: true },
        { changedSince: 0 }
      )) {
        messages.push(msg);
        if (messages.length >= limit) break;
      }

      console.log(`📨 Found ${messages.length} unseen messages`);

      for (const msg of messages) {
        try {
          const parsed = await simpleParser(msg.source);
          const storeResult = storeEmail(parsed);

          if (storeResult.skipped) {
            results.skipped++;
          } else {
            results.fetched++;
            results.emails.push(storeResult.email);
          }

          try {
            await client.messageFlagsAdd({ uid: msg.uid }, ['\\Seen']);
          } catch (flagErr) {
            console.warn('Could not mark message as read:', flagErr.message);
          }
        } catch (parseErr) {
          console.error('Error parsing email:', parseErr.message);
          results.errors.push(parseErr.message);
        }
      }
    } finally {
      lock.release();
    }

    await client.logout();
    console.log('📧 Disconnected from IMAP server');
  } catch (error) {
    console.error('IMAP connection error:', error.message);
    throw error;
  }

  return results;
}

/**
 * Get all stored emails, newest first.
 */
function getAllEmails() {
  return queryAll('SELECT * FROM emails ORDER BY received_at DESC');
}

/**
 * Get email statistics.
 */
function getEmailStats() {
  const total = queryOne('SELECT COUNT(*) as count FROM emails');
  const unprocessed = queryOne('SELECT COUNT(*) as count FROM emails WHERE is_processed = 0');
  return {
    total: total ? total.count : 0,
    unprocessed: unprocessed ? unprocessed.count : 0,
  };
}

module.exports = {
  fetchEmails,
  getAllEmails,
  getEmailStats,
  findOrCreateContact,
};
