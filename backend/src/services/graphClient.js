/**
 * A lightweight client for interacting with the Microsoft Graph REST API.
 * Uses native Node.js fetch to avoid heavyweight SDKs.
 */

const GRAPH_BASE_URL = 'https://graph.microsoft.com/v1.0';

/**
 * Fetch the latest N unread emails for the user.
 * @param {string} accessToken - The Microsoft Graph Access Token
 * @param {number} limit - Maximum number of emails to fetch
 * @returns {Promise<Array>} List of raw Graph API message objects
 */
async function fetchAllEmails(accessToken) {
    // 1. Fetch Mail Folders — use wellKnownName for reliable categorization
    const WELL_KNOWN_MAP = {
        'inbox': 'Inbox',
        'sentitems': 'Sent Items',
        'drafts': 'Drafts',
        'deleteditems': 'Deleted Items',
        'junkemail': 'Junk Email',
        'archive': 'Archive',
        'outbox': 'Outbox',
    };
    const foldersUrl = `${GRAPH_BASE_URL}/me/mailFolders?$top=100&$select=id,displayName,wellKnownName`;
    let folderMap = {};
    try {
        const fRes = await fetch(foldersUrl, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${accessToken}`, 'Accept': 'application/json' }
        });
        if (fRes.ok) {
            const fData = await fRes.json();
            if (fData.value) {
                fData.value.forEach(f => {
                    // Prefer wellKnownName canonical mapping, fall back to displayName
                    const canonical = f.wellKnownName ? WELL_KNOWN_MAP[f.wellKnownName] : null;
                    folderMap[f.id] = canonical || f.displayName;
                });
                console.log('📁 Folder map:', Object.values(folderMap).join(', '));
            }
        }
    } catch (e) {
        console.warn('Could not fetch mail folders for mapping:', e.message);
    }

    // 2. Paginate through ALL messages using @odata.nextLink
    let allMessages = [];
    let nextUrl = `${GRAPH_BASE_URL}/me/messages?$orderby=receivedDateTime desc&$top=100&$select=id,subject,from,toRecipients,ccRecipients,bccRecipients,body,bodyPreview,receivedDateTime,categories,parentFolderId,isRead,conversationId`;
    const MAX_PAGES = 10; // Safety cap: 10 pages × 100 = 1000 emails max
    let page = 0;

    while (nextUrl && page < MAX_PAGES) {
        page++;
        console.log(`📄 Fetching page ${page}...`);
        const response = await fetch(nextUrl, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Accept': 'application/json'
            }
        });

        if (!response.ok) {
            const errObj = await response.json().catch(() => null);
            console.error('Graph API Error (fetchAllEmails):', errObj || response.statusText);
            throw new Error(`Failed to fetch emails via Graph API: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        const messages = data.value || [];
        allMessages = allMessages.concat(messages);

        // Follow pagination link if present
        nextUrl = data['@odata.nextLink'] || null;
    }

    console.log(`✅ Fetched ${allMessages.length} total messages across ${page} pages`);

    // 3. Map folder names onto each message
    return allMessages.map(msg => ({
        ...msg,
        computedFolderName: folderMap[msg.parentFolderId] || ''
    }));
}

/**
 * Marks a specific email as read.
 * @param {string} accessToken - The Microsoft Graph Access Token
 * @param {string} messageId - The Microsoft Graph Message ID
 */
async function markEmailAsRead(accessToken, messageId) {
    const url = `${GRAPH_BASE_URL}/me/messages/${messageId}`;
    
    const response = await fetch(url, {
        method: 'PATCH',
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        },
        body: JSON.stringify({ isRead: true })
    });

    if (!response.ok) {
        throw new Error(`Failed to mark email as read: ${response.statusText}`);
    }
}

/**
 * Sends an email on behalf of the user.
 * Graph API returns 202 Accepted with no body on success.
 */
async function sendEmail(accessToken, { to, cc, bcc, subject, content, attachments = [] }) {
    const url = `${GRAPH_BASE_URL}/me/sendMail`;

    const parseRecipients = (str) => {
        if (!str) return [];
        return str.split(',').map(email => ({
            emailAddress: { address: email.trim() }
        })).filter(e => e.emailAddress.address);
    };

    const message = {
        message: {
            subject: subject,
            body: {
                contentType: 'HTML',
                content: content || ' '
            },
            toRecipients: parseRecipients(to),
            ccRecipients: parseRecipients(cc),
            bccRecipients: parseRecipients(bcc),
            attachments: attachments.map(a => ({
                '@odata.type': '#microsoft.graph.fileAttachment',
                name: a.name,
                contentType: a.type || 'application/octet-stream',
                contentBytes: a.base64
            }))
        },
        saveToSentItems: 'true'
    };

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        },
        body: JSON.stringify(message)
    });

    // Graph API returns 202 Accepted (no body) on success
    if (!response.ok && response.status !== 202) {
        const errObj = await response.json().catch(() => null);
        console.error('Graph API Error (sendEmail):', errObj || response.statusText);
        throw new Error(`Failed to send email via Graph API: ${response.statusText}`);
    }
}

/**
 * Fetch attachments for a specific email message.
 * Returns metadata + base64 content for each attachment.
 */
async function getEmailAttachments(accessToken, messageId) {
    const url = `${GRAPH_BASE_URL}/me/messages/${messageId}/attachments`;
    const response = await fetch(url, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Accept': 'application/json'
        }
    });

    if (!response.ok) {
        const errObj = await response.json().catch(() => null);
        console.error('Graph API Error (getAttachments):', errObj || response.statusText);
        return [];
    }

    const data = await response.json();
    return (data.value || []).map(att => ({
        id: att.id,
        name: att.name,
        contentType: att.contentType,
        size: att.size,
        isInline: att.isInline || false,
        contentId: att.contentId || null,
        contentBytes: att.contentBytes || null, // base64
    }));
}

module.exports = {
    fetchAllEmails,
    markEmailAsRead,
    sendEmail,
    getEmailAttachments
};
