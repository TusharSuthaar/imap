import { useState, useEffect } from 'react';
import api from '../api/client';

export default function Settings() {
  const [form, setForm] = useState({
    imap_host: 'imap.gmail.com',
    imap_port: '993',
    imap_user: '',
    imap_pass: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState(null);
  const [hasCredentials, setHasCredentials] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isMicrosoftOauth, setIsMicrosoftOauth] = useState(false);

  useEffect(() => {
    // Check URL for MSAL OAuth results
    const params = new URLSearchParams(window.location.search);
    if (params.get('msal_success') === 'true') {
      setMessage({ type: 'success', text: 'Microsoft Account connected successfully!' });
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (params.get('msal_error') === 'true') {
      setMessage({ type: 'error', text: 'Failed to connect Microsoft Account.' });
      window.history.replaceState({}, document.title, window.location.pathname);
    }

    (async () => {
      try {
        const res = await api.get('/settings');
        const s = res.data;
        setForm({
          imap_host: s.imap_host || 'imap.gmail.com',
          imap_port: s.imap_port || '993',
          imap_user: s.imap_user || '',
          imap_pass: s.imap_pass || '',
        });
        setHasCredentials(s.has_credentials);
        setIsMicrosoftOauth(s.is_microsoft_oauth || false);
      } catch (err) {
        // Settings table may not exist yet
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    setMessage(null);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      setMessage(null);
      const res = await api.post('/settings', form);
      setMessage({ type: 'success', text: res.message });
      setHasCredentials(true);
      if (form.imap_host !== 'outlook.office365.com') {
        setIsMicrosoftOauth(false);
      }
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    try {
      setTesting(true);
      setMessage(null);
      const res = await api.post('/settings/test');
      setMessage({ type: 'success', text: res.message });
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setTesting(false);
    }
  };

  const handleMicrosoftConnect = () => {
    window.location.href = 'http://localhost:5000/api/auth/microsoft';
  };

  if (loading) {
    return (
      <div className="animate-fade-in">
        <div className="skeleton h-8 w-48 mb-6" />
        <div className="skeleton h-96 w-full max-w-2xl rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <div className="mb-8">
        <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text)' }}>
          Email Settings
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--color-text-secondary)' }}>
          Configure your IMAP email account to fetch emails
        </p>
      </div>

      <div
        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium mb-6"
        style={{
          background: hasCredentials ? 'rgba(52,211,153,0.1)' : 'rgba(251,191,36,0.1)',
          border: `1px solid ${hasCredentials ? 'rgba(52,211,153,0.25)' : 'rgba(251,191,36,0.25)'}`,
          color: hasCredentials ? 'var(--color-accent-green)' : 'var(--color-accent-amber)',
        }}
      >
        <div
          className="w-1.5 h-1.5 rounded-full"
          style={{ background: hasCredentials ? 'var(--color-accent-green)' : 'var(--color-accent-amber)' }}
        />
        {hasCredentials ? (isMicrosoftOauth ? 'Microsoft Account connected' : 'Account connected') : 'No account configured'}
      </div>

      <form onSubmit={handleSave} className="max-w-2xl">
        <div
          className="rounded-2xl p-6"
          style={{
            background: 'var(--color-surface-card)',
            border: '1px solid var(--color-border)',
          }}
        >
          <div className="flex items-center gap-3 mb-6">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{
                background: 'linear-gradient(135deg, rgba(99,102,241,0.15) 0%, rgba(139,92,246,0.10) 100%)',
              }}
            >
              <svg className="w-5 h-5" style={{ color: 'var(--color-brand-light)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                  d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <h2 className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
                IMAP Connection
              </h2>
              <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                Gmail, Outlook, or any IMAP-compatible email
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>
                Email Provider
              </label>
              <div className="grid grid-cols-4 gap-2">
                {[
                  { id: 'gmail', label: 'Gmail', host: 'imap.gmail.com', port: '993' },
                  { id: 'outlook', label: 'Outlook', host: 'outlook.office365.com', port: '993' },
                  { id: 'yahoo', label: 'Yahoo', host: 'imap.mail.yahoo.com', port: '993' },
                  { id: 'custom', label: 'Custom', host: '', port: '' },
                ].map((provider) => {
                  const isSelected = provider.id === 'custom'
                    ? !['imap.gmail.com', 'outlook.office365.com', 'imap.mail.yahoo.com'].includes(form.imap_host)
                    : form.imap_host === provider.host;
                  return (
                    <button
                      key={provider.id}
                      type="button"
                      className="px-3 py-2 rounded-xl text-xs font-medium transition-all duration-200 cursor-pointer"
                      style={{
                        background: isSelected
                          ? 'linear-gradient(135deg, rgba(99,102,241,0.15) 0%, rgba(139,92,246,0.10) 100%)'
                          : 'var(--color-surface)',
                        border: `1px solid ${isSelected ? 'var(--color-brand)' : 'var(--color-border)'}`,
                        color: isSelected ? 'var(--color-brand-light)' : 'var(--color-text-secondary)',
                      }}
                      onClick={() => {
                        if (provider.id !== 'custom') {
                          setForm((prev) => ({
                            ...prev,
                            imap_host: provider.host,
                            imap_port: provider.port,
                          }));
                        }
                        setMessage(null);
                      }}
                    >
                      {provider.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {form.imap_host === 'outlook.office365.com' ? (
              <div className="mt-4 p-4 rounded-xl border border-blue-500/20 bg-blue-500/5">
                <h3 className="text-sm font-semibold mb-2" style={{ color: 'var(--color-text)' }}>Microsoft OAuth Setup</h3>
                <p className="text-xs mb-4" style={{ color: 'var(--color-text-secondary)' }}>
                  Microsoft requires OAuth for connecting to Outlook IMAP. Connect your Microsoft account to securely sync emails.
                </p>
                <button
                  type="button"
                  onClick={handleMicrosoftConnect}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer shadow-sm hover:shadow-md"
                  style={{
                    backgroundColor: '#0078D4',
                    color: 'white',
                    border: 'none',
                  }}
                >
                  <svg className="w-5 h-5" viewBox="0 0 21 21" fill="currentColor">
                    <path fill="#f3f3f3" d="M0 0h10v10H0z"/>
                    <path fill="#f3f3f3" d="M11 0h10v10H11z"/>
                    <path fill="#f3f3f3" d="M0 11h10v10H0z"/>
                    <path fill="#f3f3f3" d="M11 11h10v10H11z"/>
                    <path fill="currentColor" d="M1 1h8v8H1z M11 1h8v8H11z M1 11h8v8H1z M11 11h8v8H11z"/>
                  </svg>
                  {isMicrosoftOauth ? 'Reconnect Microsoft Account' : 'Connect Microsoft Account'}
                </button>
                {isMicrosoftOauth && (
                  <p className="text-xs mt-3 text-green-500 font-medium">
                    ✓ Currently connected via Microsoft OAuth
                  </p>
                )}
              </div>
            ) : (
              <>
                <div className="grid grid-cols-3 gap-4 mt-4">
                  <div className="col-span-2">
                    <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>
                      IMAP Host
                    </label>
                    <input
                      id="imap-host"
                      type="text"
                      name="imap_host"
                      value={form.imap_host}
                      onChange={handleChange}
                      placeholder="imap.gmail.com"
                      className="w-full px-4 py-2.5 rounded-xl text-sm outline-none transition-all duration-200"
                      style={{
                        background: 'var(--color-surface)',
                        border: '1px solid var(--color-border)',
                        color: 'var(--color-text)',
                      }}
                      onFocus={(e) => (e.target.style.borderColor = 'var(--color-brand)')}
                      onBlur={(e) => (e.target.style.borderColor = 'var(--color-border)')}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>
                      Port
                    </label>
                    <input
                      id="imap-port"
                      type="number"
                      name="imap_port"
                      value={form.imap_port}
                      onChange={handleChange}
                      placeholder="993"
                      className="w-full px-4 py-2.5 rounded-xl text-sm outline-none transition-all duration-200"
                      style={{
                        background: 'var(--color-surface)',
                        border: '1px solid var(--color-border)',
                        color: 'var(--color-text)',
                      }}
                      onFocus={(e) => (e.target.style.borderColor = 'var(--color-brand)')}
                      onBlur={(e) => (e.target.style.borderColor = 'var(--color-border)')}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>
                    Email Address
                  </label>
                  <input
                    id="imap-user"
                    type="email"
                    name="imap_user"
                    value={form.imap_user}
                    onChange={handleChange}
                    placeholder={
                      form.imap_host === 'imap.mail.yahoo.com'
                        ? 'your-email@yahoo.com'
                        : 'your-email@gmail.com'
                    }
                    className="w-full px-4 py-2.5 rounded-xl text-sm outline-none transition-all duration-200"
                    style={{
                      background: 'var(--color-surface)',
                      border: '1px solid var(--color-border)',
                      color: 'var(--color-text)',
                    }}
                    onFocus={(e) => (e.target.style.borderColor = 'var(--color-brand)')}
                    onBlur={(e) => (e.target.style.borderColor = 'var(--color-border)')}
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>
                    App Password
                  </label>
                  <div className="relative">
                    <input
                      id="imap-pass"
                      type={showPassword ? 'text' : 'password'}
                      name="imap_pass"
                      value={form.imap_pass}
                      onChange={handleChange}
                      placeholder="Enter your app password"
                      className="w-full px-4 py-2.5 pr-12 rounded-xl text-sm outline-none transition-all duration-200"
                      style={{
                        background: 'var(--color-surface)',
                        border: '1px solid var(--color-border)',
                        color: 'var(--color-text)',
                      }}
                      onFocus={(e) => (e.target.style.borderColor = 'var(--color-brand)')}
                      onBlur={(e) => (e.target.style.borderColor = 'var(--color-border)')}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded cursor-pointer"
                      style={{ color: 'var(--color-text-secondary)' }}
                    >
                      {showPassword ? (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                            d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" />
                        </svg>
                      ) : (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                            d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                            d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      )}
                    </button>
                  </div>
                  <p className="text-xs mt-1.5" style={{ color: 'var(--color-text-secondary)' }}>
                    {form.imap_host === 'imap.mail.yahoo.com' ? (
                      <>Generate an App Password from Yahoo Account Security settings.</>
                    ) : (
                      <>
                        For Gmail, use an{' '}
                        <a
                          href="https://myaccount.google.com/apppasswords"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="underline"
                          style={{ color: 'var(--color-brand-light)' }}
                        >
                          App Password
                        </a>
                        , not your regular password
                      </>
                    )}
                  </p>
                </div>
              </>
            )}
          </div>

          <div
            className="mt-6 px-4 py-3 rounded-xl text-xs flex items-start gap-2"
            style={{
              background: 'rgba(99,102,241,0.06)',
              border: '1px solid rgba(99,102,241,0.15)',
              color: 'var(--color-text-secondary)',
            }}
          >
            <svg className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: 'var(--color-brand-light)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>
              Credentials are stored in the local SQLite database. 
              This demo stores the app password in plain text for simplicity.
            </span>
          </div>
        </div>

        {message && (
          <div
            className="mt-4 px-4 py-3 rounded-xl text-sm animate-fade-in flex items-center gap-2"
            style={{
              background: message.type === 'success' ? 'rgba(52,211,153,0.1)' : 'rgba(251,113,133,0.1)',
              border: `1px solid ${message.type === 'success' ? 'rgba(52,211,153,0.25)' : 'rgba(251,113,133,0.25)'}`,
              color: message.type === 'success' ? 'var(--color-accent-green)' : 'var(--color-accent-rose)',
            }}
          >
            {message.type === 'success' ? (
              <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            )}
            {message.text}
          </div>
        )}

        <div className="mt-6 flex items-center gap-3">
          {form.imap_host !== 'outlook.office365.com' && (
            <button
              id="save-settings-btn"
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-all duration-300 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
              style={{
                background: saving
                  ? 'var(--color-surface-light)'
                  : 'linear-gradient(135deg, var(--color-brand) 0%, #8b5cf6 100%)',
                boxShadow: saving ? 'none' : '0 4px 16px rgba(99,102,241,0.35)',
              }}
              onMouseEnter={(e) => {
                if (!saving) e.currentTarget.style.transform = 'translateY(-1px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              {saving ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Saving…
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Save Settings
                </>
              )}
            </button>
          )}

          <button
            id="test-connection-btn"
            type="button"
            disabled={testing || (!hasCredentials && !isMicrosoftOauth)}
            onClick={handleTest}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            style={{
              background: 'transparent',
              border: '1px solid var(--color-border)',
              color: 'var(--color-text)',
            }}
            onMouseEnter={(e) => {
              if (!testing) {
                e.currentTarget.style.borderColor = 'var(--color-brand)';
                e.currentTarget.style.color = 'var(--color-brand-light)';
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'var(--color-border)';
              e.currentTarget.style.color = 'var(--color-text)';
            }}
          >
            {testing ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Testing…
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                Test Connection
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
