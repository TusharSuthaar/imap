const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const express = require('express');
const cors = require('cors');
const { initDb } = require('./config/db');
const initDatabase = require('./db/init');
const emailRoutes = require('./routes/emails');
const contactRoutes = require('./routes/contacts');
const settingsRoutes = require('./routes/settings');
const authRoutes = require('./routes/auth');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true }));

// API Routes
app.use('/api/emails', emailRoutes);
app.use('/api/contacts', contactRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/auth', authRoutes);

// Serve static files from the React app
const frontendPath = path.join(__dirname, '../../frontend/dist');
app.use(express.static(frontendPath));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Catch-all: serve index.html for any non-API routes
app.get('*', (req, res) => {
  res.sendFile(path.join(frontendPath, 'index.html'));
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
    
    // Start background sync for all users
    const { startEmailSync } = require('./services/emailService');
    startEmailSync();

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
