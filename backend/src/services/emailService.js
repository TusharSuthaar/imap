const { ImapFlow } = require('imapflow');
const { simpleParser } = require('mailparser');
const { getDb, saveDb } = require('../config/db');
const graphClient = require('./graphClient');

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

function findOrCreateContact(user_id, email, name) {
  const db = getDb();
  const existing = queryOne('SELECT id FROM contacts WHERE user_id = ? AND email = ?', [user_id, email]);
  if (existing) return existing.id;

  db.run('INSERT INTO contacts (user_id, email, name) VALUES (?, ?, ?)', [user_id, email, name || null]);
  saveDb();
  const row = queryOne('SELECT last_insert_rowid() as id');
  return row.id;
}

function storeEmail(user_id, parsedEmail) {
  const db = getDb();
  const messageId = parsedEmail.messageId || `generated-${Date.now()}-${Math.random()}`;
  const fromAddress = parsedEmail.from?.value?.[0]?.address || 'unknown@unknown.com';
  const fromName = parsedEmail.from?.value?.[0]?.name || null;
  const subject = parsedEmail.subject || '(No Subject)';
  const body = parsedEmail.text || parsedEmail.html || '';
  const receivedAt = parsedEmail.date ? new Date(parsedEmail.date).toISOString() : new Date().toISOString();
  const category = parsedEmail.category || 'Inbox';
  const toAddress = parsedEmail.toAddress || '';
  const ccAddress = parsedEmail.ccAddress || '';
  const bccAddress = parsedEmail.bccAddress || '';
  const isRead = parsedEmail.isRead !== undefined ? (parsedEmail.isRead ? 1 : 0) : 1;

  const duplicate = queryOne('SELECT id FROM emails WHERE user_id = ? AND message_id = ?', [user_id, messageId]);
  if (duplicate) {
    try {
      db.run('UPDATE emails SET is_read = ?, category = ? WHERE id = ?', [isRead, category, duplicate.id]);
      saveDb();
    } catch(e) {}
    return { skipped: true, messageId };
  }

  const contactId = findOrCreateContact(user_id, fromAddress, fromName);

  db.run(
    `INSERT INTO emails (user_id, message_id, from_email, subject, body, received_at, is_processed, is_read, contact_id, category, to_address, cc_address, bcc_address)
     VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?)`,
    [user_id, messageId, fromAddress, subject, body, receivedAt, isRead, contactId, category, toAddress, ccAddress, bccAddress]
  );
  saveDb();

  const row = queryOne('SELECT last_insert_rowid() as id');
  const emailRow = queryOne('SELECT * FROM emails WHERE id = ?', [row.id]);
  return { skipped: false, email: emailRow };
}

/**
 * Fetch and sync emails for a specific user using their MS Token
 */
async function syncUserEmails(user) {
  if (!user.ms_access_token) return { fetched: 0, skipped: 0, errors: [] };

  const results = { fetched: 0, skipped: 0, errors: [], emails: [] };
  
  try {
    const graphMessages = await graphClient.fetchAllEmails(user.ms_access_token);

    for (const msg of graphMessages) {
      try {
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

        const storeResult = storeEmail(user.id, adaptedEmail);

        if (storeResult.skipped) {
          results.skipped++;
        } else {
          results.fetched++;
          results.emails.push(storeResult.email);
        }

        try {
          await graphClient.markEmailAsRead(user.ms_access_token, msg.id);
        } catch (flagErr) {}
      } catch (parseErr) {
        results.errors.push(parseErr.message);
      }
    }
    
    // Log Sync Event if items fetched
    if (results.fetched > 0) {
      const db = getDb();
      db.run("INSERT INTO audit_logs (user_id, action, entity_type, details) VALUES (?, 'SYNC', 'emails', ?)", 
        [user.id, `Synced ${results.fetched} new emails from Microsoft Graph`]);
      saveDb();
    }
    
    return results;
  } catch (error) {
    console.error(`Graph API fetching error for user ${user.id}:`, error.message);
    throw error;
  }
}

function getAllEmails(user_id) {
  return queryAll('SELECT * FROM emails WHERE user_id = ? ORDER BY received_at DESC', [user_id]);
}

function getEmailStats(user_id) {
  const total = queryOne('SELECT COUNT(*) as count FROM emails WHERE user_id = ?', [user_id]);
  const unprocessed = queryOne('SELECT COUNT(*) as count FROM emails WHERE user_id = ? AND is_processed = 0', [user_id]);
  return {
    total: total ? total.count : 0,
    unprocessed: unprocessed ? unprocessed.count : 0,
  };
}

function getEmailById(user_id, email_id) {
  return queryOne('SELECT * FROM emails WHERE id = ? AND user_id = ?', [email_id, user_id]);
}

/**
 * Start a background process to sync emails for all connected users
 */
function startEmailSync() {
  const syncInterval = process.env.SYNC_INTERVAL || 60000;
  
  console.log(`⏱️ Starting Multi-User Email Sync Engine (Interval: ${syncInterval}ms)`);
  setInterval(async () => {
    try {
      const db = getDb();
      const stmt = db.prepare("SELECT * FROM users WHERE ms_access_token IS NOT NULL");
      
      const activeUsers = [];
      while (stmt.step()) {
        activeUsers.push(stmt.getAsObject());
      }
      stmt.free();

      for (const user of activeUsers) {
        try {
          await syncUserEmails(user);
        } catch (syncErr) {
          console.error(`Background sync failed for user ${user.id} (${user.email}):`, syncErr.message);
        }
      }
    } catch (dbErr) {
      console.error('Email Sync Engine DB error:', dbErr.message);
    }
  }, syncInterval);
}

module.exports = {
  syncUserEmails,
  startEmailSync,
  getAllEmails,
  getEmailStats,
  findOrCreateContact,
  getEmailById,
};
