import { useState, useEffect, useContext } from 'react';
import axios from 'axios';
import { AuthContext } from '../context/AuthContext';
import { Users, FileText, CheckCircle, XCircle, Download, Calendar, Mail, Search, Award, BarChart2, ChevronDown, ChevronUp, ShieldCheck, TrendingUp, Zap, MessageSquare, Trash2, PauseCircle, RefreshCw, Clock, CheckCircle2, AlertTriangle, Heart, Lightbulb } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { Chart as ChartJS, ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, Title } from 'chart.js';
import { Doughnut } from 'react-chartjs-2';
import { API_BASE } from '../apiConfig';

ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, Title);

export default function AdminDashboard() {
  const { user } = useContext(AuthContext);
  const [searchParams] = useSearchParams();
  const [stats, setStats] = useState({ users: 0, certificates: 0, sent: 0, failed: 0 });
  const [logs, setLogs] = useState([]);
  const [users, setUsers] = useState([]);
  const [certificates, setCertificates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'overview');
  const [batchSearch, setBatchSearch] = useState('');
  const [logSearch, setLogSearch] = useState('');
  const [sortBy, setSortBy] = useState('newest');
  const [statusFilter, setStatusFilter] = useState('all');
  const [expandedBatch, setExpandedBatch] = useState(null);
  const [automations, setAutomations] = useState([]);
  const [feedbacks, setFeedbacks] = useState([]);

  const fetchData = async () => {
    const token = sessionStorage.getItem('token');
    const headers = { Authorization: `Bearer ${token}` };
    try {
      const [usersRes, certsRes, logsRes, autosRes, fbRes] = await Promise.all([
        axios.get(`${API_BASE}/api/admin/users`, { headers }),
        axios.get(`${API_BASE}/api/admin/certificates`, { headers }),
        axios.get(`${API_BASE}/api/admin/emaillogs`, { headers }),
        axios.get(`${API_BASE}/api/certificate/form-automations`, { headers }),
        axios.get(`${API_BASE}/api/user-feedback/admin`, { headers })
      ]);
      setStats({ users: usersRes.data.length, certificates: certsRes.data.length, sent: logsRes.data.filter(l => l.status === 'Sent').length, failed: logsRes.data.filter(l => l.status === 'Failed').length });
      setLogs(logsRes.data); setUsers(usersRes.data); setCertificates(certsRes.data); setAutomations(autosRes.data || []);
      setFeedbacks(fbRes.data || []);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, []);

  const handleBulkDownload = () => { const token = sessionStorage.getItem('token'); window.open(`${API_BASE}/api/certificate/download-bulk?token=${token}`, '_blank'); };

  const handleSendBatchEmails = async (batchCerts) => {
    const ids = batchCerts.filter(c => c.status !== 'Sent').map(c => c.certificateId);
    if (!ids.length) { alert('All sent.'); return; }
    const token = sessionStorage.getItem('token');
    try { await axios.post(`${API_BASE}/api/certificate/send-bulk`, { certificateIds: ids, subject: 'Your Certificate', message: 'Congratulations! Your certificate is attached.' }, { headers: { Authorization: `Bearer ${token}` } }); alert(`Sent ${ids.length} emails.`); window.location.reload(); } catch { alert('Failed'); }
  };

  const handleDeleteUser = async (uid) => {
    if (uid === user._id) { alert("Cannot delete your own account."); return; }
    if (!window.confirm("Permanently delete this user?")) return;
    const token = sessionStorage.getItem('token');
    try { await axios.delete(`${API_BASE}/api/admin/users/${uid}`, { headers: { Authorization: `Bearer ${token}` } }); await fetchData(); alert("User deleted."); } catch (e) { alert(e.response?.data?.message || "Failed"); }
  };

  const handleDeleteFeedback = async (fid) => {
    if (!window.confirm("Delete this feedback?")) return;
    const token = sessionStorage.getItem('token');
    try { 
      await axios.delete(`${API_BASE}/api/user-feedback/admin/${fid}`, { headers: { Authorization: `Bearer ${token}` } }); 
      fetchData(); 
    } catch { alert("Failed to delete."); }
  };

  const handleToggleAuto = async (id, currentActive) => {
    const token = sessionStorage.getItem('token');
    try {
      await axios.patch(`${API_BASE}/api/certificate/form-automation/${id}`,
        { active: !currentActive },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      fetchData();
    } catch { }
  };

  const handleDeleteAuto = async (id) => {
    if (!window.confirm('Delete this automation? Certificates already generated will remain.')) return;
    const token = sessionStorage.getItem('token');
    try {
      await axios.delete(`${API_BASE}/api/certificate/form-automation/${id}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      fetchData();
    } catch { }
  };


  const groupedBatches = certificates.reduce((acc, cert) => {
    let bid = cert.batchId || (cert.createdAt ? `Generated ${new Date(cert.createdAt).toLocaleDateString()}` : 'Individual');
    if (bid.toLowerCase().includes(batchSearch.toLowerCase())) { if (!acc[bid]) acc[bid] = []; acc[bid].push(cert); }
    return acc;
  }, {});

  // Merge in automations that have 0 certs yet
  automations.forEach(auto => {
    if (auto.batchId && !groupedBatches[auto.batchId]) {
      groupedBatches[auto.batchId] = [{ 
         _id: `auto-${auto._id}`, 
         batchId: auto.batchId, 
         isAutomation: true, 
         status: 'Pending',
         createdAt: auto.createdAt,
         name: 'Waiting for responses...',
         certificateId: 'AUTO-PENDING',
         createdBy: { name: auto.userId?.name || 'Automation' } 
      }];
    }
  });

  const fmt = (d) => d ? new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(d)) : '—';

  const efficiency = stats.sent + stats.failed > 0 ? Math.round((stats.sent / (stats.sent + stats.failed)) * 100) : 0;

  const doughnutData = {
    labels: ['Sent', 'Failed'],
    datasets: [{ data: [stats.sent, stats.failed], backgroundColor: ['rgba(16,185,129,0.7)', 'rgba(239,68,68,0.7)'], borderColor: ['rgba(16,185,129,1)', 'rgba(239,68,68,1)'], borderWidth: 2 }]
  };

  const STAT_CARDS = [
    { label: 'Total Users', value: stats.users, icon: <Users className="w-5 h-5" />, color: 'indigo' },
    { label: 'Certificates', value: stats.certificates, icon: <Award className="w-5 h-5" />, color: 'violet' },
    { label: 'Emails Sent', value: stats.sent, icon: <CheckCircle className="w-5 h-5" />, color: 'emerald' },
    { label: 'Failed', value: stats.failed, icon: <XCircle className="w-5 h-5" />, color: 'red' },
  ];

  const colorMap = {
    indigo: 'bg-indigo-500/10 text-indigo-500 border-indigo-500/20',
    violet: 'bg-violet-500/10 text-violet-500 border-violet-500/20',
    emerald: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
    red: 'bg-red-500/10 text-red-500 border-red-500/20',
  };

  const getBadgeStyles = (type) => {
    switch (type?.toLowerCase()) {
      case 'bug report':
        return 'text-amber-500 bg-amber-500/10 border-amber-500/20';
      case 'bug':
        return 'text-amber-500 bg-amber-500/10 border-amber-500/20';
      case 'appreciation':
        return 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20';
      case 'thanks':
        return 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20';
      default:
        return 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20';
    }
  };

  const parseLegacyMessage = (fb) => {
    let msg = fb.message || '';
    let type = fb.type || 'Suggestion';

    if (msg.startsWith('[') && msg.includes(']')) {
      const extractedType = msg.substring(1, msg.indexOf(']'));
      type = extractedType;
      msg = msg.substring(msg.indexOf(']') + 1).trim();
    }
    return { msg, type };
  };


  const TABS = [
    { id: 'overview', label: 'Overview', icon: <BarChart2 className="w-4 h-4" /> },
    { id: 'users', label: 'Users', icon: <Users className="w-4 h-4" /> },
    { id: 'certificates', label: 'Batches', icon: <FileText className="w-4 h-4" /> },
    { id: 'logs', label: 'Email Logs', icon: <Mail className="w-4 h-4" /> },
  ];

  return (
    <div className="p-6 md:p-10 max-w-7xl mx-auto space-y-8">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold text-indigo-500 uppercase tracking-widest mb-1">Admin Panel</p>
          <h1 className="text-3xl font-black text-[var(--text-primary)] tracking-tight">Control Center</h1>
          <p className="text-sm text-[var(--text-secondary)] mt-1">Monitor users, certificates, and email delivery.</p>
        </div>
        <button onClick={handleBulkDownload} className="shrink-0 flex items-center gap-2 px-5 py-2.5 rounded-xl border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] text-sm font-semibold transition-all active:scale-95">
          <Download className="w-4 h-4" /><span>Export All (ZIP)</span>
        </button>
      </div>

      {/* ── Stat Cards ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {STAT_CARDS.map((s, i) => (
          <div key={i} className="glass rounded-2xl p-5 flex items-center gap-4">
            <div className={`p-3 rounded-xl border ${colorMap[s.color]}`}>{s.icon}</div>
            <div>
              <p className="text-xs text-[var(--text-secondary)] font-medium">{s.label}</p>
              <p className="text-2xl font-black text-[var(--text-primary)] tracking-tight">{loading ? '—' : s.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Tab Bar ────────────────────────────────────────────────────────── */}
      <div className="flex gap-1 border-b border-[var(--border-subtle)]">
        {TABS.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-5 py-3 text-sm font-semibold border-b-2 transition-all ${activeTab === tab.id ? 'border-indigo-500 text-indigo-500' : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}>
            {tab.icon}{tab.label}
          </button>
        ))}
      </div>

      {/* ── Tab Content ────────────────────────────────────────────────────── */}
      {loading ? (
        <div className="space-y-3">{[1, 2, 3].map(i => <div key={i} className="h-16 bg-[var(--border-subtle)] rounded-2xl animate-pulse" />)}</div>
      ) : activeTab === 'overview' ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
            {/* Column 1: Email Logs */}
            <div className="glass rounded-2xl border border-[var(--border-subtle)] overflow-hidden h-full flex flex-col">
              <div className="flex items-center justify-between px-6 py-5 border-b border-[var(--border-subtle)] bg-white/5">
                <div>
                  <h2 className="text-base font-black text-[var(--text-primary)] uppercase tracking-tight">Recent Activity</h2>
                  <p className="text-[10px] text-[var(--text-secondary)] font-bold uppercase tracking-widest opacity-50">Email Delivery Log</p>
                </div>
                <Mail className="w-5 h-5 text-indigo-400" />
              </div>
              <div className="divide-y divide-[var(--border-subtle)] max-h-[440px] overflow-y-auto">
                {logs.length === 0 ? (
                  <div className="p-20 text-center space-y-2 opacity-20">
                    <Mail className="w-10 h-10 mx-auto" />
                    <p className="text-xs font-bold uppercase tracking-widest">No logs available</p>
                  </div>
                ) : logs.slice(0, 20).map(log => (
                  <div key={log._id} className="flex items-center justify-between px-6 py-4 hover:bg-[var(--border-subtle)] transition-colors border-l-2 border-transparent hover:border-indigo-500/50">
                    <div className="flex items-center gap-4 min-w-0">
                      <div className={`w-2.5 h-2.5 rounded-full shrink-0 shadow-sm ${log.status === 'Sent' ? 'bg-emerald-500 shadow-emerald-500/40' : 'bg-red-500 shadow-red-500/40'}`} />
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-[var(--text-primary)] truncate tracking-tight">{log.recipient}</p>
                        <p className="text-[10px] text-[var(--text-secondary)] font-mono truncate opacity-60 tracking-wider uppercase">{log.certificateId}</p>
                      </div>
                    </div>
                    <span className={`shrink-0 ml-4 px-3 py-1 text-[10px] font-black uppercase tracking-widest rounded-lg border ${log.status === 'Sent' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 'bg-red-500/10 text-red-500 border-red-500/20'}`}>{log.status}</span>
                  </div>
                ))}
              </div>
              {logs.length > 0 && (
                <button onClick={() => setActiveTab('logs')} className="mt-auto px-6 py-4 text-center text-xs font-bold text-indigo-400 hover:text-indigo-300 border-t border-[var(--border-subtle)] hover:bg-white/5 transition-all uppercase tracking-[0.2em]">
                  View Detailed Logs
                </button>
              )}
            </div>

            {/* Column 2: User Feedback (Moved Next to Logs) */}
            <div className="glass rounded-2xl border border-[var(--border-subtle)] overflow-hidden h-full flex flex-col">
              <div className="flex items-center justify-between px-6 py-5 border-b border-[var(--border-subtle)] bg-white/5">
                <div>
                  <h2 className="text-base font-black text-[var(--text-primary)] uppercase tracking-tight">System Feedback</h2>
                  <p className="text-[10px] text-[var(--text-secondary)] font-bold uppercase tracking-widest opacity-50">User Insights & Reports</p>
                </div>
                <MessageSquare className="w-5 h-5 text-violet-400" />
              </div>
              <div className="p-4 grid grid-cols-1 gap-3 max-h-[440px] overflow-y-auto">
                {feedbacks.length === 0 ? (
                  <div className="p-20 text-center space-y-2 opacity-20 col-span-full">
                    <MessageSquare className="w-10 h-10 mx-auto" />
                    <p className="text-xs font-bold uppercase tracking-widest">No feedback yet</p>
                  </div>
                ) : feedbacks.slice(0, 8).map(fb => {
                  const { msg, type } = parseLegacyMessage(fb);
                  const isBug = type?.toLowerCase().includes('bug');
                  const isAppreciation = ['appreciation', 'thanks', 'heart'].includes(type?.toLowerCase());
                  
                  return (
                    <div key={fb._id} className={`p-4 rounded-xl border transition-all relative group hover:border-indigo-500/40 hover:shadow-lg hover:shadow-indigo-500/5 ${isBug ? 'bg-red-500/5 border-red-500/10' : isAppreciation ? 'bg-emerald-500/5 border-emerald-500/10' : 'bg-black/20 border-white/5'}`}>
                      <button 
                        onClick={() => handleDeleteFeedback(fb._id)}
                        className="absolute top-2 right-2 p-1.5 bg-red-500/10 text-red-500 rounded-lg opacity-0 group-hover:opacity-100 transition-all hover:bg-red-500 hover:text-white"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                      <div className="flex items-center gap-3 mb-2.5">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs ring-1 ring-inset ${isBug ? 'bg-red-500/10 text-red-500 ring-red-500/20' : isAppreciation ? 'bg-emerald-500/10 text-emerald-500 ring-emerald-500/20' : 'bg-indigo-500/10 text-indigo-500 ring-indigo-500/20'}`}>
                          {isBug ? <AlertTriangle className="w-4 h-4" /> : isAppreciation ? <Heart className="w-4 h-4" /> : <Lightbulb className="w-4 h-4" />}
                        </div>
                        <div className="min-w-0 pr-12">
                          <p className="text-xs font-black text-[var(--text-primary)] truncate uppercase tracking-tight leading-none mb-1">{fb.name}</p>
                          <span className={`px-2 py-0.5 rounded-md border text-[8px] font-black uppercase tracking-widest shadow-sm ${getBadgeStyles(type)}`}>
                            {type}
                          </span>
                        </div>
                      </div>
                      <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed italic opacity-80 pl-11">"{msg}"</p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Performance Row (Email Stats Table/Chart) */}
          <div className="glass rounded-2xl border border-[var(--border-subtle)] p-8 flex flex-col items-center justify-center relative overflow-hidden">
             <div className="absolute top-0 right-0 p-8 opacity-5">
                <TrendingUp className="w-40 h-40" />
             </div>
             <div className="flex flex-col sm:flex-row items-center gap-12 w-full relative z-10">
                <div className="flex-1 text-center sm:text-left">
                   <h2 className="text-xl font-black text-[var(--text-primary)] uppercase tracking-tight mb-2">Email Sending Report</h2>
                   <p className="text-sm text-[var(--text-secondary)] opacity-60 mb-6 font-medium">Track how many certificates were successfully emailed.</p>
                   <div className="grid grid-cols-2 gap-4">
                      <div className="p-4 rounded-2xl bg-emerald-500/5 border border-emerald-500/10">
                         <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-1">Success Rate</p>
                         <p className="text-2xl font-black text-emerald-500">{efficiency}%</p>
                      </div>
                      <div className="p-4 rounded-2xl bg-indigo-500/5 border border-indigo-500/10">
                         <p className="text-[10px] font-black text-indigo-600 uppercase tracking-widest mb-1">Total Sent</p>
                         <p className="text-2xl font-black text-indigo-500">{stats.sent}</p>
                      </div>
                   </div>
                </div>

                <div className="relative w-64 h-64 shrink-0">
                  {stats.sent === 0 && stats.failed === 0 ? (
                    <div className="flex flex-col items-center py-12">
                      <TrendingUp className="w-12 h-12 text-[var(--text-secondary)] opacity-20 mb-4" />
                      <p className="text-sm text-[var(--text-secondary)] font-bold uppercase tracking-widest">Waiting for data</p>
                    </div>
                  ) : (
                    <>
                      <Doughnut data={doughnutData} options={{ plugins: { legend: { display: false } }, cutout: '78%' }} />
                      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                        <p className="text-4xl font-black text-[var(--text-primary)] tracking-tighter">{efficiency}%</p>
                        <p className="text-[10px] text-[var(--text-secondary)] font-black uppercase tracking-[0.2em] opacity-50">Score</p>
                      </div>
                    </>
                  )}
                </div>
                
                <div className="flex flex-col gap-3 shrink-0">
                   <div className="flex items-center gap-3 px-4 py-2 rounded-xl bg-black/20 border border-white/5">
                      <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-lg shadow-emerald-500/40" />
                      <span className="text-xs font-black text-emerald-500 tracking-widest">{stats.sent} SUCCESS</span>
                   </div>
                   <div className="flex items-center gap-3 px-4 py-2 rounded-xl bg-black/20 border border-white/5">
                      <div className="w-2.5 h-2.5 rounded-full bg-red-500 shadow-lg shadow-red-500/40" />
                      <span className="text-xs font-black text-red-500 tracking-widest">{stats.failed} FAILED</span>
                   </div>
                </div>
             </div>
          </div>
        </div>
      ) : activeTab === 'users' ? (
        <div className="glass rounded-2xl border border-[var(--border-subtle)] overflow-hidden">
          <div className="px-6 py-4 border-b border-[var(--border-subtle)]">
            <h2 className="text-base font-bold text-[var(--text-primary)]">Registered Users</h2>
            <p className="text-xs text-[var(--text-secondary)]">{users.length} total accounts</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-[var(--border-subtle)] bg-[var(--border-subtle)]">
                  {['User', 'Role', 'Joined', 'Actions'].map((h, i) => (
                    <th key={h} className={`px-6 py-3 text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider ${i === 3 ? 'text-right' : ''}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-subtle)]">
                {users.map(u => (
                  <tr key={u._id} className="hover:bg-[var(--border-subtle)] transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-500 font-bold text-sm shrink-0 group-hover:bg-indigo-600 group-hover:text-white group-hover:border-indigo-600 transition-all">
                          {u.name?.charAt(0)?.toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-[var(--text-primary)]">{u.name}</p>
                          <p className="text-xs text-[var(--text-secondary)]">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 text-xs font-semibold rounded-full border ${u.role === 'admin' ? 'bg-amber-500/10 text-amber-600 border-amber-500/20' : 'bg-indigo-500/10 text-indigo-500 border-indigo-500/20'}`}>
                        {u.role}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-xs text-[var(--text-secondary)]">{fmt(u.createdAt)}</td>
                    <td className="px-6 py-4 text-right">
                      <button onClick={() => handleDeleteUser(u._id)} disabled={u.role === 'admin'}
                        className="p-2 rounded-lg text-[var(--text-secondary)] hover:text-red-500 hover:bg-red-500/10 disabled:opacity-0 transition-all active:scale-90">
                        <XCircle className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : activeTab === 'logs' ? (
        <div className="glass rounded-2xl border border-[var(--border-subtle)] overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-6 py-4 border-b border-[var(--border-subtle)]">
            <div>
              <h2 className="text-base font-bold text-[var(--text-primary)]">Email Logs</h2>
              <p className="text-xs text-[var(--text-secondary)]">{logs.length} total delivery records</p>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-secondary)]" />
              <input type="text" placeholder="Search by email or ID..." value={logSearch} onChange={e => setLogSearch(e.target.value)}
                className="pl-9 pr-4 py-2 text-sm rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] text-[var(--text-primary)] focus:outline-none focus:border-indigo-500 w-64" />
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-[var(--border-subtle)] bg-[var(--border-subtle)]">
                  {['Recipient', 'Certificate ID', 'Status', 'Sent At'].map((h, i) => (
                    <th key={h} className={`px-6 py-3 text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider ${i === 3 ? 'text-right' : ''}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-subtle)]">
                {logs.filter(l => l.recipient?.toLowerCase().includes(logSearch.toLowerCase()) || l.certificateId?.toLowerCase().includes(logSearch.toLowerCase())).map(log => (
                  <tr key={log._id} className="hover:bg-[var(--border-subtle)] transition-colors">
                    <td className="px-6 py-4">
                      <p className="text-sm font-semibold text-[var(--text-primary)]">{log.recipient}</p>
                      {log.error && <p className="text-xs text-red-500 mt-0.5">{log.error}</p>}
                    </td>
                    <td className="px-6 py-4"><span className="font-mono text-xs text-[var(--text-secondary)] bg-[var(--border-subtle)] px-2 py-1 rounded-lg">{log.certificateId}</span></td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-full border ${log.status === 'Sent' ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' : 'bg-red-500/10 text-red-500 border-red-500/20'}`}>
                        <div className={`w-1.5 h-1.5 rounded-full ${log.status === 'Sent' ? 'bg-emerald-500' : 'bg-red-500'}`} />{log.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right text-xs text-[var(--text-secondary)]">{fmt(log.sentAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Batches Tab */
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-secondary)]" />
              <input type="text" placeholder="Search batches..." value={batchSearch} onChange={e => setBatchSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-sm rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] text-[var(--text-primary)] focus:outline-none focus:border-indigo-500" />
            </div>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
              className="px-4 py-2 text-sm rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] text-[var(--text-secondary)] focus:outline-none cursor-pointer">
              <option value="all">All Status</option>
              <option value="sent">Fully Sent</option>
              <option value="pending">Has Pending</option>
            </select>
            <div className="flex items-center gap-1 bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-xl p-1">
              {['newest', 'oldest', 'az'].map(s => (
                <button key={s} onClick={() => setSortBy(s)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${sortBy === s ? 'bg-indigo-600 text-white' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}>
                  {s === 'az' ? 'A–Z' : s.charAt(0).toUpperCase() + s.slice(1)}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col lg:flex-row gap-8 items-start">
            <div className="flex-1 space-y-4 w-full">
              {Object.keys(groupedBatches).length === 0 ? (
                <div className="glass rounded-2xl p-16 text-center border border-[var(--border-subtle)]">
                  <FileText className="w-12 h-12 mx-auto mb-4 text-[var(--text-secondary)] opacity-20" />
                  <p className="text-sm text-[var(--text-secondary)]">No batches found.</p>
                </div>
              ) : (
                Object.keys(groupedBatches)
                  .filter(bid => bid.toLowerCase().includes(batchSearch.toLowerCase()))
                  .filter(bid => {
                    if (statusFilter === 'all') return true;
                    const cs = groupedBatches[bid];
                    const allSent = cs.every(c => c.status === 'Sent');
                    return statusFilter === 'sent' ? allSent : !allSent;
                  })
                  .sort((a, b) => {
                    if (sortBy === 'az') return a.localeCompare(b);
                    const dA = new Date(groupedBatches[a][0]?.createdAt || 0); const dB = new Date(groupedBatches[b][0]?.createdAt || 0);
                    return sortBy === 'newest' ? dB - dA : dA - dB;
                  })
                  .map(batchId => {
                    const certs = groupedBatches[batchId];
                    const sent = certs.filter(c => c.status === 'Sent').length;
                    const failed = certs.filter(c => c.status === 'Failed').length;
                    const pending = certs.length - sent - failed;
                    const isOpen = expandedBatch === batchId;
                    const creator = certs[0]?.createdBy?.name || 'Unknown';

                    return (
                      <div key={batchId} className={`glass rounded-2xl border overflow-hidden transition-all ${isOpen ? 'border-indigo-500/40' : 'border-[var(--border-subtle)]'}`}>
                        <div onClick={() => setExpandedBatch(isOpen ? null : batchId)}
                          className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-6 py-5 cursor-pointer hover:bg-[var(--border-subtle)] transition-colors">
                          <div className="flex items-center gap-4">
                            <div className={`p-2.5 rounded-xl shrink-0 ${isOpen ? 'bg-indigo-600 text-white' : 'bg-indigo-500/10 text-indigo-500'}`}><Calendar className="w-4 h-4" /></div>
                            <div>
                              <p className="font-semibold text-sm text-[var(--text-primary)] flex items-center gap-2">
                                 {batchId.replace('Batch ', '')}
                                 {certs.some(c => c.isAutomation) && (
                                   <span className="text-[9px] bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 px-2 py-0.5 rounded-full uppercase font-black tracking-widest shrink-0 flex items-center gap-1">
                                      <Zap className="w-2.5 h-2.5" /> Auto-Cert Generation
                                   </span>
                                 )}
                              </p>
                              <p className="text-xs text-[var(--text-secondary)]">By {creator} · {certs.length} certificate{certs.length !== 1 ? 's' : ''}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3 flex-wrap">
                            <div className="flex items-center gap-3 text-xs font-medium">
                              <span className="flex items-center gap-1.5 text-emerald-500"><CheckCircle className="w-3.5 h-3.5" />{sent} Sent</span>
                              {failed > 0 && <span className="flex items-center gap-1.5 text-red-500"><XCircle className="w-3.5 h-3.5" />{failed} Failed</span>}
                              {pending > 0 && <span className="text-[var(--text-secondary)]">{pending} Pending</span>}
                            </div>
                            <button onClick={e => { e.stopPropagation(); handleSendBatchEmails(certs); }}
                              disabled={pending === 0 && failed === 0}
                              className="flex items-center gap-2 px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-30 text-white text-xs font-semibold rounded-lg transition-all active:scale-95">
                              <Mail className="w-3.5 h-3.5" />{pending > 0 ? 'Send Emails' : failed > 0 ? 'Retry' : 'All Sent'}
                            </button>
                            {isOpen ? <ChevronUp className="w-4 h-4 text-indigo-500" /> : <ChevronDown className="w-4 h-4 text-[var(--text-secondary)]" />}
                          </div>
                        </div>

                        {isOpen && (
                          <div className="border-t border-[var(--border-subtle)] overflow-x-auto">
                            <table className="w-full text-left">
                              <thead><tr className="border-b border-[var(--border-subtle)] bg-[var(--border-subtle)]">
                                {['Recipient', 'Template', 'Actions'].map((h, i) => <th key={h} className={`px-6 py-3 text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider ${i === 2 ? 'text-right' : ''}`}>{h}</th>)}
                              </tr></thead>
                              <tbody className="divide-y divide-[var(--border-subtle)]">
                                {certs.map(cert => (
                                  <tr key={cert._id} className="hover:bg-[var(--border-subtle)] transition-colors group">
                                    <td className="px-6 py-4"><p className="text-sm font-semibold text-[var(--text-primary)]">{cert.name}</p><span className="font-mono text-xs text-[var(--text-secondary)]">{cert.certificateId}</span></td>
                                    <td className="px-6 py-4"><span className="text-xs font-medium text-[var(--text-secondary)] bg-[var(--border-subtle)] border border-[var(--border-subtle)] px-3 py-1 rounded-full">{cert.templateId?.name || 'Standard'}</span></td>
                                    <td className="px-6 py-4 text-right">
                                      <div className="flex justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                                        <a href={`${API_BASE}/api/certificate/download/${cert.certificateId}`} download className="p-2 rounded-lg border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-indigo-500 hover:border-indigo-500/40 transition-all"><Download className="w-4 h-4" /></a>
                                      </div>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    );
                  })
              )}
            </div>

            {/* Right Sidebar: Active Automations */}
            <div className="lg:w-96 w-full space-y-4 shrink-0">
               <div className="glass rounded-2xl border border-[var(--border-subtle)] p-6 space-y-6">
                  <div className="flex items-center justify-between">
                     <div>
                        <h3 className="text-sm font-black text-[var(--text-primary)] uppercase tracking-tight">Active Automations</h3>
                        <p className="text-[10px] text-[var(--text-secondary)] font-bold uppercase tracking-widest opacity-50">Monitoring Google Sheets</p>
                     </div>
                     <button onClick={fetchData} className="p-2 hover:bg-indigo-500/10 text-indigo-400 rounded-xl transition-all">
                        <RefreshCw className="w-3.5 h-3.5" />
                     </button>
                  </div>

                  {automations.length === 0 ? (
                     <div className="py-10 text-center space-y-2 opacity-30">
                        <Zap className="w-8 h-8 mx-auto" />
                        <p className="text-[10px] font-black uppercase tracking-widest">No active triggers</p>
                     </div>
                  ) : (
                     <div className="space-y-4">
                        {automations.map(auto => (
                           <div key={auto._id} className={`p-4 rounded-xl border transition-all ${auto.active ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-[var(--border-subtle)] bg-black/20'}`}>
                              <div className="flex items-start justify-between gap-4 mb-3">
                                 <div className={`p-2 rounded-lg ${auto.active ? 'bg-emerald-500/10 text-emerald-500' : 'bg-[var(--border-subtle)] text-[var(--text-secondary)]'}`}>
                                    <Zap className="w-4 h-4" />
                                 </div>
                                 <div className="flex-1 min-w-0">
                                    <p className="text-xs font-black text-[var(--text-primary)] truncate uppercase tracking-widest leading-none mb-1">{auto.batchId}</p>
                                    <div className="flex items-center gap-1 text-[9px] font-black uppercase tracking-tighter">
                                       <span className={auto.active ? 'text-emerald-500' : 'text-zinc-500'}>{auto.active ? 'Live' : 'Paused'}</span>
                                       <span className="text-zinc-500 opacity-30">|</span>
                                       <span className="text-[var(--text-secondary)]">{auto.certCount} Sent</span>
                                    </div>
                                 </div>
                                 <div className="flex items-center gap-1.5 shrink-0">
                                    <button onClick={() => handleToggleAuto(auto._id, auto.active)} 
                                       className={`p-1.5 rounded-lg border transition-all ${auto.active ? 'border-amber-500/30 text-amber-600 hover:bg-amber-500/10' : 'border-emerald-500/30 text-emerald-600 hover:bg-emerald-500/10'}`}>
                                       {auto.active ? <PauseCircle className="w-3 h-3" /> : <RefreshCw className="w-3 h-3" />}
                                    </button>
                                    <button onClick={() => handleDeleteAuto(auto._id)} className="p-1.5 rounded-lg border border-red-500/20 text-red-500 hover:bg-red-500/10 transition-all">
                                       <Trash2 className="w-3 h-3" />
                                    </button>
                                 </div>
                              </div>
                              <div className="flex items-center justify-between text-[8px] font-black uppercase tracking-widest opacity-40 border-t border-[var(--border-subtle)] pt-3">
                                 <div className="flex items-center gap-1"><Clock className="w-2.5 h-2.5" /> {new Date(auto.lastChecked).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                                 <div className="truncate max-w-[120px]">{auto.templateId?.name || 'Standard'}</div>
                              </div>
                           </div>
                        ))}
                     </div>
                  )}
               </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
