import { useContext, useState } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { LayoutDashboard, FileUp, PenTool, Search, LogOut, Menu, X, Award, Sun, Moon, MessageSquare } from 'lucide-react';
import { AuthContext } from '../context/AuthContext';
import Footer from './Footer';
import { useTheme } from '../context/ThemeContext';

export default function Layout({ children }) {
  const { user, logout } = useContext(AuthContext);
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const menu = [
    { name: 'Dashboard', path: '/', icon: <LayoutDashboard className="w-4.5 h-4.5" /> },
    { name: 'Upload Data', path: '/upload', icon: <FileUp className="w-4.5 h-4.5" /> },
    { name: 'Editor', path: '/designer', icon: <PenTool className="w-4.5 h-4.5" /> },
    { name: 'Verify', path: '/verify-portal', icon: <Search className="w-4.5 h-4.5" /> },
  ];

  const visibleMenu = menu.filter(item => !item.requireAdmin || user?.role === 'admin');

  // The toggle label shows the CURRENT state. The icon shows what clicking will switch TO.
  const isDark = theme === 'dark';

  const SidebarContent = () => (
    <>
      {/* Logo */}
      <div className="px-6 pt-7 pb-5 flex items-center space-x-3">
        <Link to="/" onClick={() => setIsMobileMenuOpen(false)} className="flex items-center space-x-3 group">
          <div className="w-9 h-9 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/30 group-hover:scale-105 transition-transform duration-300">
            <Award className="w-5 h-5 text-white" />
          </div>
          <span className="text-xl font-black tracking-tight text-[var(--text-primary)]">
            DigiCertify
          </span>
        </Link>
      </div>

      {/* Divider */}
      <div className="mx-5 border-t border-[var(--border-subtle)]" />

      {/* Nav */}
      <nav className="flex-1 px-3 py-5 space-y-1">
        {visibleMenu.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.name}
              to={item.path}
              onClick={() => setIsMobileMenuOpen(false)}
              className={`flex items-center space-x-3 px-4 py-2.5 rounded-xl transition-all duration-200 group relative ${
                isActive
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/25'
                  : 'text-[var(--text-secondary)] hover:bg-[var(--border-subtle)] hover:text-[var(--text-primary)]'
              }`}
            >
              {isActive && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-white/40 rounded-r-full" />
              )}
              <div className={`${isActive ? 'text-white' : 'text-[var(--text-secondary)] group-hover:text-indigo-400'} transition-colors shrink-0`}>
                {item.icon}
              </div>
              <span className="font-semibold text-sm tracking-tight">{item.name}</span>
            </Link>
          );
        })}
      </nav>
      
      {/* Secondary Section */}
      {user?.role !== 'admin' && (
        <>
          <div className="px-5 mt-4 mb-2">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--text-secondary)] opacity-40">Communication</p>
          </div>
          <nav className="px-3 pb-4">
            <Link
              to="/feedback"
              onClick={() => setIsMobileMenuOpen(false)}
              className={`flex items-center space-x-3 px-4 py-2.5 rounded-xl transition-all duration-200 group relative ${
                location.pathname === '/feedback'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/25'
                  : 'text-[var(--text-secondary)] hover:bg-[var(--border-subtle)] hover:text-[var(--text-primary)]'
              }`}
            >
              <div className={`${location.pathname === '/feedback' ? 'text-white' : 'text-[var(--text-secondary)] group-hover:text-indigo-400'} transition-colors shrink-0`}>
                 <MessageSquare className="w-4.5 h-4.5" />
              </div>
              <span className="font-semibold text-sm tracking-tight">Feedback</span>
            </Link>
          </nav>
        </>
      )}

      {/* Bottom panel */}
      <div className="px-3 pb-5 space-y-3">

        {/* Theme toggle — shows CURRENT mode, clicking switches */}
        <button
          onClick={toggleTheme}
          className="w-full flex items-center justify-between px-4 py-3 rounded-xl border border-[var(--border-subtle)] hover:border-indigo-500/40 bg-[var(--border-subtle)] hover:bg-indigo-500/5 transition-all duration-200 group"
        >
          <div className="flex items-center space-x-3">
            {isDark
              ? <Moon className="w-4 h-4 text-indigo-400" />
              : <Sun className="w-4 h-4 text-amber-500" />
            }
            <span className="text-xs font-semibold text-[var(--text-secondary)] group-hover:text-[var(--text-primary)] transition-colors">
              {isDark ? 'Dark Mode' : 'Light Mode'}
            </span>
          </div>

          {/* Toggle pill — ON (indigo) = dark active, OFF (gray) = light active */}
          <div className={`w-9 h-5 rounded-full relative transition-colors duration-300 ${isDark ? 'bg-indigo-600' : 'bg-[var(--text-secondary)]/30'}`}>
            <div
              className={`absolute top-[3px] w-3.5 h-3.5 rounded-full bg-white shadow-sm transition-all duration-300 ${isDark ? 'left-[18px]' : 'left-[3px]'}`}
            />
          </div>
        </button>

        {/* User info */}
        <div className="flex items-center space-x-3 px-4 py-3 rounded-xl bg-[var(--border-subtle)]">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500/30 to-purple-500/30 border border-indigo-500/20 flex items-center justify-center font-black text-indigo-400 text-sm shrink-0">
            {user?.name?.charAt(0).toUpperCase()}
          </div>
          <div className="overflow-hidden flex-1 min-w-0">
            <p className="text-sm font-bold text-[var(--text-primary)] truncate leading-tight">{user?.name}</p>
            <p className="text-[10px] text-[var(--text-secondary)] uppercase font-semibold tracking-widest opacity-70">{user?.role}</p>
          </div>
        </div>

        {/* Sign Out */}
        <button
          onClick={logout}
          className="w-full flex items-center justify-center space-x-2 bg-transparent hover:bg-red-500/8 text-[var(--text-secondary)] hover:text-red-500 py-2.5 rounded-xl transition-all duration-200 font-semibold text-xs border border-[var(--border-subtle)] hover:border-red-500/25 group active:scale-95"
        >
          <LogOut className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
          <span>Sign Out</span>
        </button>

      </div>
    </>
  );

  return (
    <div className="flex h-screen bg-[var(--bg-main)] text-[var(--text-primary)] overflow-hidden font-sans">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex w-64 bg-[var(--bg-sidebar)] border-r border-[var(--border-subtle)] flex-col backdrop-blur-xl">
        <SidebarContent />
      </aside>

      {/* Mobile Sidebar Overlay */}
      {isMobileMenuOpen && (
        <div
          className="lg:hidden fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Mobile Drawer */}
      <aside className={`lg:hidden fixed inset-y-0 left-0 z-50 w-64 bg-[var(--bg-sidebar)] border-r border-[var(--border-subtle)] flex flex-col transition-transform duration-300 ease-in-out transform ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="absolute right-3 top-5">
          <button onClick={() => setIsMobileMenuOpen(false)} className="p-1.5 text-[var(--text-secondary)] hover:text-[var(--text-primary)] bg-[var(--border-subtle)] rounded-lg border border-[var(--border-subtle)] transition-all">
            <X className="w-4 h-4" />
          </button>
        </div>
        <SidebarContent />
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        {/* Mobile Top Bar */}
        <header className="lg:hidden flex items-center justify-between px-4 py-3 border-b border-[var(--border-subtle)] bg-[var(--bg-sidebar)] backdrop-blur-md z-40">
          <div className="flex items-center space-x-2.5">
            <div className="w-7 h-7 bg-indigo-600 rounded-lg flex items-center justify-center">
              <Award className="w-4 h-4 text-white" />
            </div>
            <span className="font-black text-base tracking-tight text-[var(--text-primary)]">DigiCertify</span>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={toggleTheme}
              className="p-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] bg-[var(--border-subtle)] rounded-lg active:scale-90 transition-all border border-[var(--border-subtle)]"
            >
              {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
            <button
              onClick={() => setIsMobileMenuOpen(true)}
              className="p-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] bg-[var(--border-subtle)] rounded-lg active:scale-90 transition-all border border-[var(--border-subtle)]"
            >
              <Menu className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto scroll-smooth">
          <div className="min-h-full flex flex-col">
            <div className="flex-1 animate-fade-in-up">
              {children}
            </div>
            <Footer />
          </div>
        </div>
      </main>
    </div>
  );
}
