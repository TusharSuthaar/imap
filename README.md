# EPM CRM Mail Sync Demo

A full-stack demo web application that demonstrates **IMAP-based email ingestion** into a simple CRM. Emails are fetched from a mailbox using IMAP and displayed inside a CRM-style UI as customer interactions.

---

## 🧱 Tech Stack

| Layer      | Technology                            |
|-----------|---------------------------------------|
| Frontend  | React (Vite), Tailwind CSS, Axios     |
| Backend   | Node.js, Express                      |
| Database  | PostgreSQL                            |
| Libraries | imapflow (IMAP), mailparser (parsing) |

---

## 📦 Project Structure

```
epm-crm-mail-sync-demo/
├── backend/
│   ├── src/
│   │   ├── config/
│   │   │   ├── db.js          # PostgreSQL connection pool
│   │   │   └── imap.js        # IMAP connection config
│   │   ├── db/
│   │   │   ├── schema.sql     # Database schema
│   │   │   └── init.js        # Auto-create tables on startup
│   │   ├── routes/
│   │   │   ├── emails.js      # Email API endpoints
│   │   │   └── contacts.js    # Contact API endpoints
│   │   ├── services/
│   │   │   └── emailService.js # IMAP fetch, parse, store logic
│   │   └── index.js           # Express server entry point
│   ├── .env.example
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── api/
│   │   │   └── client.js      # Axios API client
│   │   ├── components/
│   │   │   ├── Layout.jsx     # Main layout with sidebar
│   │   │   └── Sidebar.jsx    # Navigation sidebar
│   │   ├── pages/
│   │   │   ├── Dashboard.jsx  # Fetch emails + email table
│   │   │   ├── Contacts.jsx   # Contact list grid
│   │   │   └── ContactDetail.jsx # Contact timeline view
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   └── index.css
│   ├── vite.config.js
│   └── package.json
└── README.md
```

---

## ⚡ Prerequisites

1. **Node.js** v18+ installed
2. **PostgreSQL** running locally (or remotely accessible)
3. **Gmail App Password** (if using Gmail IMAP)

### How to Create a Gmail App Password

1. Go to [Google Account Security](https://myaccount.google.com/security)
2. Enable **2-Step Verification** if not already enabled
3. Go to **App Passwords** and generate a new password
4. Use this password in your `.env` file (not your regular password)

---

## 🚀 Setup & Run

### 1. Database Setup

Create a PostgreSQL database:

```sql
CREATE DATABASE epm_crm;
```

> Tables are automatically created when the backend starts.

### 2. Backend Setup

```bash
cd backend

# Copy and edit environment variables
cp .env.example .env
# Edit .env with your IMAP and database credentials

# Install dependencies
npm install

# Start the server
npm start
```

The backend runs on **http://localhost:5000**.

### 3. Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Start the dev server
npm run dev
```

The frontend runs on **http://localhost:5173**.
The Vite dev server proxies `/api/*` requests to the backend automatically.

---

## 🔐 Environment Variables

Edit `backend/.env` with your actual credentials:

```env
# IMAP Configuration (Gmail example)
IMAP_HOST=imap.gmail.com
IMAP_PORT=993
IMAP_USER=your-email@gmail.com
IMAP_PASS=your-app-password

# PostgreSQL Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=epm_crm
DB_USER=postgres
DB_PASS=postgres

# Server
PORT=5000
```

---

## 📋 API Endpoints

| Method | Endpoint               | Description                         |
|--------|------------------------|-------------------------------------|
| GET    | `/api/emails/fetch`    | Fetch unseen emails via IMAP        |
| GET    | `/api/emails`          | List all stored emails              |
| GET    | `/api/emails/stats`    | Get email statistics                |
| GET    | `/api/contacts`        | List contacts with email counts     |
| GET    | `/api/contacts/:id`    | Contact detail + email timeline     |
| GET    | `/api/health`          | Health check                        |

---

## ✨ Features

- **IMAP Email Fetching** — Connects to any IMAP server (Gmail-compatible)
- **Automatic Contact Discovery** — Creates contacts from sender email addresses
- **Duplicate Prevention** — Skips already-fetched emails using `message_id`
- **Mark as Read** — Marks fetched emails as read on the mail server
- **CRM-Style UI** — Dark-themed professional interface with sidebar navigation
- **Email Timeline** — View all emails from a contact in a chat-like timeline
- **Loading States** — Skeleton loaders and spinner animations
- **Error Handling** — Graceful error messages for IMAP and database issues

---

## ⚠️ Notes

- This is a **demo project** — prioritizes simplicity over scalability
- Uses **polling** (click to fetch), not real-time sync
- Requires a valid IMAP account to fetch real emails
- The UI works fully without IMAP configured (just shows empty state)
