import Sidebar from './Sidebar';

export default function Layout({ children }) {
  return (
    <div className="min-h-screen flex">
      <Sidebar />
      <main
        className="flex-1 min-h-screen"
        style={{
          marginLeft: 'var(--sidebar-width)',
          background: 'var(--color-surface)',
        }}
      >
        <div className="p-8 max-w-7xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
