const { ImapFlow } = require('imapflow');
const { simpleParser } = require('mailparser');
const { getDb, saveDb } = require('../config/db');
const { getImapConfig } = require('../config/imap');
const graphClient = require('./graphClient');

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
  const category = parsedEmail.category || 'Inbox';
  const toAddress = parsedEmail.toAddress || '';
  const ccAddress = parsedEmail.ccAddress || '';
  const bccAddress = parsedEmail.bccAddress || '';
  const isRead = parsedEmail.isRead !== undefined ? (parsedEmail.isRead ? 1 : 0) : 1;

  // Check for duplicate
  const duplicate = queryOne('SELECT id FROM emails WHERE message_id = ?', [messageId]);
  if (duplicate) {
    // Make sure we update the read/unread status and folder categorization even if email exists
    try {
      db.run('UPDATE emails SET is_read = ?, category = ? WHERE id = ?', [isRead, category, duplicate.id]);
      saveDb();
    } catch(e) {}
    return { skipped: true, messageId };
  }

  // Find or create the contact
  const contactId = findOrCreateContact(fromAddress, fromName);

  // Insert the email
  db.run(
    `INSERT INTO emails (message_id, from_email, subject, body, received_at, is_processed, is_read, contact_id, category, to_address, cc_address, bcc_address)
     VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?)`,
    [messageId, fromAddress, subject, body, receivedAt, isRead, contactId, category, toAddress, ccAddress, bccAddress]
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
  const imapConfig = await getImapConfig();

  if (!imapConfig.auth.user || (!imapConfig.auth.pass && !imapConfig.auth.accessToken)) {
    throw new Error(
      'IMAP credentials not configured. Go to Settings to add your email account.'
    );
  }

  const results = { fetched: 0, skipped: 0, errors: [], emails: [] };

  // If we are using Outlook with an OAuth access token, use Graph REST API instead of IMAP
  if (imapConfig.host === 'outlook.office365.com' && imapConfig.auth.accessToken) {
    console.log('🌐 Connecting to Microsoft Graph API');
    try {
      const graphMessages = await graphClient.fetchAllEmails(imapConfig.auth.accessToken);
      console.log(`📨 Found ${graphMessages.length} messages via Graph`);

      for (const msg of graphMessages) {
        try {
          // Adapt Graph API JSON to the mailparser format expected by storeEmail
          const adaptedEmail = {
            messageId: msg.id,
            from: {
              value: [{
                name: msg.from?.emailAddress?.name || null,
                address: msg.from?.emailAddress?.address || 'unknown@unknown.com'
              }]
            },
            subject: msg.subject,
            html: msg.body?.contentType === 'html' ? msg.body.content : undefined,
            text: msg.body?.contentType === 'text' ? msg.body.content : undefined,
            date: msg.receivedDateTime ? new Date(msg.receivedDateTime) : new Date(),
            category: msg.computedFolderName || ((msg.categories && msg.categories.length > 0) ? msg.categories.join(', ') : 'Inbox'),
            isRead: msg.isRead !== undefined ? msg.isRead : true,
            toAddress: msg.toRecipients?.map(r => r.emailAddress?.address).filter(Boolean).join(', ') || '',
            ccAddress: msg.ccRecipients?.map(r => r.emailAddress?.address).filter(Boolean).join(', ') || '',
            bccAddress: msg.bccRecipients?.map(r => r.emailAddress?.address).filter(Boolean).join(', ') || ''
          };

          const storeResult = storeEmail(adaptedEmail);

          if (storeResult.skipped) {
            results.skipped++;
          } else {
            results.fetched++;
            results.emails.push(storeResult.email);
          }

          // Mark as read in Graph API
          try {
            await graphClient.markEmailAsRead(imapConfig.auth.accessToken, msg.id);
          } catch (flagErr) {
            console.warn('Could not mark message as read via Graph:', flagErr.message);
          }
        } catch (parseErr) {
          console.error('Error processing Graph email:', parseErr.message);
          results.errors.push(parseErr.message);
        }
      }
      return results;
    } catch (error) {
      console.error('Graph API fetching error:', error.message);
      throw error;
    }
  }

  // Fallback for standard IMAP (Gmail, etc.)
  const client = new ImapFlow(imapConfig);

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

/**
 * Get a specific single email safely by database ID.
 */
function getEmailById(id) {
  return queryOne('SELECT * FROM emails WHERE id = ?', [id]);
}

module.exports = {
  fetchEmails,
  getAllEmails,
  getEmailStats,
  findOrCreateContact,
  getEmailById,
};
