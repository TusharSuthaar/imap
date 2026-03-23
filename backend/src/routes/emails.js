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

module.exports = router;
