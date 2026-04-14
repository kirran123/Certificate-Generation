import { useState, useContext } from 'react';
import axios from 'axios';
import { AuthContext } from '../context/AuthContext';
import { MessageSquare, Send, CheckCircle, Loader2, Heart, Zap, Sparkles } from 'lucide-react';
import { API_BASE } from '../apiConfig';

export default function Feedback() {
  const { user } = useContext(AuthContext);
  const [message, setMessage] = useState('');
  const [type, setType] = useState('Suggestion');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!message.trim()) return;
    setLoading(true);
    try {
      await axios.post(`${API_BASE}/api/user-feedback`, {
        name: user?.name || 'Anonymous User',
        email: user?.email || '',
        type,
        message: message.trim()
      });
      setSubmitted(true);
      setMessage('');
    } catch (error) {
      console.error('Feedback submission failed:', error);
      const errorMsg = error.response?.data?.message || error.message;
      alert(`Feedback Error: ${errorMsg}\n\nTroubleshooting:\n1. Restart your backend server.\n2. Verify MongoDB is connected.\n3. Exact URL attempted: ${API_BASE}/api/user-feedback`);
    } finally {
      setLoading(false);
    }
  };

  const types = [
    { id: 'Suggestion', icon: <Zap className="w-3.5 h-3.5" />, color: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20' },
    { id: 'Bug Report', icon: <Sparkles className="w-3.5 h-3.5" />, color: 'text-amber-400 bg-amber-500/10 border-amber-500/20' },
    { id: 'Appreciation', icon: <Heart className="w-3.5 h-3.5" />, color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
  ];

  return (
    <div className="p-6 md:p-10 max-w-4xl mx-auto min-h-[calc(100vh-160px)] flex flex-col justify-center">
      <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] bg-indigo-600/10 rounded-full blur-[120px] pointer-events-none" />
      
      <div className="text-center mb-12 animate-fade-in-up">
        <div className="inline-flex items-center justify-center p-3 bg-indigo-600/10 rounded-2xl mb-4 border border-indigo-500/20">
          <MessageSquare className="w-8 h-8 text-indigo-500" />
        </div>
        <h1 className="text-4xl font-black text-[var(--text-primary)] tracking-tight mb-2">Platform Feedback</h1>
        <p className="text-[var(--text-secondary)] font-medium max-w-md mx-auto">
          Help us shape the future of DigiCertify. Your thoughts and suggestions fuel our innovation.
        </p>
      </div>

      <div className="glass rounded-[3rem] p-8 md:p-12 border border-[var(--border-subtle)] shadow-2xl relative overflow-hidden animate-fade-in-up transition-all">
        {submitted ? (
          <div className="text-center py-10 space-y-6 animate-fade-in">
            <div className="w-20 h-20 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto border border-emerald-500/20">
               <CheckCircle className="w-10 h-10 text-emerald-500" />
            </div>
            <div>
               <h2 className="text-2xl font-black text-[var(--text-primary)] tracking-tight">Message Received!</h2>
               <p className="text-[var(--text-secondary)] mt-2">Our team will review your message shortly. Thank you for your support!</p>
            </div>
            <button 
              onClick={() => setSubmitted(false)}
              className="px-8 py-3 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold rounded-xl transition-all active:scale-95"
            >
              Send Another Feedback
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-8">
            <div className="space-y-4">
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--text-secondary)] ml-1 opacity-70 block">Feedback Type</label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {types.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setType(t.id)}
                    className={`flex items-center justify-center space-x-2 p-4 rounded-2xl border transition-all duration-300 ${
                      type === t.id 
                        ? 'border-indigo-500 bg-indigo-500/10 text-indigo-400 shadow-lg shadow-indigo-500/10 scale-[1.02]' 
                        : 'border-[var(--border-subtle)] bg-black/20 text-[var(--text-secondary)] opacity-60 hover:opacity-100 hover:border-indigo-500/30'
                    }`}
                  >
                    {t.icon}
                    <span className="text-[10px] font-black uppercase tracking-widest">{t.id}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--text-secondary)] ml-1 opacity-70 block">Your Message</label>
              <textarea
                required
                rows={5}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Share your thoughts, report a bug, or just say hi..."
                className="w-full bg-black/40 border border-[var(--border-subtle)] rounded-[2rem] p-6 text-[var(--text-primary)] text-sm focus:outline-none focus:border-indigo-500 transition-all resize-none placeholder:text-[var(--text-secondary)] placeholder:opacity-40"
              />
            </div>

            <button
              type="submit"
              disabled={loading || !message.trim()}
              className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-30 text-white py-5 rounded-3xl text-xs font-black uppercase tracking-[0.3em] transition-all shadow-2xl shadow-indigo-600/30 active:scale-95 flex items-center justify-center space-x-3 group"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <Send className="w-4 h-4 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                  <span>Push Feedback</span>
                </>
              )}
            </button>
          </form>
        )}
      </div>
      
      <div className="mt-8 text-center animate-fade-in opacity-50">
         <p className="text-[10px] text-[var(--text-secondary)] font-black uppercase tracking-[0.3em]">
            Identity Verified: <span className="text-indigo-500">{user?.name}</span>
         </p>
      </div>
    </div>
  );
}
