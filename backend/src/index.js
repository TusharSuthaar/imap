require('dotenv').config();

const express = require('express');
const cors = require('cors');
const { initDb } = require('./config/db');
const initDatabase = require('./db/init');
const emailRoutes = require('./routes/emails');
const contactRoutes = require('./routes/contacts');
const settingsRoutes = require('./routes/settings');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/emails', emailRoutes);
app.use('/api/contacts', contactRoutes);
app.use('/api/settings', settingsRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Prevent crashes from unhandled errors (e.g. IMAP socket timeouts)
process.on('uncaughtException', (err) => {
  console.error('⚠️  Uncaught exception (server continues):', err.message);
});
process.on('unhandledRejection', (err) => {
  console.error('⚠️  Unhandled rejection (server continues):', err.message || err);
});

// Start server
async function start() {
  try {
    // Initialize SQLite database
    await initDb();
    initDatabase();

    app.listen(PORT, () => {
      console.log(`🚀 EPM CRM Backend running on http://localhost:${PORT}`);
      console.log(`   Health check: http://localhost:${PORT}/api/health`);
    });
  } catch (error) {
    console.error('Failed to start server:', error.message);
    process.exit(1);
  }
}

start();
