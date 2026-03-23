-- Contacts table
CREATE TABLE IF NOT EXISTS contacts (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Emails table
CREATE TABLE IF NOT EXISTS emails (
  id SERIAL PRIMARY KEY,
  message_id VARCHAR(512) UNIQUE NOT NULL,
  from_email VARCHAR(255) NOT NULL,
  subject TEXT,
  body TEXT,
  received_at TIMESTAMP,
  is_processed BOOLEAN DEFAULT FALSE,
  contact_id INTEGER REFERENCES contacts(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_emails_contact_id ON emails(contact_id);
CREATE INDEX IF NOT EXISTS idx_emails_from_email ON emails(from_email);
CREATE INDEX IF NOT EXISTS idx_contacts_email ON contacts(email);

-- Settings table (stores IMAP account configs)
CREATE TABLE IF NOT EXISTS settings (
  id SERIAL PRIMARY KEY,
  key VARCHAR(100) UNIQUE NOT NULL,
  value TEXT NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW()
);
