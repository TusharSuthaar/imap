import Sidebar from './Sidebar';
import { useLocation } from 'react-router-dom';

export default function Layout({ children }) {
  const location = useLocation();
  const isMailRoute = location.pathname === '/';

  return (
    <div className="h-screen flex">
      <Sidebar />
      <main className="flex-1 h-screen flex flex-col overflow-hidden"
        style={{ marginLeft: 'var(--sidebar-w)', background: isMailRoute ? 'var(--bg-white)' : 'var(--bg)' }}>
        <div className={isMailRoute ? "w-full h-full flex" : "p-8 max-w-7xl mx-auto flex-1 overflow-y-auto w-full"}>
          {children}
        </div>
      </main>
    </div>
  );
}
