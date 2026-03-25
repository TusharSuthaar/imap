const express = require('express');
const router = express.Router();
const { ConfidentialClientApplication } = require('@azure/msal-node');
const { getDb, saveDb } = require('../config/db');

// MSAL configuration
const msalConfig = {
    auth: {
        clientId: process.env.MICROSOFT_CLIENT_ID || 'dummy-client-id',
        authority: `https://login.microsoftonline.com/${process.env.MICROSOFT_TENANT_ID || 'common'}`,
        clientSecret: process.env.MICROSOFT_CLIENT_SECRET || 'dummy-client-secret'
    }
};

const cca = new ConfidentialClientApplication(msalConfig);

const REDIRECT_URI = process.env.MICROSOFT_REDIRECT_URI || 'http://localhost:5000/api/auth/microsoft/callback';

// Scopes needed for IMAP, SMTP, and reading user profile
// Using Microsoft Graph scopes (must match Azure Portal API Permissions)
const SCOPES = [
    'offline_access',
    'https://graph.microsoft.com/IMAP.AccessAsUser.All',
    'https://graph.microsoft.com/Mail.Read',
    'https://graph.microsoft.com/Mail.Send',
    'https://graph.microsoft.com/SMTP.Send',
    'https://graph.microsoft.com/User.Read'
];

/**
 * GET /api/auth/microsoft
 * Initiates the Microsoft OAuth flow
 */
router.get('/microsoft', async (req, res) => {
    try {
        const authCodeUrlParameters = {
            scopes: SCOPES,
            redirectUri: REDIRECT_URI,
            responseMode: 'query',  // Explicitly use query mode (GET-based callback)
            prompt: 'select_account', // Force fresh login, avoid stale session cookies
        };

        const response = await cca.getAuthCodeUrl(authCodeUrlParameters);
        console.log('🔗 Redirecting to Microsoft OAuth:', response);
        res.redirect(response);
    } catch (error) {
        console.error('Error generating Microsoft Auth URL:', error);
        res.status(500).json({ success: false, message: 'Could not generate auth URL' });
    }
});

/**
 * Shared callback handler for Microsoft OAuth redirect.
 * Supports both GET (query params) and POST (form_post) responses from Microsoft.
 */
async function handleMicrosoftCallback(req, res) {
    try {
        // Support both GET query params and POST body
        const code = req.query.code || req.body?.code;
        const error = req.query.error || req.body?.error;

        if (error) {
            const errorDescription = req.query.error_description || req.body?.error_description || 'Unknown error';
            console.error('Microsoft Auth Error:', error, errorDescription);
            return res.redirect(`http://localhost:5173/settings?msal_error=true&error_desc=${encodeURIComponent(errorDescription)}`);
        }

        if (!code) {
            console.error('No authorization code received from Microsoft.');
            return res.redirect('http://localhost:5173/settings?msal_error=true');
        }

        const tokenRequest = {
            code: code,
            scopes: SCOPES,
            redirectUri: REDIRECT_URI,
        };

        const response = await cca.acquireTokenByCode(tokenRequest);

        // Extract the user's email address
        const email = response.account?.username;
        if (!email) {
            throw new Error("Could not determine email address from response.");
        }

        const accessToken = response.accessToken;

        // Extract refresh token from MSAL's internal token cache
        const tokenCache = cca.getTokenCache().serialize();
        const cacheParsed = JSON.parse(tokenCache);

        let refreshToken = '';
        if (cacheParsed.RefreshToken) {
            const rtKeys = Object.keys(cacheParsed.RefreshToken);
            if (rtKeys.length > 0) {
                refreshToken = cacheParsed.RefreshToken[rtKeys[0]].secret;
            }
        }

        const expiresOn = response.expiresOn ? response.expiresOn.getTime() : (Date.now() + 3599 * 1000);

        // Store into SQLite settings table
        const db = getDb();

        const settingsToUpdate = {
            'imap_host': 'outlook.office365.com',
            'imap_port': '993',
            'imap_user': email,
            'ms_access_token': accessToken,
            'ms_refresh_token': refreshToken,
            'ms_token_expires': expiresOn.toString()
        };

        for (const [key, value] of Object.entries(settingsToUpdate)) {
            db.run(`UPDATE settings SET value = ?, updated_at = datetime('now') WHERE key = ?`, [value, key]);
            const stmt = db.prepare(`SELECT id FROM settings WHERE key = ?`);
            stmt.bind([key]);
            const exists = stmt.step();
            stmt.free();

            if (!exists) {
                db.run(`INSERT INTO settings (key, value) VALUES (?, ?)`, [key, value]);
            }
        }

        saveDb();
        console.log(`✅ Microsoft OAuth setup successful for ${email}`);

        // Redirect back to frontend
        res.redirect('http://localhost:5173/settings?msal_success=true');
    } catch (error) {
        console.error('Error during Microsoft Auth Callback:', error);
        res.redirect('http://localhost:5173/settings?msal_error=true');
    }
}

// Handle callback as both GET and POST
router.get('/microsoft/callback', handleMicrosoftCallback);
router.post('/microsoft/callback', handleMicrosoftCallback);
module.exports = router;
