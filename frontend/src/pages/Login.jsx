import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const [error, setError] = useState(null);

  useEffect(() => {
    // Check URL for incoming JWT token
    const params = new URLSearchParams(location.search);
    const token = params.get('token');
    const msalError = params.get('msal_error');
    const errorDesc = params.get('error_desc');

    if (token) {
      // Option A: Seamless Login via Microsoft
      localStorage.setItem('token', token);
      // Clean up URL and redirect to dashboard
      window.history.replaceState({}, document.title, '/');
      navigate('/');
    } else if (msalError) {
      setError(errorDesc || 'Failed to authenticate with Microsoft.');
      window.history.replaceState({}, document.title, '/login');
    } else {
      // If a token already exists in localStorage, skip login
      const existingToken = localStorage.getItem('token');
      if (existingToken) {
        navigate('/');
      }
    }
  }, [location, navigate]);

  const handleMicrosoftLogin = () => {
    // Redirect to backend OAuth initiator
    window.location.href = '/api/auth/microsoft';
  };

  return (
    <div className="min-h-screen bg-[#f3f4f6] flex flex-col justify-center items-center p-4">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-10 max-w-md w-full animate-fade-in text-center">
        
        <div className="w-16 h-16 mx-auto bg-indigo-50 rounded-2xl flex items-center justify-center mb-6">
          <svg className="w-8 h-8 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 19v-8.93a2 2 0 01.89-1.664l7-4.666a2 2 0 012.22 0l7 4.666A2 2 0 0121 10.07V19M3 19a2 2 0 002 2h14a2 2 0 002-2M3 19l6.75-4.5M21 19l-6.75-4.5M3 10l6.75 4.5M21 10l-6.75 4.5M10 12h4" />
          </svg>
        </div>

        <h1 className="text-2xl font-bold text-gray-900 mb-2 mt-4 text-center">EPM CRM Mail</h1>
        <p className="text-[14px] text-gray-500 mb-10 leading-relaxed text-center">
          Sign in with your Microsoft 365 or Outlook account to seamlessly sync your mail and contacts.
        </p>

        {error && (
          <div className="mb-6 p-4 bg-red-50 text-red-700 rounded-xl text-[13px] text-left border border-red-100 flex items-start gap-3">
            <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>{error}</span>
          </div>
        )}

        <button 
          onClick={handleMicrosoftLogin}
          className="w-full flex items-center justify-center gap-3 px-6 py-3.5 rounded-xl text-[14px] font-semibold text-white transition-all shadow-md hover:shadow-lg active:scale-[0.98]"
          style={{ background: '#0078D4' }}
        >
          <svg className="w-5 h-5" viewBox="0 0 21 21" fill="none">
            <rect width="10" height="10" fill="#f25022"/><rect x="11" width="10" height="10" fill="#7fba00"/>
            <rect y="11" width="10" height="10" fill="#00a4ef"/><rect x="11" y="11" width="10" height="10" fill="#ffb900"/>
          </svg>
          Sign in with Microsoft
        </button>

        <p className="mt-6 text-[12px] text-gray-400">
          Secure, single-sign-on access powered by OAuth 2.0.
        </p>
      </div>
    </div>
  );
}
