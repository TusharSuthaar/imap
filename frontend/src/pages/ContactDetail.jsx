import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import api from '../api/client';

const strip = h => h ? h.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim() : '';

export default function ContactDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [contact, setContact] = useState(null);
  const [emails, setEmails] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedId, setExpandedId] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const res = await api.get(`/contacts/${id}`);
        setContact(res.data.contact);
        setEmails(res.data.emails || []);
      } catch (err) { setError(err.message); } finally { setLoading(false); }
    })();
  }, [id]);

  const fmt = (d) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  if (loading) return (
    <div className="animate-fade-in p-2">
      <div className="skeleton h-8 w-48 mb-6" />
      <div className="skeleton h-24 w-full rounded-2xl mb-6" />
      <div className="space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="skeleton h-28 w-full rounded-xl" />)}</div>
    </div>
  );

  if (error) return (
    <div className="animate-fade-in">
      <div className="rounded-xl px-6 py-10 text-center border" style={{ borderColor: '#fecaca', background: '#fef2f2' }}>
        <p className="text-sm" style={{ color: '#dc2626' }}>{error}</p>
        <Link to="/contacts" className="inline-block mt-4 text-sm font-medium" style={{ color: 'var(--brand)' }}>← Back to Contacts</Link>
      </div>
    </div>
  );

  const sent = emails.filter(e => e.from_email !== contact?.email);
  const received = emails.filter(e => e.from_email === contact?.email);

  return (
    <div className="animate-fade-in">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 mb-6 text-[13px]">
        <Link to="/contacts" className="transition-colors hover:underline" style={{ color: 'var(--text-muted)' }}>People</Link>
        <svg className="w-3 h-3" style={{ color: 'var(--text-muted)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/></svg>
        <span style={{ color: 'var(--text)' }}>{contact?.name || contact?.email}</span>
      </div>

      {/* Contact Card */}
      <div className="rounded-xl border p-5 mb-6 flex items-center gap-4" style={{ borderColor: 'var(--border)', background: 'var(--bg-white)' }}>
        <div className="w-12 h-12 rounded-full flex items-center justify-center text-white text-lg font-bold flex-shrink-0"
          style={{ background: `hsl(${Math.abs([...contact?.email||''].reduce((h,c)=>c.charCodeAt(0)+((h<<5)-h),0)) % 360}, 55%, 50%)` }}>
          {(contact?.name || contact?.email || '?').charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="text-[18px] font-semibold" style={{ color: 'var(--text)' }}>{contact?.name || contact?.email?.split('@')[0]}</h1>
          <p className="text-[13px]" style={{ color: 'var(--text-muted)' }}>{contact?.email}</p>
        </div>
        <div className="flex gap-3 text-[12px] font-medium">
          <div className="px-3 py-1.5 rounded-lg" style={{ background: '#eef2ff', color: 'var(--brand)' }}>
            {emails.length} total
          </div>
          <div className="px-3 py-1.5 rounded-lg" style={{ background: '#ecfdf5', color: '#059669' }}>
            {received.length} received
          </div>
          <div className="px-3 py-1.5 rounded-lg" style={{ background: '#fef3c7', color: '#d97706' }}>
            {sent.length} sent
          </div>
        </div>
      </div>

      {/* Emails as clean cards */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-[15px] font-semibold" style={{ color: 'var(--text)' }}>Conversations</h2>
        <span className="text-[12px]" style={{ color: 'var(--text-muted)' }}>{emails.length} emails</span>
      </div>

      {emails.length === 0 ? (
        <div className="rounded-xl border px-6 py-12 text-center" style={{ borderColor: 'var(--border)', background: 'var(--bg-white)' }}>
          <p className="text-[13px]" style={{ color: 'var(--text-muted)' }}>No emails found for this contact.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {emails.map((email) => {
            const isSent = email.from_email !== contact?.email;
            const isExpanded = expandedId === email.id;
            const unread = !email.is_read;

            return (
              <div key={email.id}
                className="rounded-xl border transition-all duration-150 overflow-hidden"
                style={{ borderColor: isExpanded ? 'var(--brand-soft)' : 'var(--border)', background: 'var(--bg-white)', boxShadow: isExpanded ? '0 2px 8px rgba(99,102,241,0.08)' : 'none' }}>

                {/* Row Header — clickable to expand */}
                <div className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors"
                  onClick={() => setExpandedId(isExpanded ? null : email.id)}>

                  {/* Unread dot */}
                  <div className="w-2 flex-shrink-0">
                    {unread && <div className="w-2 h-2 rounded-full" style={{ background: 'var(--brand)' }} />}
                  </div>

                  {/* Direction badge */}
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0"
                    style={{ background: isSent ? '#eef2ff' : '#ecfdf5', color: isSent ? 'var(--brand)' : '#059669' }}>
                    {isSent ? '↑ Sent' : '↓ Received'}
                  </span>

                  {/* Subject */}
                  <span className={`flex-1 text-[13px] truncate ${unread ? 'font-semibold' : ''}`} style={{ color: 'var(--text)' }}>
                    {email.subject || '(No subject)'}
                  </span>

                  {/* Date */}
                  <span className="text-[11px] flex-shrink-0" style={{ color: 'var(--text-muted)' }}>
                    {fmt(email.received_at)}
                  </span>

                  {/* Open in Mail button */}
                  <button onClick={(ev) => { ev.stopPropagation(); navigate(`/?open=${email.id}`); }}
                    className="p-1 rounded hover:bg-gray-100 transition-colors flex-shrink-0" title="Open in Mail"
                    style={{ color: 'var(--text-muted)' }}>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/></svg>
                  </button>

                  {/* Expand chevron */}
                  <svg className={`w-4 h-4 transition-transform duration-200 flex-shrink-0 ${isExpanded ? 'rotate-180' : ''}`}
                    style={{ color: 'var(--text-muted)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/>
                  </svg>
                </div>

                {/* Expanded Details */}
                {isExpanded && (
                  <div className="px-4 pb-4 border-t animate-fade-in" style={{ borderColor: 'var(--border-light)' }}>
                    <div className="pt-3 pb-2 space-y-1 text-[12px]" style={{ color: 'var(--text-secondary)' }}>
                      <div><span className="font-medium" style={{ color: 'var(--text-muted)' }}>From:</span> {email.from_email}</div>
                      {email.to_address && <div><span className="font-medium" style={{ color: 'var(--text-muted)' }}>To:</span> {email.to_address}</div>}
                      {email.cc_address && <div><span className="font-medium" style={{ color: 'var(--text-muted)' }}>Cc:</span> {email.cc_address}</div>}
                    </div>
                    <div className="mt-2 p-3 rounded-lg text-[13px] leading-relaxed" style={{ background: 'var(--bg)', color: 'var(--text-secondary)' }}>
                      {strip(email.body).substring(0, 500)}
                      {(email.body || '').length > 500 && '…'}
                    </div>
                    <button onClick={() => navigate(`/?open=${email.id}`)}
                      className="mt-3 text-[12px] font-medium flex items-center gap-1 transition-colors hover:underline"
                      style={{ color: 'var(--brand)' }}>
                      Open full email →
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
