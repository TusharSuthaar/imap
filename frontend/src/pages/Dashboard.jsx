import { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../api/client';

const SYNC_INTERVAL = 60000;
const FOLDERS = [
  { id: 'Inbox', label: 'Inbox', icon: 'M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z' },
  { id: 'Sent Items', label: 'Sent', icon: 'M2.01 21L23 12 2.01 3 2 10l15 2-15 2z' },
  { id: 'Drafts', label: 'Drafts', icon: 'M21.04 12.13c.14 0 .27.06.38.17l1.28 1.28c.22.21.22.56 0 .77l-1 1-2.05-2.05 1-1c.11-.11.25-.17.39-.17zM3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25z' },
  { id: 'Archive', label: 'Archive', icon: 'M20.54 5.23l-1.39-1.68C18.88 3.21 18.47 3 18 3H6c-.47 0-.88.21-1.16.55L3.46 5.23C3.17 5.57 3 6.02 3 6.5V19c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V6.5c0-.48-.17-.93-.46-1.27zM12 17.5L6.5 12H10v-2h4v2h3.5L12 17.5zM5.12 5l.81-1h12l.94 1H5.12z' },
  { id: 'Junk Email', label: 'Spam', icon: 'M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z' },
];

const strip = h => h ? h.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim() : '';
const ago = d => { const s = Math.floor((Date.now() - new Date(d)) / 1000); if (s < 60) return 'now'; if (s < 3600) return `${Math.floor(s/60)}m`; if (s < 86400) return `${Math.floor(s/3600)}h`; return new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }); };
const who = (e, f) => { if (f === 'Sent Items') { const t = e.to_address || ''; return t ? `To: ${t.split(',')[0].split('@')[0]}` : 'To: ...'; } return e.from_email?.split('@')[0] || '?'; };
const matchF = (cat, fid) => (!cat || cat === '') ? fid === 'Inbox' : cat.toLowerCase() === fid.toLowerCase();

