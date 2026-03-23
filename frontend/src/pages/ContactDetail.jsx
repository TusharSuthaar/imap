import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../api/client';

export default function ContactDetail() {
  const { id } = useParams();
  const [contact, setContact] = useState(null);
  const [emails, setEmails] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const res = await api.get(`/contacts/${id}`);
        setContact(res.data.contact);
        setEmails(res.data.emails || []);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <div className="animate-fade-in">
        <div className="skeleton h-8 w-48 mb-6" />
        <div className="skeleton h-24 w-full rounded-2xl mb-6" />
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="skeleton h-40 w-full rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="animate-fade-in">
        <div
          className="rounded-2xl px-6 py-10 text-center"
          style={{
            background: 'var(--color-surface-card)',
            border: '1px solid rgba(251, 113, 133, 0.25)',
          }}
        >
          <p className="text-sm" style={{ color: 'var(--color-accent-rose)' }}>{error}</p>
          <Link
            to="/contacts"
            className="inline-block mt-4 text-sm font-medium"
            style={{ color: 'var(--color-brand-light)' }}
          >
            ← Back to Contacts
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 mb-6 text-sm">
        <Link to="/contacts" className="transition-colors" style={{ color: 'var(--color-text-secondary)' }}
          onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--color-brand-light)')}
          onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--color-text-secondary)')}
        >
          Contacts
        </Link>
        <svg className="w-3.5 h-3.5" style={{ color: 'var(--color-border)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
        <span style={{ color: 'var(--color-text)' }}>
          {contact?.name || contact?.email}
        </span>
      </div>

      {/* Contact Header Card */}
      <div
        className="rounded-2xl p-6 mb-8"
        style={{
          background: 'linear-gradient(135deg, rgba(99,102,241,0.08) 0%, rgba(139,92,246,0.05) 100%)',
          border: '1px solid var(--color-border)',
        }}
      >
        <div className="flex items-center gap-5">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center text-xl font-bold text-white flex-shrink-0"
            style={{
              background: `linear-gradient(135deg, hsl(${hashCode(contact?.email || '') % 360}, 60%, 45%) 0%, hsl(${(hashCode(contact?.email || '') + 40) % 360}, 55%, 55%) 100%)`,
              boxShadow: `0 6px 16px hsla(${hashCode(contact?.email || '') % 360}, 60%, 45%, 0.3)`,
            }}
          >
            {(contact?.name || contact?.email || '?').charAt(0).toUpperCase()}
          </div>
          <div>
            <h1 className="text-xl font-bold" style={{ color: 'var(--color-text)' }}>
              {contact?.name || contact?.email?.split('@')[0]}
            </h1>
            <p className="text-sm mt-0.5 flex items-center gap-2" style={{ color: 'var(--color-text-secondary)' }}>
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              {contact?.email}
            </p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <span
              className="text-xs font-medium px-3 py-1.5 rounded-full"
              style={{
                background: 'rgba(99, 102, 241, 0.1)',
                color: 'var(--color-brand-light)',
              }}
            >
              {emails.length} {emails.length === 1 ? 'email' : 'emails'}
            </span>
          </div>
        </div>
      </div>

      {/* Email Timeline */}
      <div className="mb-4">
        <h2 className="text-base font-semibold" style={{ color: 'var(--color-text)' }}>
          Email Timeline
        </h2>
        <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>
          All interactions with this contact
        </p>
      </div>

      {emails.length === 0 ? (
        <div
          className="rounded-2xl px-6 py-12 text-center"
          style={{
            background: 'var(--color-surface-card)',
            border: '1px solid var(--color-border)',
          }}
        >
          <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
            No emails found for this contact.
          </p>
        </div>
      ) : (
        <div className="relative">
          {/* Timeline line */}
          <div
            className="absolute left-6 top-0 bottom-0 w-px"
            style={{ background: 'var(--color-border)' }}
          />

          <div className="space-y-4">
            {emails.map((email, idx) => (
              <div
                key={email.id}
                className="relative pl-14 animate-fade-in"
                style={{ animationDelay: `${idx * 80}ms` }}
              >
                {/* Timeline dot */}
                <div
                  className="absolute left-4 top-5 w-4 h-4 rounded-full border-2"
                  style={{
                    background: 'var(--color-surface)',
                    borderColor: 'var(--color-brand)',
                    boxShadow: '0 0 0 3px rgba(99,102,241,0.15)',
                  }}
                />

                {/* Email card */}
                <div
                  className="rounded-2xl p-5 transition-all duration-200"
                  style={{
                    background: 'var(--color-surface-card)',
                    border: '1px solid var(--color-border)',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = 'rgba(99,102,241,0.3)';
                    e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.2)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'var(--color-border)';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                >
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <div className="min-w-0 flex-1">
                      <h3 className="text-sm font-semibold truncate" style={{ color: 'var(--color-text)' }}>
                        {email.subject}
                      </h3>
                      <p className="text-xs mt-1 flex items-center gap-1.5" style={{ color: 'var(--color-text-secondary)' }}>
                        <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                            d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                        {email.from_email}
                      </p>
                    </div>
                    <span className="text-xs whitespace-nowrap flex-shrink-0" style={{ color: 'var(--color-text-secondary)' }}>
                      {formatDate(email.received_at)}
                    </span>
                  </div>

                  {/* Body preview */}
                  <div
                    className="text-sm leading-relaxed rounded-xl p-3 mt-2"
                    style={{
                      background: 'rgba(15, 23, 42, 0.5)',
                      color: 'var(--color-text-secondary)',
                      maxHeight: '120px',
                      overflow: 'hidden',
                    }}
                  >
                    {(email.body || '').substring(0, 300)}
                    {(email.body || '').length > 300 && '…'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function hashCode(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash);
}
