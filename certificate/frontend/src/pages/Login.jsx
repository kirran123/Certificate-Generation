import { useState, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Lock, Mail, User as UserIcon, Shield, Search, Award, ArrowRight, Sun, Moon } from 'lucide-react';
import Footer from '../components/Footer';
import { API_BASE } from '../apiConfig';
import { useTheme } from '../context/ThemeContext';

export default function Login() {
  const { login } = useContext(AuthContext);
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [isLogin, setIsLogin] = useState(true);
  const [isAdminView, setIsAdminView] = useState(false);
  const [formData, setFormData] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const isDark = theme === 'dark';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      if (isLogin) {
        if (isAdminView && formData.email !== 'kirranvijay@gmail.com') {
          setError('Authentication failed. Default Admin access only.');
          return;
        }
        await login(formData.email, formData.password);
        navigate('/');
      } else {
        const passwordRegex = /^(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+={}\[\]|\\:;"'<>,.?/-]).{6,}$/;
        if (!passwordRegex.test(formData.password)) {
          setError('Password must contain at least 6 characters, including a capital letter, a number, and a symbol.');
          return;
        }
        await axios.post(`${API_BASE}/api/auth/signup`, formData);
        setSuccess('Account created successfully! Please log in.');
        setIsLogin(true);
        setFormData({ ...formData, password: '' });
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Authentication failed');
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[var(--bg-main)] relative overflow-hidden font-sans">
      {/* Theme Toggle Floating */}
      <div className="absolute top-6 right-6 z-50">
        <button
          onClick={toggleTheme}
          className="p-3 bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-2xl shadow-xl hover:border-indigo-500/50 transition-all active:scale-95 group"
        >
          {isDark ? (
            <Sun className="w-5 h-5 text-amber-500 group-hover:rotate-45 transition-transform duration-500" />
          ) : (
            <Moon className="w-5 h-5 text-indigo-500 group-hover:-rotate-12 transition-transform duration-500" />
          )}
        </button>
      </div>

      {/* Animated Background Elements */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-600/20 rounded-full blur-[120px] animate-pulse pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-600/10 rounded-full blur-[120px] pointer-events-none" />
      
      <div className="flex-1 flex items-center justify-center p-4 relative z-10">
        <div className="w-full max-w-md animate-fade-in-up">
          {/* Quick Verify Link - Repositioned to Top */}
          <div className="flex justify-center mb-6">
            <button
              onClick={() => navigate('/verify-portal')}
              className="flex items-center space-x-2 px-6 py-2.5 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 hover:bg-indigo-500 hover:text-white transition-all rounded-full text-xs font-black uppercase tracking-widest group shadow-xl shadow-indigo-500/5"
            >
              <Search className="w-4 h-4 group-hover:scale-110 transition-transform" />
              <span>Verify a Certificate</span>
            </button>
          </div>

          {/* Logo Section */}
          <div className="text-center mb-10">
            <div className="inline-flex items-center justify-center p-3 bg-indigo-600 rounded-2xl shadow-xl shadow-indigo-500/20 mb-4">
              <Award className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-4xl font-black text-[var(--text-primary)] tracking-tighter">DigiCertify</h1>
            <p className="text-[var(--text-secondary)] text-sm font-medium mt-1 uppercase tracking-widest">Professional Certificates. Effortless Delivery.</p>
          </div>

          {/* Glass Card */}
          <div className="glass p-8 rounded-[2rem] shadow-2xl border border-white/10 relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
            
            <div className="flex bg-black/40 p-1.5 rounded-2xl mb-8 border border-white/5 relative z-10">
              <button
                onClick={() => { setIsAdminView(false); setIsLogin(true); setError(''); setSuccess(''); }}
                className={`flex-1 py-2.5 text-xs font-black uppercase tracking-widest rounded-xl transition-all duration-300 ${!isAdminView ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' : 'text-[var(--text-secondary)] opacity-50 hover:text-[var(--text-primary)] hover:bg-white/5'}`}
              >
                User Portal
              </button>
              <button
                onClick={() => { setIsAdminView(true); setIsLogin(true); setError(''); setSuccess(''); setFormData({ ...formData, email: '', password: '' }); }}
                className={`flex-1 flex justify-center items-center space-x-2 py-2.5 text-xs font-black uppercase tracking-widest rounded-xl transition-all duration-300 ${isAdminView ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' : 'text-[var(--text-secondary)] opacity-50 hover:text-[var(--text-primary)] hover:bg-white/5'}`}
              >
                <Shield className="w-3.5 h-3.5" />
                <span>Admin Access</span>
              </button>
            </div>

            <div className="mb-8 relative z-10">
              <h2 className="text-2xl font-black text-[var(--text-primary)] tracking-tight">
                {isAdminView ? 'Admin Authorization' : (isLogin ? 'Welcome Back' : 'Get Started')}
              </h2>
              <p className="text-[var(--text-secondary)] text-sm mt-1">
                {isAdminView ? 'Secure access for primary system controls' : (isLogin ? 'Sign in to manage and verify' : 'Join the elite certification network')}
              </p>
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl mb-6 text-xs font-bold flex items-center space-x-2 animate-shake relative z-10">
                <div className="w-1.5 h-1.5 rounded-full bg-red-500 pulse" />
                <span>{error}</span>
              </div>
            )}

            {success && (
              <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 p-4 rounded-xl mb-6 text-xs font-bold flex items-center space-x-2 relative z-10">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 pulse" />
                <span>{success}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4 relative z-10">
              {!isLogin && (
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-black tracking-widest text-[var(--text-secondary)] opacity-50 ml-1">Full Identity</label>
                  <div className="relative group/input">
                    <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--text-secondary)] opacity-50 group-focus-within/input:text-indigo-400 transition-colors" />
                    <input
                      type="text"
                      placeholder="e.g. Kirran S T"
                      className="w-full bg-black/40 border border-white/5 rounded-2xl py-3.5 pl-12 pr-4 text-[var(--text-primary)] focus:outline-none focus:border-indigo-500 focus:bg-black/60 transition-all placeholder:text-[var(--text-secondary)]"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                    />
                  </div>
                </div>
              )}
              
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-black tracking-widest text-[var(--text-secondary)] opacity-50 ml-1">Email Address</label>
                <div className="relative group/input">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--text-secondary)] opacity-50 group-focus-within/input:text-indigo-400 transition-colors" />
                  <input
                    type="email"
                    placeholder="mail@digicertify.com"
                    className="w-full bg-black/40 border border-white/5 rounded-2xl py-3.5 pl-12 pr-4 text-[var(--text-primary)] focus:outline-none focus:border-indigo-500 focus:bg-black/60 transition-all placeholder:text-[var(--text-secondary)]"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-black tracking-widest text-[var(--text-secondary)] opacity-50 ml-1">Secret Key</label>
                <div className="relative group/input">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--text-secondary)] opacity-50 group-focus-within/input:text-indigo-400 transition-colors" />
                  <input
                    type="password"
                    placeholder="••••••••"
                    className="w-full bg-black/40 border border-white/5 rounded-2xl py-3.5 pl-12 pr-4 text-[var(--text-primary)] focus:outline-none focus:border-indigo-500 focus:bg-black/60 transition-all placeholder:text-[var(--text-secondary)]"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-black uppercase tracking-widest text-xs py-4 rounded-2xl transition-all shadow-xl shadow-indigo-500/20 active:scale-[0.98] flex items-center justify-center space-x-2 group-hover:bg-indigo-500 shadow-indigo-900/10"
              >
                <span>{isLogin ? 'Authorize Entry' : 'Create Profile'}</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </button>
            </form>

            {!isAdminView && (
              <div className="mt-8 text-center relative z-20">
                <p className="text-[var(--text-secondary)] opacity-50 text-xs font-medium">
                  {isLogin ? "New to the system? " : "Already registered? "}
                  <button
                    onClick={() => setIsLogin(!isLogin)}
                    className="text-indigo-400 hover:text-white font-black uppercase tracking-widest text-xs transition-all ml-2 underline underline-offset-4 decoration-2 decoration-indigo-500/30 hover:decoration-indigo-400"
                  >
                    {isLogin ? 'Sign Up Now' : 'Authorize Login'}
                  </button>
                </p>
              </div>
            )}
          </div>
          

        </div>
      </div>
      
      <Footer />
    </div>
  );
}