export default function Dashboard() {
  const [emails, setEmails] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState('');
  const [folder, setFolder] = useState('Inbox');
  const [selected, setSelected] = useState(null);
  const [selectedBody, setSelectedBody] = useState('');
  const [selectedAttachments, setSelectedAttachments] = useState([]);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [lastSync, setLastSync] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Compose
  const [compose, setCompose] = useState(false);
  const [cTo, setCTo] = useState('');
  const [cCc, setCCc] = useState('');
  const [cBcc, setCBcc] = useState('');
  const [cSubject, setCSubject] = useState('');
  const [showCcBcc, setShowCcBcc] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState(null);
  const [attachments, setAttachments] = useState([]);
  const editorRef = useRef(null);
  const fileRef = useRef(null);

  const load = useCallback(async () => {
    try { setLoading(true); const r = await api.get('/emails'); setEmails(Array.isArray(r?.data) ? r.data : (Array.isArray(r) ? r : [])); } catch (e) { console.error(e); } finally { setLoading(false); }
  }, []);

  const sync = useCallback(async (silent = false) => {
    try { if (!silent) setSyncing(true); setSyncMsg('Syncing...'); await api.get('/emails/fetch'); setSyncMsg('Refreshing...'); await load(); setLastSync(new Date()); setSyncMsg(''); } catch (e) { console.error(e); setSyncMsg(''); } finally { setSyncing(false); }
  }, [load]);

  const openEmail = async (id) => {
    const e = emails.find(em => em.id === id);
    if (!e) return;
    setSelected(e);
    setLoadingDetail(true);
    setSelectedBody('');
    setSelectedAttachments([]);
    
    // Mark as read immediately in UI and DB
    if (!e.is_read) {
      setEmails(prev => prev.map(em => em.id === id ? { ...em, is_read: 1 } : em));
      api.post(`/emails/${id}/read`).catch(console.error);
    }

    try {
      const res = await api.get(`/emails/${id}/attachments`);
      if (res.data.success) {
        setSelectedBody(res.data.body || '');
        setSelectedAttachments(res.data.attachments || []);
      }
    } catch (err) {
      console.error('Failed to load email details:', err);
      setSelectedBody(e.body || '');
    } finally {
      setLoadingDetail(false);
    }
  };

  // Formatting
  const fmt = (cmd, val) => { document.execCommand(cmd, false, val || null); editorRef.current?.focus(); };

  // Attachments
  const addFiles = (e) => {
    const files = Array.from(e.target.files);
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = reader.result.split(',')[1];
        setAttachments(prev => [...prev, { name: file.name, size: file.size, type: file.type, base64 }]);
      };
      reader.readAsDataURL(file);
    });
    e.target.value = '';
  };
  const removeFile = (idx) => setAttachments(prev => prev.filter((_, i) => i !== idx));
  const formatSize = (b) => b < 1024 ? b + 'B' : b < 1048576 ? (b / 1024).toFixed(1) + 'KB' : (b / 1048576).toFixed(1) + 'MB';

  // Send
  const send = async () => {
    if (!cTo || !cSubject) return setSendResult({ ok: false, msg: 'To and Subject required' });
    try {
      setSending(true); setSendResult(null);
      const body = editorRef.current?.innerHTML || '';
      await api.post('/emails/send', { to: cTo, cc: cCc, bcc: cBcc, subject: cSubject, body, attachments });
      setSendResult({ ok: true, msg: 'Sent!' });
      setTimeout(() => { resetCompose(); sync(true); }, 1200);
    } catch (e) { setSendResult({ ok: false, msg: e.message }); } finally { setSending(false); }
  };

  const resetCompose = () => {
    setCompose(false); setCTo(''); setCCc(''); setCBcc(''); setCSubject('');
    setShowCcBcc(false); setSendResult(null); setAttachments([]);
    if (editorRef.current) editorRef.current.innerHTML = '';
  };

  const openCompose = (opts = {}) => {
    setCTo(opts.to || ''); setCCc(opts.cc || ''); setCBcc(opts.bcc || '');
    setCSubject(opts.subject || ''); setShowCcBcc(!!(opts.cc || opts.bcc));
    setAttachments([]); setSendResult(null); setCompose(true);
    setTimeout(() => { if (editorRef.current) editorRef.current.innerHTML = opts.body || ''; }, 50);
  };

  useEffect(() => { load(); const t = setInterval(() => sync(true), SYNC_INTERVAL); return () => clearInterval(t); }, [load, sync]);

  // Handle ?open=emailId deep link from Contacts
  const [searchParams, setSearchParams] = useSearchParams();
  useEffect(() => {
    const openId = searchParams.get('open');
    if (openId && emails.length > 0) {
      // Find which folder this email is in and switch to it
      const target = emails.find(e => String(e.id) === openId);
      if (target) {
        const emailFolder = FOLDERS.find(f => matchF(target.category, f.id));
        if (emailFolder) setFolder(emailFolder.id);
      }
      openEmail(parseInt(openId));
      setSearchParams({}, { replace: true }); // clean URL
    }
  }, [searchParams, emails]);

  const folderEmails = emails.filter(e => e && matchF(e.category, folder));
  const displayed = searchQuery
    ? folderEmails.filter(e => (e.subject || '').toLowerCase().includes(searchQuery.toLowerCase()) || (e.from_email || '').toLowerCase().includes(searchQuery.toLowerCase()))
    : folderEmails;
  const counts = {};
  const unreadCounts = {};
  FOLDERS.forEach(f => {
    const fEmails = emails.filter(e => e && matchF(e.category, f.id));
    counts[f.id] = fEmails.length;
    unreadCounts[f.id] = fEmails.filter(e => !e.is_read).length;
  });

  return (
    <div className="flex w-full h-full" style={{ fontFamily: 'var(--font)' }}>

      {/* ═══ FOLDER PANE ═══ */}
      <div className="w-56 flex-shrink-0 flex flex-col border-r" style={{ borderColor: 'var(--border)', background: 'var(--bg)' }}>
        <div className="p-3">
          <button onClick={() => openCompose()}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-[13px] font-semibold text-white transition-all active:scale-[0.97] shadow-md hover:shadow-lg"
            style={{ background: 'linear-gradient(135deg, #6366f1 0%, #818cf8 100%)' }}>
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1.003 1.003 0 000-1.42l-2.34-2.34a1.003 1.003 0 00-1.42 0l-1.83 1.83 3.75 3.75 1.84-1.82z"/></svg>
            Compose
          </button>
        </div>
        <nav className="flex-1 overflow-y-auto px-2 space-y-0.5">
          {FOLDERS.map(f => {
            const a = folder === f.id;
            const displayCount = f.id === 'Inbox' ? unreadCounts[f.id] : counts[f.id];
            return (
              <button key={f.id} onClick={() => { setFolder(f.id); setSelected(null); }}
                className="w-full flex items-center gap-2.5 px-3 py-[7px] rounded-lg text-[13px] transition-all duration-100 group"
                style={{ background: a ? 'var(--bg-white)' : 'transparent', color: a ? 'var(--brand)' : 'var(--text-secondary)', fontWeight: a ? 600 : 400, boxShadow: a ? '0 1px 3px rgba(0,0,0,0.06)' : 'none' }}>
                <svg className="w-[17px] h-[17px] flex-shrink-0" viewBox="0 0 24 24" fill="currentColor" style={{ opacity: a ? 1 : 0.5 }}><path d={f.icon}/></svg>
                <span className="flex-1 text-left">{f.label}</span>
                {displayCount > 0 && <span className="text-[11px] font-medium px-1.5 rounded-md" style={{ background: a ? 'var(--brand-light)' : 'var(--border-light)', color: a ? 'var(--brand)' : 'var(--text-muted)' }}>{displayCount}</span>}
              </button>
            );
          })}
        </nav>
        <div className="px-3 py-2.5 border-t text-[11px] flex items-center justify-between" style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
          <span>{lastSync ? `Synced ${ago(lastSync)}` : 'Not synced'}</span>
          <button onClick={() => sync(false)} disabled={syncing} className="p-1 rounded-md hover:bg-white transition-colors disabled:opacity-40" title="Sync">
            <svg className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
            </svg>
          </button>
        </div>
      </div>

      {/* ═══ EMAIL LIST ═══ */}
      <div className="w-[360px] flex-shrink-0 flex flex-col border-r" style={{ borderColor: 'var(--border)', background: 'var(--bg-white)' }}>
        {syncing && <div className="h-[2px] overflow-hidden" style={{ background: 'var(--brand-light)' }}><div className="h-full rounded-full" style={{ background: 'var(--brand)', animation: 'progress 2s ease-in-out infinite' }} /></div>}

        <div className="px-4 pt-4 pb-3">
          <h2 className="text-[16px] font-semibold mb-3" style={{ color: 'var(--text)' }}>
            {FOLDERS.find(f => f.id === folder)?.label}
            <span className="text-[12px] font-normal ml-2" style={{ color: 'var(--text-muted)' }}>{displayed.length}</span>
          </h2>
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-muted)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
            <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search mail..."
              className="w-full pl-9 pr-3 py-2 rounded-lg text-[13px] border transition-colors"
              style={{ borderColor: 'var(--border)', background: 'var(--bg)' }} />
          </div>
        </div>

        {syncing && syncMsg && (
          <div className="mx-4 mb-2 px-3 py-1.5 rounded-lg text-[12px] font-medium flex items-center gap-2" style={{ background: 'var(--brand-light)', color: 'var(--brand)' }}>
            <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
            {syncMsg}
          </div>
        )}

        <div className="flex-1 overflow-y-auto">
          {loading && !syncing ? (
            <div className="flex flex-col items-center justify-center h-full" style={{ color: 'var(--text-muted)' }}>
              <svg className="w-5 h-5 animate-spin mb-2" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
              <span className="text-[12px]">Loading...</span>
            </div>
          ) : displayed.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full px-8 text-center" style={{ color: 'var(--text-muted)' }}>
              <svg className="w-8 h-8 mb-2 opacity-30" viewBox="0 0 24 24" fill="currentColor"><path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/></svg>
              <p className="text-[13px]">No messages</p>
            </div>
          ) : (
            displayed.map(e => {
              const act = selected?.id === e.id;
              const unread = !e.is_read;
              return (
                <div key={e.id} onClick={() => openEmail(e.id)}
                  className="px-4 py-3 cursor-pointer transition-all duration-75 border-b relative"
                  style={{ borderColor: 'var(--border-light)', background: act ? 'var(--brand-light)' : unread ? '#f8f9ff' : 'transparent' }}>
                  {act && <div className="absolute left-0 top-0 bottom-0 w-[3px] rounded-r" style={{ background: 'var(--brand)' }}/>}
                  <div className="flex justify-between items-baseline mb-0.5">
                    <div className="flex items-center gap-2 min-w-0 pr-2">
                      {unread && <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: 'var(--brand)' }}/>}
                      <span className={`text-[13px] truncate ${unread ? 'font-bold' : 'font-medium'}`} style={{ color: 'var(--text)' }}>{who(e, folder)}</span>
                    </div>
                    <span className="text-[11px] flex-shrink-0" style={{ color: 'var(--text-muted)' }}>{ago(e.received_at)}</span>
                  </div>
                  <div className={`text-[13px] truncate ${unread ? 'font-semibold' : 'font-normal'}`} style={{ color: unread ? 'var(--text)' : 'var(--text-secondary)' }}>{e.subject || '(No subject)'}</div>
                  <div className="text-[12px] truncate mt-0.5" style={{ color: 'var(--text-muted)' }}>{strip(e.body).substring(0, 100) || '...'}</div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ═══ READING PANE ═══ */}
      <div className="flex-1 flex flex-col overflow-hidden" style={{ background: 'var(--bg-white)' }}>
        {loadingDetail ? (
          <div className="flex h-full items-center justify-center"><svg className="w-5 h-5 animate-spin" style={{ color: 'var(--brand)' }} fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg></div>
        ) : !selected ? (
          <div className="flex flex-col h-full items-center justify-center" style={{ color: 'var(--text-muted)' }}>
            <svg className="w-12 h-12 mb-3 opacity-20" viewBox="0 0 24 24" fill="currentColor"><path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/></svg>
            <p className="text-[14px]">Select a message to read</p>
          </div>
        ) : (
          <div className="flex flex-col h-full animate-fade-in">
            {/* Actions Bar */}
            <div className="px-6 py-2.5 border-b flex items-center gap-1" style={{ borderColor: 'var(--border-light)' }}>
              {[
                { label: 'Reply', action: () => openCompose({ to: selected.from_email, subject: `Re: ${selected.subject}` }),
                  d: 'M10 9V5l-7 7 7 7v-4.1c5 0 8.5 1.6 11 5.1-1-5-4-10-11-11z' },
                { label: 'Reply All', action: () => openCompose({ to: [selected.from_email, selected.to_address].filter(Boolean).join(', '), cc: selected.cc_address || '', subject: `Re: ${selected.subject}` }),
                  d: 'M7 8V5l-7 7 7 7v-3l-4-4 4-4zm6 1V5l-7 7 7 7v-4.1c5 0 8.5 1.6 11 5.1-1-5-4-10-11-11z' },
                { label: 'Forward', action: () => openCompose({ subject: `Fwd: ${selected.subject}`, body: `<br><br><hr><p><b>From:</b> ${selected.from_email}<br><b>Date:</b> ${new Date(selected.received_at).toLocaleString()}<br><b>Subject:</b> ${selected.subject}</p><br>${selected.body || ''}` }),
                  d: 'M12 8V4l8 8-8 8v-4H4V8h8z' },
              ].map(btn => (
                <button key={btn.label} onClick={btn.action}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium transition-colors hover:bg-gray-100"
                  style={{ color: 'var(--text-secondary)' }}>
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d={btn.d}/></svg>
                  {btn.label}
                </button>
              ))}
            </div>

            {/* Header */}
            <div className="px-8 pt-6 pb-5">
              <h1 className="text-[20px] font-semibold mb-4" style={{ color: 'var(--text)', lineHeight: 1.3 }}>{selected.subject || '(No subject)'}</h1>
              <div className="flex gap-3 items-start">
                <div className="w-10 h-10 rounded-full flex items-center justify-center text-white text-[14px] font-bold uppercase shrink-0 shadow-sm"
                  style={{ background: `hsl(${(selected.from_email||'').length * 30 % 360}, 50%, 50%)` }}>
                  {(selected.from_email || '?').charAt(0)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <span className="font-semibold text-[14px]" style={{ color: 'var(--text)' }}>{selected.from_email}</span>
                    <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{new Date(selected.received_at).toLocaleString()}</span>
                  </div>
                  {selected.to_address && <div className="text-[12px] mt-0.5" style={{ color: 'var(--text-secondary)' }}>To: {selected.to_address}</div>}
                  {selected.cc_address && <div className="text-[12px]" style={{ color: 'var(--text-muted)' }}>Cc: {selected.cc_address}</div>}
                </div>
              </div>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-8 pb-8">
              <div className="email-render text-[14px] leading-relaxed" style={{ color: 'var(--text)' }} dangerouslySetInnerHTML={{ __html: selectedBody || selected.body }} />
              
              {/* Attachments List */}
              {selectedAttachments.length > 0 && (
                <div className="mt-8 pt-6 border-t" style={{ borderColor: 'var(--border-light)' }}>
                  <h3 className="text-[13px] font-semibold mb-3 flex items-center gap-2" style={{ color: 'var(--text)' }}>
                    <svg className="w-4 h-4" style={{ color: 'var(--text-muted)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"/></svg>
                    Attachments ({selectedAttachments.length})
                  </h3>
                  <div className="flex flex-wrap gap-3 mt-4">
                    {selectedAttachments.map((att, i) => {
                      const isImg = att.contentType?.startsWith('image/');
                      return (
                        <a key={i} href={att.dataUri} download={att.name}
                          className="flex flex-col overflow-hidden rounded-xl border transition-all hover:shadow-md group"
                          style={{ borderColor: 'var(--border)', width: isImg ? '220px' : '200px', background: 'var(--bg-white)' }}>
                          
                          {isImg ? (
                            <div className="w-full h-28 bg-gray-100 border-b relative" style={{ borderColor: 'var(--border-light)' }}>
                              <img src={att.dataUri} alt={att.name} className="w-full h-full object-cover" />
                              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                                <svg className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-md" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-center gap-3 p-3 border-b border-transparent">
                              <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'var(--bg)' }}>
                                <svg className="w-5 h-5" style={{ color: 'var(--brand)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
                              </div>
                            </div>
                          )}
                          
                          <div className={`p-3 min-w-0 ${!isImg ? '-mt-12 ml-12' : ''}`}>
                            <div className="text-[13px] font-semibold truncate group-hover:text-blue-600 transition-colors" title={att.name} style={{ color: 'var(--text)' }}>{att.name}</div>
                            <div className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{formatSize(att.size)}</div>
                          </div>
                        </a>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ═══ COMPOSE MODAL ═══ */}
      {compose && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/25 backdrop-blur-[3px]" onClick={resetCompose} />
          <div className="relative bg-white w-full max-w-[680px] rounded-2xl shadow-2xl flex flex-col max-h-[88vh] overflow-hidden animate-slide-up border" style={{ borderColor: 'var(--border)' }}>

            {/* Compose Header */}
            <div className="px-5 py-3 flex items-center justify-between" style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)' }}>
              <span className="font-semibold text-[14px]" style={{ color: 'var(--text)' }}>New Message</span>
              <button onClick={resetCompose} className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-gray-200 transition-colors" style={{ color: 'var(--text-muted)' }}>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
              </button>
            </div>

            {/* Status */}
            {sendResult && (
              <div className="px-5 py-2 text-[13px] font-medium" style={{ background: sendResult.ok ? '#ecfdf5' : '#fef2f2', color: sendResult.ok ? '#059669' : '#dc2626' }}>
                {sendResult.msg}
              </div>
            )}

            {/* Recipients */}
            <div className="text-[13px]" style={{ borderBottom: '1px solid var(--border-light)' }}>
              <div className="flex items-center px-5 py-2 gap-2">
                <span className="w-8 font-medium" style={{ color: 'var(--text-muted)' }}>To</span>
                <input value={cTo} onChange={e => setCTo(e.target.value)} className="flex-1 outline-none bg-transparent" style={{ color: 'var(--text)' }} placeholder="Recipients (comma-separated)" />
                {!showCcBcc && <button onClick={() => setShowCcBcc(true)} className="text-[12px] font-medium px-2 py-0.5 rounded hover:bg-gray-100 transition-colors" style={{ color: 'var(--brand)' }}>Cc Bcc</button>}
              </div>
              {showCcBcc && (
                <>
                  <div className="flex items-center px-5 py-2 gap-2 border-t" style={{ borderColor: 'var(--border-light)' }}>
                    <span className="w-8 font-medium" style={{ color: 'var(--text-muted)' }}>Cc</span>
                    <input value={cCc} onChange={e => setCCc(e.target.value)} className="flex-1 outline-none bg-transparent" style={{ color: 'var(--text)' }} />
                  </div>
                  <div className="flex items-center px-5 py-2 gap-2 border-t" style={{ borderColor: 'var(--border-light)' }}>
                    <span className="w-8 font-medium" style={{ color: 'var(--text-muted)' }}>Bcc</span>
                    <input value={cBcc} onChange={e => setCBcc(e.target.value)} className="flex-1 outline-none bg-transparent" style={{ color: 'var(--text)' }} />
                  </div>
                </>
              )}
              <div className="flex items-center px-5 py-2 gap-2 border-t" style={{ borderColor: 'var(--border-light)' }}>
                <input value={cSubject} onChange={e => setCSubject(e.target.value)} placeholder="Subject" className="flex-1 outline-none bg-transparent text-[14px] font-medium" style={{ color: 'var(--text)' }} />
              </div>
            </div>

            {/* Formatting Toolbar */}
            <div className="flex items-center gap-0.5 px-5 py-1.5 border-b" style={{ borderColor: 'var(--border-light)' }}>
              {[
                { cmd: 'bold', icon: 'B', style: { fontWeight: 700 } },
                { cmd: 'italic', icon: 'I', style: { fontStyle: 'italic' } },
                { cmd: 'underline', icon: 'U', style: { textDecoration: 'underline' } },
                { cmd: 'strikeThrough', icon: 'S', style: { textDecoration: 'line-through' } },
                null,
                { cmd: 'insertUnorderedList', icon: '•', style: {} },
                { cmd: 'insertOrderedList', icon: '1.', style: {} },
                null,
                { cmd: 'justifyLeft', svg: 'M3 21h18M3 17h12M3 13h18M3 9h12M3 5h18' },
                { cmd: 'justifyCenter', svg: 'M3 21h18M6 17h12M3 13h18M6 9h12M3 5h18' },
              ].map((item, i) => item === null ? (
                <div key={`sep-${i}`} className="w-px h-4 mx-1" style={{ background: 'var(--border)' }} />
              ) : (
                <button key={item.cmd} onClick={() => fmt(item.cmd)}
                  className="w-7 h-7 rounded flex items-center justify-center text-[13px] hover:bg-gray-100 transition-colors"
                  style={{ color: 'var(--text-secondary)', ...item.style }} title={item.cmd}>
                  {item.svg ? <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={item.svg}/></svg> : item.icon}
                </button>
              ))}

              <div className="w-px h-4 mx-1" style={{ background: 'var(--border)' }} />

              {/* Font Size */}
              <select onChange={e => fmt('fontSize', e.target.value)} defaultValue="3"
                className="text-[12px] px-1 py-0.5 rounded border outline-none cursor-pointer" style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)', background: 'transparent' }}>
                <option value="1">Small</option>
                <option value="3">Normal</option>
                <option value="5">Large</option>
                <option value="7">Huge</option>
              </select>

              {/* Color */}
              <input type="color" defaultValue="#000000" onChange={e => fmt('foreColor', e.target.value)}
                className="w-6 h-6 border-0 p-0 cursor-pointer rounded" title="Text color" />

              {/* Link */}
              <button onClick={() => { const url = prompt('Enter URL:'); if (url) fmt('createLink', url); }}
                className="w-7 h-7 rounded flex items-center justify-center hover:bg-gray-100 transition-colors" style={{ color: 'var(--text-secondary)' }} title="Insert link">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"/></svg>
              </button>
            </div>

            {/* Editor */}
            <div className="flex-1 overflow-y-auto px-5 py-3 min-h-[180px]">
              <div ref={editorRef} contentEditable suppressContentEditableWarning
                className="rich-editor" data-placeholder="Write your message..." />
            </div>

            {/* Attachments */}
            {attachments.length > 0 && (
              <div className="px-5 py-2 border-t flex flex-wrap gap-2" style={{ borderColor: 'var(--border-light)' }}>
                {attachments.map((f, i) => (
                  <div key={i} className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-[12px] group" style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}>
                    <svg className="w-3.5 h-3.5 flex-shrink-0" style={{ color: 'var(--text-muted)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"/></svg>
                    <span className="font-medium truncate max-w-[120px]" style={{ color: 'var(--text)' }}>{f.name}</span>
                    <span style={{ color: 'var(--text-muted)' }}>{formatSize(f.size)}</span>
                    <button onClick={() => removeFile(i)} className="text-gray-400 hover:text-red-500 transition-colors ml-1">×</button>
                  </div>
                ))}
              </div>
            )}

            {/* Footer */}
            <div className="px-5 py-3 flex items-center justify-between" style={{ background: 'var(--bg)', borderTop: '1px solid var(--border)' }}>
              <div className="flex items-center gap-1">
                <input ref={fileRef} type="file" multiple onChange={addFiles} className="hidden" />
                <button onClick={() => fileRef.current?.click()}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium hover:bg-gray-200 transition-colors"
                  style={{ color: 'var(--text-secondary)' }} title="Attach files">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"/></svg>
                  Attach
                </button>
                <button onClick={resetCompose} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium hover:bg-red-50 hover:text-red-500 transition-colors" style={{ color: 'var(--text-muted)' }}>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                  Discard
                </button>
              </div>
              <button onClick={send} disabled={sending}
                className="px-5 py-2 rounded-xl text-[13px] font-semibold text-white transition-all disabled:opacity-50 active:scale-[0.97] shadow-md hover:shadow-lg flex items-center gap-2"
                style={{ background: 'linear-gradient(135deg, #6366f1, #818cf8)' }}>
                {sending ? <><svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg> Sending...</> : <>Send <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg></>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
