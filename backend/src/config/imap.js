const { getDb, saveDb } = require('./db');
const { ConfidentialClientApplication } = require('@azure/msal-node');

const msalConfig = {
    auth: {
        clientId: process.env.MICROSOFT_CLIENT_ID || 'dummy',
        authority: `https://login.microsoftonline.com/${process.env.MICROSOFT_TENANT_ID || 'common'}`,
        clientSecret: process.env.MICROSOFT_CLIENT_SECRET || 'dummy'
    }
};

const cca = new ConfidentialClientApplication(msalConfig);

/**
 * Get IMAP config dynamically — checks DB settings first, falls back to env vars.
 */
async function getImapConfig() {
  let host = process.env.IMAP_HOST || 'imap.gmail.com';
  let port = parseInt(process.env.IMAP_PORT) || 993;
  let user = process.env.IMAP_USER || '';
  let pass = process.env.IMAP_PASS || '';
  
  let msAccessToken = null;
  let msRefreshToken = null;
  let msTokenExpires = null;

  try {
    const db = getDb();
    const stmt = db.prepare(
      `SELECT key, value FROM settings WHERE key IN ('imap_host', 'imap_port', 'imap_user', 'imap_pass', 'ms_access_token', 'ms_refresh_token', 'ms_token_expires')`
    );

    while (stmt.step()) {
      const row = stmt.getAsObject();
      switch (row.key) {
        case 'imap_host': host = row.value; break;
        case 'imap_port': port = parseInt(row.value) || 993; break;
        case 'imap_user': user = row.value; break;
        case 'imap_pass': pass = row.value; break;
        case 'ms_access_token': msAccessToken = row.value; break;
        case 'ms_refresh_token': msRefreshToken = row.value; break;
        case 'ms_token_expires': msTokenExpires = parseInt(row.value); break;
      }
    }
    stmt.free();

    // Check if we are using Outlook with OAuth and if the token is expired
    if (host === 'outlook.office365.com' && msAccessToken && msRefreshToken) {
      const now = Date.now();
      // Refresh token if it expires in less than 5 minutes
      if (!msTokenExpires || (msTokenExpires - now) < 5 * 60 * 1000) {
        console.log('🔄 Microsoft OAuth token expired or expiring soon, refreshing...');
        
        const refreshTokenRequest = {
            refreshToken: msRefreshToken,
            scopes: ['offline_access', 'https://outlook.office.com/IMAP.AccessAsUser.All', 'https://outlook.office.com/SMTP.Send', 'User.Read']
        };

        const response = await cca.acquireTokenByRefreshToken(refreshTokenRequest);
        if (response && response.accessToken) {
            msAccessToken = response.accessToken;
            msTokenExpires = response.expiresOn ? response.expiresOn.getTime() : (Date.now() + 3599 * 1000);
            
            // Also update refresh token if a new one was provided, though msal-node handles this via cache,
            // we will extract it.
            const cacheParsed = JSON.parse(cca.getTokenCache().serialize());
            if (cacheParsed.RefreshToken) {
                const rtKeys = Object.keys(cacheParsed.RefreshToken);
                if (rtKeys.length > 0) {
                    msRefreshToken = cacheParsed.RefreshToken[rtKeys[0]].secret;
                }
            }

            // Save to DB
            const updates = {
                ms_access_token: msAccessToken,
                ms_refresh_token: msRefreshToken,
                ms_token_expires: msTokenExpires.toString()
            };

            for (const [k, v] of Object.entries(updates)) {
                db.run(`UPDATE settings SET value = ?, updated_at = datetime('now') WHERE key = ?`, [v, k]);
            }
            saveDb();
            console.log('✅ Microsoft OAuth token refreshed successfully');
        }
      }
      
      // Return OAuth 2 configuration
      return {
        host,
        port,
        secure: true,
        auth: {
          user,
          accessToken: msAccessToken
        },
        logger: false,
      };
    }

  } catch (err) {
    console.warn('Could not read IMAP settings from DB safely', err.message);
  }

  // Fallback to basic auth config
  return {
    host,
    port,
    secure: true,
    auth: { user, pass },
    logger: false,
  };
}

module.exports = { getImapConfig };
