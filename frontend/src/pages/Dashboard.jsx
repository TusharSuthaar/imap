import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';

export default function Dashboard() {
  const [emails, setEmails] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fetching, setFetching] = useState(false);
  const [fetchResult, setFetchResult] = useState(null);
  const [error, setError] = useState(null);

  const loadEmails = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.get('/emails');
      setEmails(res.data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchNewEmails = async () => {
    try {
      setFetching(true);
      setFetchResult(null);
      setError(null);
      const res = await api.get('/emails/fetch');
      setFetchResult(res.message);
      await loadEmails();
    } catch (err) {
      setError(err.message);
    } finally {
      setFetching(false);
    }
  };

  useEffect(() => {
    loadEmails();
  }, []);

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

  return (
    <div className="animate-fade-in">
      {/* Page Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text)' }}>
            Dashboard
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--color-text-secondary)' }}>
            Monitor and manage your email sync pipeline
          </p>
        </div>
        <button
          id="fetch-emails-btn"
          onClick={fetchNewEmails}
          disabled={fetching}
          className="relative flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-all duration-300 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
          style={{
            background: fetching
              ? 'var(--color-surface-light)'
              : 'linear-gradient(135deg, var(--color-brand) 0%, #8b5cf6 100%)',
            boxShadow: fetching ? 'none' : '0 4px 16px rgba(99, 102, 241, 0.35)',
          }}
          onMouseEnter={(e) => {
            if (!fetching) e.currentTarget.style.transform = 'translateY(-1px)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
          }}
        >
          {fetching ? (
            <>
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Fetching…
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Fetch Emails
            </>
          )}
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">
        <StatCard
          label="Total Emails"
          value={emails.length}
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          }
          color="var(--color-brand)"
        />
        <StatCard
          label="Processed"
          value={emails.filter((e) => e.is_processed).length}
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
          color="var(--color-accent-green)"
        />
        <StatCard
          label="Unique Senders"
          value={new Set(emails.map((e) => e.from_email)).size}
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          }
          color="var(--color-accent-amber)"
        />
      </div>

      {/* Alerts */}
      {fetchResult && (
        <div
          className="mb-6 px-4 py-3 rounded-xl text-sm animate-fade-in flex items-center gap-2"
          style={{
            background: 'rgba(52, 211, 153, 0.1)',
            border: '1px solid rgba(52, 211, 153, 0.25)',
            color: 'var(--color-accent-green)',
          }}
        >
          <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          {fetchResult}
        </div>
      )}

      {error && (
        <div
          className="mb-6 px-4 py-3 rounded-xl text-sm animate-fade-in flex items-center gap-2"
          style={{
            background: 'rgba(251, 113, 133, 0.1)',
            border: '1px solid rgba(251, 113, 133, 0.25)',
            color: 'var(--color-accent-rose)',
          }}
        >
          <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {error}
        </div>
      )}

      {/* Emails Table */}
      <div
        className="rounded-2xl overflow-hidden"
        style={{
          background: 'var(--color-surface-card)',
          border: '1px solid var(--color-border)',
        }}
      >
        <div className="px-6 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid var(--color-border)' }}>
          <h2 className="text-base font-semibold" style={{ color: 'var(--color-text)' }}>
            Recent Emails
          </h2>
          <span className="text-xs px-2.5 py-1 rounded-full" style={{
            background: 'rgba(99, 102, 241, 0.1)',
            color: 'var(--color-brand-light)',
          }}>
            {emails.length} total
          </span>
        </div>

        {loading ? (
          <div className="p-6 space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="skeleton h-12 w-full" />
            ))}
          </div>
        ) : emails.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <svg className="w-12 h-12 mx-auto mb-3" style={{ color: 'var(--color-border)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
            </svg>
            <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
              No emails yet. Click <strong>Fetch Emails</strong> to sync your inbox.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--color-text-secondary)' }}>From</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--color-text-secondary)' }}>Subject</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--color-text-secondary)' }}>Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--color-text-secondary)' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {emails.map((email, idx) => (
                  <tr
                    key={email.id}
                    className="transition-colors duration-150 cursor-default"
                    style={{
                      borderBottom: idx < emails.length - 1 ? '1px solid var(--color-border)' : 'none',
                      animationDelay: `${idx * 50}ms`,
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'rgba(99,102,241,0.04)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'transparent';
                    }}
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold text-white flex-shrink-0"
                          style={{
                            background: `hsl(${hashCode(email.from_email) % 360}, 60%, 45%)`,
                          }}
                        >
                          {email.from_email.charAt(0).toUpperCase()}
                        </div>
                        <span className="text-sm truncate max-w-[200px]" style={{ color: 'var(--color-text)' }}>
                          {email.from_email}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm truncate block max-w-[300px]" style={{ color: 'var(--color-text)' }}>
                        {email.subject}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                        {formatDate(email.received_at)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className="text-xs font-medium px-2.5 py-1 rounded-full"
                        style={{
                          background: email.is_processed
                            ? 'rgba(52, 211, 153, 0.1)'
                            : 'rgba(251, 191, 36, 0.1)',
                          color: email.is_processed
                            ? 'var(--color-accent-green)'
                            : 'var(--color-accent-amber)',
                        }}
                      >
                        {email.is_processed ? 'Processed' : 'Pending'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, icon, color }) {
  return (
    <div
      className="rounded-2xl p-5 transition-all duration-300"
      style={{
        background: 'var(--color-surface-card)',
        border: '1px solid var(--color-border)',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = color;
        e.currentTarget.style.transform = 'translateY(-2px)';
        e.currentTarget.style.boxShadow = `0 8px 24px ${color}15`;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = 'var(--color-border)';
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = 'none';
      }}
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>
          {label}
        </span>
        <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: `${color}15`, color }}>
          {icon}
        </div>
      </div>
      <p className="text-3xl font-bold" style={{ color: 'var(--color-text)' }}>
        {value}
      </p>
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
