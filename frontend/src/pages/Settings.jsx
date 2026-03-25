import { useState, useEffect } from 'react';
import api from '../api/client';

export default function Settings() {
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState(null);
  const [isMicrosoftOauth, setIsMicrosoftOauth] = useState(false);

  useEffect(() => {
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
        setIsMicrosoftOauth(s.is_microsoft_oauth || false);
      } catch {} finally { setLoading(false); }
    })();
  }, []);

  const handleTest = async () => {
    try { setTesting(true); setMessage(null); const res = await api.post('/settings/test'); setMessage({ type: 'success', text: res.message }); }
    catch (err) { setMessage({ type: 'error', text: err.message }); }
    finally { setTesting(false); }
  };

  const handleDisconnect = async () => {
    try {
      setTesting(true); 
      setMessage(null); 
      const res = await api.post('/settings/disconnect'); 
      setIsMicrosoftOauth(false);
      setMessage({ type: 'success', text: res.data?.message || 'Account disconnected successfully.' }); 
    }
    catch (err) { setMessage({ type: 'error', text: err.response?.data?.message || err.message }); }
    finally { setTesting(false); }
  };

  const handleConnect = () => { window.location.href = '/api/auth/microsoft'; };

  if (loading) return <div className="animate-fade-in"><div className="skeleton h-8 w-48 mb-6" /><div className="skeleton h-72 w-full max-w-xl rounded-2xl" /></div>;

  return (
    <div className="animate-fade-in max-w-xl">
      <h1 className="text-[22px] font-semibold mb-1" style={{ color: 'var(--text)' }}>Settings</h1>
      <p className="text-[13px] mb-8" style={{ color: 'var(--text-muted)' }}>Connect your Microsoft account to sync and send emails.</p>

      {/* Status Pill */}
      <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[12px] font-medium mb-6"
        style={{ background: isMicrosoftOauth ? '#ecfdf5' : '#fffbeb', color: isMicrosoftOauth ? '#059669' : '#d97706', border: `1px solid ${isMicrosoftOauth ? '#a7f3d0' : '#fde68a'}` }}>
        <div className="w-1.5 h-1.5 rounded-full" style={{ background: isMicrosoftOauth ? '#10b981' : '#f59e0b' }} />
        {isMicrosoftOauth ? 'Microsoft Account Connected' : 'No account configured'}
      </div>

      {/* Card */}
      <div className="rounded-2xl border p-6" style={{ borderColor: 'var(--border)', background: 'var(--bg-white)' }}>
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'var(--brand-light)' }}>
            <svg className="w-5 h-5" style={{ color: 'var(--brand)' }} viewBox="0 0 24 24" fill="currentColor">
              <path d="M1 1h10v10H1zM13 1h10v10H13zM1 13h10v10H1zM13 13h10v10H13z"/>
            </svg>
          </div>
          <div>
            <h2 className="text-[14px] font-semibold" style={{ color: 'var(--text)' }}>Microsoft Outlook</h2>
            <p className="text-[12px]" style={{ color: 'var(--text-muted)' }}>OAuth 2.0 secure connection</p>
          </div>
        </div>

        {isMicrosoftOauth ? (
          <div className="animate-fade-in">
            <div className="px-4 py-3 rounded-xl flex items-center gap-3 mb-4" style={{ background: '#ecfdf5', border: '1px solid #a7f3d0' }}>
              <svg className="w-5 h-5 flex-shrink-0" style={{ color: '#10b981' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-[13px] font-semibold" style={{ color: '#059669' }}>Connected to Microsoft Outlook</span>
            </div>
            <button onClick={handleConnect}
              className="text-[12px] font-medium px-3 py-1.5 rounded-lg transition-colors hover:bg-gray-100"
              style={{ color: 'var(--brand)' }}>
              Change account or refresh connection →
            </button>
          </div>
        ) : (
          <button onClick={handleConnect}
            className="flex items-center gap-2.5 px-5 py-3 rounded-xl text-[14px] font-semibold text-white transition-all shadow-md hover:shadow-lg active:scale-[0.97]"
            style={{ background: '#0078D4' }}>
            <svg className="w-5 h-5" viewBox="0 0 21 21" fill="none">
              <rect width="10" height="10" fill="#f25022"/><rect x="11" width="10" height="10" fill="#7fba00"/>
              <rect y="11" width="10" height="10" fill="#00a4ef"/><rect x="11" y="11" width="10" height="10" fill="#ffb900"/>
            </svg>
            Connect Microsoft Account
          </button>
        )}

        <div className="mt-5 px-4 py-3 rounded-xl text-[12px] flex items-start gap-2" style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', color: 'var(--text-secondary)' }}>
          <svg className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: '#10b981' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
          <span>Your credentials are securely managed via Microsoft OAuth tokens. Passwords are never stored.</span>
        </div>
      </div>

      {/* Messages */}
      {message && (
        <div className="mt-4 px-4 py-3 rounded-xl text-[13px] animate-fade-in flex items-center gap-2"
          style={{ background: message.type === 'success' ? '#ecfdf5' : '#fef2f2', border: `1px solid ${message.type === 'success' ? '#a7f3d0' : '#fecaca'}`, color: message.type === 'success' ? '#059669' : '#dc2626' }}>
          <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={message.type === 'success' ? 'M5 13l4 4L19 7' : 'M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z'} />
          </svg>
          {message.text}
        </div>
      )}

      {/* Actions */}
      <div className="mt-5 flex items-center gap-3">
        <button disabled={testing || !isMicrosoftOauth} onClick={handleTest}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-[13px] font-medium transition-all border disabled:opacity-40"
          style={{ borderColor: 'var(--border)', color: 'var(--text)', background: 'var(--bg-white)' }}>
          {testing ? (
            <><svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg> Testing...</>
          ) : (
            <><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z"/></svg> Test Connection</>
          )}
        </button>

        {isMicrosoftOauth && (
          <button disabled={testing} onClick={handleDisconnect}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-[13px] font-medium transition-all border border-red-200 text-red-600 bg-red-50 hover:bg-red-100 disabled:opacity-40">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Disconnect Account
          </button>
        )}
      </div>
    </div>
  );
}
