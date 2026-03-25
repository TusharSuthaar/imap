const express = require('express');
const router = express.Router();
const { fetchEmails, getAllEmails, getEmailStats } = require('../services/emailService');

/**
 * GET /api/emails/fetch
 * Trigger IMAP fetch of unseen emails.
 */
router.get('/fetch', async (req, res) => {
  try {
    const results = await fetchEmails(10);
    res.json({
      success: true,
      message: `Fetched ${results.fetched} new emails, skipped ${results.skipped} duplicates`,
      data: results,
    });
  } catch (error) {
    console.error('Fetch emails error:', error.message);
    res.status(500).json({
      success: false,
      message: error.message,
    });
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

    const { getImapConfig } = require('../config/imap');
    const graphClient = require('../services/graphClient');
    const config = await getImapConfig();

    if (config.host === 'outlook.office365.com' && config.auth.accessToken) {
      await graphClient.sendEmail(config.auth.accessToken, { to, cc, bcc, subject, content: body || ' ', attachments: attachments || [] });
      res.json({ success: true, message: 'Email sent successfully via Graph API' });
    } else {
      res.status(501).json({ success: false, message: 'Sending currently only supported for configured Microsoft accounts' });
    }
  } catch (error) {
    console.error('Send email error:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/emails
 * Return all stored emails.
 */
router.get('/', async (req, res) => {
  try {
    const emails = await getAllEmails();
    res.json({ success: true, data: emails });
  } catch (error) {
    console.error('Get emails error:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/emails/stats
 * Return email statistics.
 */
router.get('/stats', async (req, res) => {
  try {
    const stats = await getEmailStats();
    res.json({ success: true, data: stats });
  } catch (error) {
    console.error('Get stats error:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/emails/:id
 * Return a specific email body based on ID.
 */
router.get('/:id', async (req, res) => {
  try {
    const { getEmailById } = require('../services/emailService');
    const email = await getEmailById(req.params.id);
    if (!email) {
      return res.status(404).json({ success: false, message: 'Email not found.'});
    }
    res.json({ success: true, data: email });
  } catch (error) {
    console.error('Get email error:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/emails/:id/attachments
 * Fetch attachments for an email from Graph API.
 * Returns inline images as data URIs and file attachments as downloadable objects.
 */
router.get('/:id/attachments', async (req, res) => {
  try {
    const { getEmailById } = require('../services/emailService');
    const email = await getEmailById(req.params.id);
    if (!email) {
      return res.status(404).json({ success: false, message: 'Email not found.' });
    }

    const { getImapConfig } = require('../config/imap');
    const graphClient = require('../services/graphClient');
    const config = await getImapConfig();

    if (!config.auth?.accessToken) {
      return res.json({ success: true, attachments: [], body: email.body });
    }

    // Fetch attachments from Graph API using the original message_id
    const attachments = await graphClient.getEmailAttachments(config.auth.accessToken, email.message_id);
    console.log("Graph API Attachments:", attachments.map(a => ({ name: a.name, isInline: a.isInline, contentId: a.contentId, hasBytes: !!a.contentBytes })));

    // Replace cid: references in body with inline base64 data URIs
    let processedBody = email.body || '';
    
    // Some inline attachments might have isInline: false, so we just check for contentId.
    const inlineAtts = attachments.filter(a => a.contentId && a.contentBytes);
    for (const att of inlineAtts) {
      const cidClean = att.contentId.replace(/[<>]/g, '');
      const safeBase64 = att.contentBytes.replace(/[\\r\\n\\s]/g, '');
      const mime = att.contentType || 'image/png';
      const dataUri = `data:${mime};base64,${safeBase64}`;
      const regex = new RegExp(`cid:${cidClean.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')}`, 'gi');
      processedBody = processedBody.replace(regex, dataUri);
    }

    // Return non-inline attachments for download display. 
    // We filter out attachments that were actually referenced in the HTML body as CIDs.
    const downloadableAtts = attachments.filter(a => {
       if (!a.contentId) return !a.isInline;
       const cidClean = a.contentId.replace(/[<>]/g, '');
       return processedBody.indexOf(`data:${a.contentType || 'image/png'};base64,`) === -1 && !a.isInline;
    }).map(a => ({
      name: a.name,
      contentType: a.contentType,
      size: a.size,
      dataUri: a.contentBytes ? `data:${a.contentType};base64,${a.contentBytes}` : null,
    }));

    res.json({
      success: true,
      body: processedBody,
      attachments: downloadableAtts,
    });
  } catch (error) {
    console.error('Get attachments error:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
