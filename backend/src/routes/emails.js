const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/auth');
const { syncUserEmails, getAllEmails, getEmailStats, getEmailById } = require('../services/emailService');
const { getDb } = require('../config/db');

// Secure all email routes with JWT auth
router.use(verifyToken);

/**
 * GET /api/emails/sync
 * Trigger Graph fetch of unseen emails for the logged-in user.
 */
router.get('/sync', async (req, res) => {
  try {
    const db = getDb();
    const userStmt = db.prepare("SELECT * FROM users WHERE id = ?");
    userStmt.bind([req.user.id]);
    const user = userStmt.step() ? userStmt.getAsObject() : null;
    userStmt.free();

    if (!user || !user.ms_access_token) {
      return res.status(401).json({ success: false, message: 'Microsoft Account not connected for this user' });
    }

    const results = await syncUserEmails(user);
    res.json({
      success: true,
      message: `Fetched ${results.fetched} new emails, skipped ${results.skipped} duplicates`,
      data: results,
    });
  } catch (error) {
    console.error(`Sync error for user ${req.user.id}:`, error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * POST /api/emails/send
 * Send an email via Microsoft Graph API.
 */
router.post('/send', async (req, res) => {
  try {
    const { to, cc, bcc, subject, body, attachments } = req.body;
    
    if (!to || !subject) {
      return res.status(400).json({ success: false, message: 'Missing fields: to, subject' });
    }

    const db = getDb();
    const userStmt = db.prepare("SELECT ms_access_token FROM users WHERE id = ?");
    userStmt.bind([req.user.id]);
    const user = userStmt.step() ? userStmt.getAsObject() : null;
    userStmt.free();

    if (user && user.ms_access_token) {
      const graphClient = require('../services/graphClient');
      await graphClient.sendEmail(user.ms_access_token, { to, cc, bcc, subject, content: body || ' ', attachments: attachments || [] });
      
      db.run("INSERT INTO audit_logs (user_id, action, entity_type, details) VALUES (?, 'SEND', 'emails', ?)", 
        [req.user.id, `Sent email to ${to}`]);
      
      res.json({ success: true, message: 'Email sent successfully via Graph API' });
    } else {
      res.status(501).json({ success: false, message: 'Sending currently only supported for connected Microsoft accounts' });
    }
  } catch (error) {
    console.error('Send email error:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/emails
 * Return all stored emails for the authenticated user.
 */
router.get('/', (req, res) => {
  try {
    const emails = getAllEmails(req.user.id);
    res.json({ success: true, data: emails });
  } catch (error) {
    console.error('Get emails error:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/emails/stats
 * Return email statistics for the user.
 */
router.get('/stats', (req, res) => {
  try {
    const stats = getEmailStats(req.user.id);
    res.json({ success: true, data: stats });
  } catch (error) {
    console.error('Get stats error:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/emails/:id
 * Return a specific email body based on ID for the user.
 */
router.get('/:id', (req, res) => {
  try {
    const email = getEmailById(req.user.id, req.params.id);
    if (!email) return res.status(404).json({ success: false, message: 'Email not found.'});
    res.json({ success: true, data: email });
  } catch (error) {
    console.error('Get email error:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/emails/:id/attachments
 * Fetch attachments for a user's email from Graph API.
 */
router.get('/:id/attachments', async (req, res) => {
  try {
    const email = getEmailById(req.user.id, req.params.id);
    if (!email) return res.status(404).json({ success: false, message: 'Email not found.' });

    const db = getDb();
    const userStmt = db.prepare("SELECT ms_access_token FROM users WHERE id = ?");
    userStmt.bind([req.user.id]);
    const user = userStmt.step() ? userStmt.getAsObject() : null;
    userStmt.free();

    if (!user || !user.ms_access_token) {
      return res.json({ success: true, attachments: [], body: email.body });
    }

    const graphClient = require('../services/graphClient');
    const attachments = await graphClient.getEmailAttachments(user.ms_access_token, email.message_id);

    let processedBody = email.body || '';
    const inlineAtts = attachments.filter(a => a.contentId && a.contentBytes);
    for (const att of inlineAtts) {
      const cidClean = att.contentId.replace(/[<>]/g, '');
      const safeBase64 = att.contentBytes.replace(/[\\r\\n\\s]/g, '');
      const mime = att.contentType || 'image/png';
      const dataUri = `data:${mime};base64,${safeBase64}`;
      const regex = new RegExp(`cid:${cidClean.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')}`, 'gi');
      processedBody = processedBody.replace(regex, dataUri);
    }

    const downloadableAtts = attachments.filter(a => {
      if (a.isInline === true && a.contentId && processedBody.includes(a.contentId.replace(/[<>]/g, ''))) return false;
      if (!a.isInline && a.contentId && processedBody.includes(a.contentId.replace(/[<>]/g, ''))) return false;
      return true;
    });

    res.json({ success: true, attachments: downloadableAtts, body: processedBody });
  } catch (error) {
    console.error('Attachment fetch error:', error.message);
    res.status(500).json({ success: false, message: 'Failed to fetch external attachments' });
  }
});

module.exports = router;
