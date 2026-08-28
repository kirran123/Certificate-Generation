import { useState, useEffect, useRef, useContext } from 'react';
import axios from 'axios';
import { AuthContext } from '../context/AuthContext';
import { Users, FileText, CheckCircle, XCircle, Calendar, Mail, Search, Award, BarChart2, ChevronDown, ChevronUp, ShieldCheck, TrendingUp, Zap, MessageSquare, Trash2, PauseCircle, PlayCircle, RefreshCw, Clock, CheckCircle2, AlertTriangle, Heart, Lightbulb, PenTool, List, Download } from 'lucide-react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Chart as ChartJS, ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, Title } from 'chart.js';
import { Doughnut } from 'react-chartjs-2';
import { API_BASE, IO_API_BASE } from '../apiConfig';

ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, Title);

export default function AdminDashboard() {
  const { user } = useContext(AuthContext);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [stats, setStats] = useState({ users: 0, certificates: 0, sent: 0, failed: 0 });
  const [recentLogs, setRecentLogs] = useState([]);
  const [logs, setLogs] = useState([]);
  const [users, setUsers] = useState([]);
  const [certificates, setCertificates] = useState([]);
  const [loading, setLoading] = useState(true);
  const rawTab = searchParams.get('tab');
  const [activeTab, setActiveTab] = useState(rawTab === 'managed' ? 'certificates' : (rawTab || 'overview'));
  const [batchSearch, setBatchSearch] = useState('');
  const [certSearch, setCertSearch] = useState('');
  const [logSearch, setLogSearch] = useState('');
  const [sortBy, setSortBy] = useState('newest');
  const [statusFilter, setStatusFilter] = useState('all');
  const [localStatusFilter, setLocalStatusFilter] = useState('all');
  const [localSortOrder, setLocalSortOrder] = useState('asc');
  const [expandedBatch, setExpandedBatch] = useState(null);
  const [automations, setAutomations] = useState([]);
  const [feedbacks, setFeedbacks] = useState([]);
  const [brevoPool, setBrevoPool] = useState(null);
  const [loadingBrevo, setLoadingBrevo] = useState(false);
  const [brevoLastRefreshed, setBrevoLastRefreshed] = useState(null);
  const brevoAutoRefreshRef = useRef(null);

  const fetchBrevoStatus = async (headers, isManual = false) => {
    setLoadingBrevo(true);
    try {
      const res = await axios.get(`${API_BASE}/api/admin/brevo-status`, { headers });
      setBrevoPool(res.data);
      setBrevoLastRefreshed(new Date());
    } catch (e) {
      try {
        const res = await axios.get(`${IO_API_BASE}/api/admin/brevo-status`, { headers });
        setBrevoPool(res.data);
        setBrevoLastRefreshed(new Date());
      } catch (err) {
        console.error('Failed to fetch Brevo pool status:', err.message);
      }
    } finally {
      setLoadingBrevo(false);
      // If manual refresh, reset the 5-hour auto-refresh timer
      if (isManual) {
        if (brevoAutoRefreshRef.current) clearInterval(brevoAutoRefreshRef.current);
        brevoAutoRefreshRef.current = setInterval(() => {
          const token = sessionStorage.getItem('token');
          fetchBrevoStatus({ Authorization: `Bearer ${token}` });
        }, 5 * 60 * 60 * 1000); // 5 hours
      }
    }
  };

  const fetchOverviewStats = async (headers) => {
    try {
      const res = await axios.get(`${API_BASE}/api/admin/stats`, { headers });
      console.log('Overview Stats Response:', res.data);
      setStats({
        users: res.data.usersCount,
        certificates: res.data.certificatesCount,
        sent: res.data.sentCount,
        failed: res.data.failedCount
      });
      setRecentLogs(res.data.recentLogs || []);
      setFeedbacks(res.data.recentFeedbacks || []);
    } catch (e) { console.error('Failed to fetch admin stats:', e); }
  };

  const fetchUsers = async (headers) => {
    try {
      const res = await axios.get(`${API_BASE}/api/admin/users`, { headers });
      setUsers(res.data || []);
    } catch (e) { console.error('Failed to fetch users:', e); }
  };

  const fetchCertificates = async (headers) => {
    try {
      const certsRes = await axios.get(`${API_BASE}/api/admin/certificates`, { headers }).catch(e => {
        console.error('Failed certsRes:', e);
        return { data: [] };
      });
      const autosRes = await axios.get(`${API_BASE}/api/certificate/form-automations`, { headers }).catch(e => {
        console.error('Failed autosRes:', e);
        return { data: [] };
      });
      setCertificates(certsRes.data || []);
      setAutomations(autosRes.data || []);
    } catch (e) { console.error('Failed to fetch certificates:', e); }
  };

  const fetchEmailLogs = async (headers) => {
    try {
      const res = await axios.get(`${API_BASE}/api/admin/emaillogs`, { headers });
      setLogs(res.data || []);
    } catch (e) { console.error('Failed to fetch email logs:', e); }
  };

  const loadTab = async (tab, showLoading = false) => {
    if (showLoading) setLoading(true);
    const token = sessionStorage.getItem('token');
    const headers = { Authorization: `Bearer ${token}` };
    try {
      // Always fetch stats so top Stat Cards (Users, Certificates, Sent, Failed) remain accurate across all tabs
      await fetchOverviewStats(headers);
      fetchBrevoStatus(headers);

      if (tab === 'certificates') {
        await axios.delete(`${API_BASE}/api/certificate/form-automations/cleanup`, { headers }).catch(() => { });
        await fetchCertificates(headers);
      } else if (tab === 'users') {
        await fetchUsers(headers);
      } else if (tab === 'logs') {
        await fetchEmailLogs(headers);
      }
    } catch (e) {
      console.error(e);
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  const handleToggleAutomation = async (id, active) => {
    try {
      const token = sessionStorage.getItem('token');
      await axios.patch(`${API_BASE}/api/certificate/form-automation/${id}`, { active: !active }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      loadTab('certificates', false);
    } catch (err) {
      console.error('Failed to toggle automation:', err.message);
    }
  };

  const handleDeleteAutomation = async (id) => {
    if (!window.confirm('Are you sure you want to delete this automation/batch?')) return;
    try {
      const token = sessionStorage.getItem('token');
      await axios.delete(`${API_BASE}/api/certificate/form-automation/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      loadTab('certificates', false);
    } catch (err) {
      console.error('Failed to delete automation:', err.message);
    }
  };

  const handleResendBatch = async (batchId) => {
    try {
      const token = sessionStorage.getItem('token');
      await axios.post(`${IO_API_BASE}/api/certificate/resend-batch/${encodeURIComponent(batchId)}`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      loadTab('certificates', false);
    } catch (err) {
      alert('Failed to resend emails: ' + err.message);
    }
  };

  const handleDeleteBatch = async (batchId) => {
    if (!window.confirm(`Are you sure you want to delete ALL certificates in batch "${batchId}"? This cannot be undone.`)) return;
    try {
      const token = sessionStorage.getItem('token');
      await axios.post(`${API_BASE}/api/certificate/delete-batch-secure`, { batchId }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      loadTab('certificates', false);
    } catch (err) {
      alert('Failed to delete batch: ' + err.message);
    }
  };

  const [resendingCertId, setResendingCertId] = useState(null);

  const handleResendSingleCertificate = async (certId, email) => {
    setResendingCertId(certId);
    try {
      const token = sessionStorage.getItem('token');
      const res = await axios.post(`${IO_API_BASE}/api/certificate/resend-single/${encodeURIComponent(certId)}`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      alert(res.data?.message || `Successfully resent email to ${email}`);
      loadTab('certificates', false);
    } catch (err) {
      alert(err.response?.data?.message || err.message);
    } finally {
      setResendingCertId(null);
    }
  };

  const handleDeleteCertificate = async (certId) => {
    if (!window.confirm(`Are you sure you want to delete certificate "${certId}"? This cannot be undone.`)) return;
    try {
      const token = sessionStorage.getItem('token');
      await axios.delete(`${API_BASE}/api/certificate/delete-certificate/${encodeURIComponent(certId)}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      loadTab('certificates', false);
    } catch (err) {
      alert('Failed to delete certificate: ' + (err.response?.data?.message || err.message));
    }
  };

  const handleDeleteUser = async (id, name) => {
    if (!window.confirm(`Are you sure you want to delete user "${name}"?`)) return;
    try {
      const token = sessionStorage.getItem('token');
      await axios.delete(`${API_BASE}/api/admin/users/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      loadTab('users', false);
    } catch (err) {
      alert('Failed to delete user: ' + (err.response?.data?.message || err.message));
    }
  };

  useEffect(() => {
    loadTab(activeTab, true);
    // Smart polling: poll every 30s only when tab is visible (pauses in background to prevent Convex limit hits)
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        loadTab(activeTab, false);
      }
    }, 30000);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        loadTab(activeTab, false);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [activeTab]);

  // 5-hour auto-refresh for Brevo pool status
  useEffect(() => {
    const token = sessionStorage.getItem('token');
    const headers = { Authorization: `Bearer ${token}` };
    // Initial fetch on mount
    fetchBrevoStatus(headers);
    // Set up 5-hour interval
    brevoAutoRefreshRef.current = setInterval(() => {
      const t = sessionStorage.getItem('token');
      fetchBrevoStatus({ Authorization: `Bearer ${t}` });
    }, 5 * 60 * 60 * 1000); // every 5 hours
    return () => {
      if (brevoAutoRefreshRef.current) clearInterval(brevoAutoRefreshRef.current);
    };
  }, []);






  const safeDateStr = (dateVal) => {
    if (!dateVal) return '';
    try {
      const d = new Date(dateVal);
      if (isNaN(d.getTime())) return '';
      return d.toLocaleDateString();
    } catch (e) {
      return '';
    }
  };

  const groupedBatches = certificates.reduce((acc, cert) => {
    const dStr = safeDateStr(cert.createdAt || cert._creationTime);
    let bid = cert.batchId || (dStr ? `Generated ${dStr}` : 'Individual');
    
    // Global Search: Check batch name OR certificate details
    const searchStr = (batchSearch || certSearch).toLowerCase();
    const batchMatches = bid.toLowerCase().includes(searchStr);
    const certMatches = !searchStr || 
                        cert.name?.toLowerCase().includes(searchStr) || 
                        cert.email?.toLowerCase().includes(searchStr) || 
                        cert.certificateId?.toLowerCase().includes(searchStr);

    if (batchMatches || certMatches) { 
      if (!acc[bid]) acc[bid] = []; 
      acc[bid].push(cert); 
    }
    return acc;
  }, {});

  const fmt = (d) => d ? new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(d)) : '—';

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
    <div className="p-4 sm:p-6 md:p-10 max-w-7xl mx-auto space-y-6 md:space-y-8 mobile-padding">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold text-indigo-500 uppercase tracking-widest mb-1">Admin Panel</p>
          <h1 className="text-2xl sm:text-3xl font-black text-[var(--text-primary)] tracking-tight mobile-title">Control Center</h1>
          <p className="text-xs sm:text-sm text-[var(--text-secondary)] mt-1">Monitor users, certificates, and email delivery.</p>
        </div>
      </div>

      {/* ── Stat Cards ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mobile-stats-grid">
        {STAT_CARDS.map((s, i) => (
          <div key={i} className="glass rounded-2xl p-3.5 sm:p-5 flex items-center gap-3 sm:gap-4 mobile-stats-card">
            <div className={`p-2.5 sm:p-3 rounded-xl border shrink-0 ${colorMap[s.color]}`}>{s.icon}</div>
            <div className="min-w-0">
              <p className="text-[11px] sm:text-xs text-[var(--text-secondary)] font-medium truncate">{s.label}</p>
              <p className="text-xl sm:text-2xl font-black text-[var(--text-primary)] tracking-tight">{loading ? '—' : s.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Tab Bar ────────────────────────────────────────────────────────── */}
      <div className="flex gap-1 border-b border-[var(--border-subtle)] overflow-x-auto no-scrollbar pb-1 mobile-tab-scroll">
        {TABS.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 sm:px-5 py-2.5 sm:py-3 text-xs sm:text-sm font-semibold border-b-2 transition-all whitespace-nowrap shrink-0 mobile-tab-item ${activeTab === tab.id ? 'border-indigo-500 text-indigo-500' : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}>
            {tab.icon}{tab.label}
          </button>
        ))}
      </div>

      {/* ── Tab Content ────────────────────────────────────────────────────── */}
      {loading ? (
        <div className="space-y-3">{[1, 2, 3].map(i => <div key={i} className="h-16 bg-[var(--border-subtle)] rounded-2xl animate-pulse" />)}</div>
      ) : activeTab === 'overview' ? (
        <div className="space-y-6">
          {/* ── Brevo Email Pool Status Widget ────────────────────────────────────── */}
          <div className="glass rounded-2xl p-5 border border-[var(--border-subtle)] space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[var(--border-subtle)] pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-500 border border-amber-500/20">
                  <Zap className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-[var(--text-primary)] tracking-tight">Brevo Email Pool Status</h3>
                  <p className="text-xs text-[var(--text-secondary)] font-medium">Real-time daily sending credits & key failover status</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {brevoPool && (
                  <span className="text-xs font-bold px-3 py-1.5 rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                    Pool Total: {brevoPool.totalRemaining} / {brevoPool.totalCapacity} Available Today
                  </span>
                )}
                {brevoLastRefreshed && (
                  <span className="text-[10px] text-[var(--text-secondary)] opacity-50 font-medium hidden sm:inline">
                    <Clock className="w-3 h-3 inline mr-1 opacity-60" />
                    {Math.round((Date.now() - brevoLastRefreshed.getTime()) / 60000) < 1
                      ? 'Just now'
                      : `${Math.round((Date.now() - brevoLastRefreshed.getTime()) / 60000)}m ago`}
                  </span>
                )}
                <button
                  onClick={() => fetchBrevoStatus({ Authorization: `Bearer ${sessionStorage.getItem('token')}` }, true)}
                  disabled={loadingBrevo}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl border border-[var(--border-subtle)] hover:bg-[var(--border-subtle)] text-[var(--text-secondary)] transition-all disabled:opacity-50"
                  title="Refresh Brevo API usage (auto-refreshes every 5 hours)"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingBrevo ? 'animate-spin' : ''}`} />
                  Refresh Pool
                </button>
              </div>
            </div>

            {loadingBrevo && !brevoPool ? (
              <div className="h-16 bg-[var(--border-subtle)] rounded-xl animate-pulse" />
            ) : brevoPool && brevoPool.keys ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                {brevoPool.keys.map((k) => {
                  const usedPercent = Math.min(100, Math.round(((k.dailyQuota - k.creditsRemaining) / k.dailyQuota) * 100));
                  return (
                    <div key={k.index} className={`p-3.5 rounded-xl border transition-all ${k.status === 'active' ? 'bg-indigo-500/5 border-indigo-500/30' : k.status === 'exceeded' ? 'bg-red-500/5 border-red-500/30' : 'bg-[var(--border-subtle)]/40 border-[var(--border-subtle)]'}`}>
                      <div className="flex items-center justify-between gap-1 mb-2">
                        <span className="text-xs font-bold text-[var(--text-primary)] truncate" title={k.email}>
                          Key #{k.index}
                        </span>
                        <span className={`px-2 py-0.5 text-[10px] font-black rounded-full uppercase tracking-wider ${k.status === 'active' ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' : k.status === 'exceeded' ? 'bg-red-500/10 text-red-500 border border-red-500/20' : 'bg-slate-500/10 text-slate-400 border border-slate-500/20'}`}>
                          {k.status}
                        </span>
                      </div>
                      
                      <p className="text-[11px] font-mono text-[var(--text-secondary)] truncate mb-2" title={k.email}>
                        {k.email}
                      </p>

                      <div className="space-y-1">
                        <div className="flex justify-between text-[11px] font-medium">
                          <span className="text-[var(--text-secondary)]">Remaining</span>
                          <span className="font-bold text-[var(--text-primary)]">{k.creditsRemaining} / {k.dailyQuota}</span>
                        </div>
                        <div className="w-full h-1.5 bg-[var(--border-subtle)] rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${k.status === 'exceeded' ? 'bg-red-500' : k.status === 'active' ? 'bg-emerald-500' : 'bg-indigo-500'}`}
                            style={{ width: `${Math.max(5, 100 - usedPercent)}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-[var(--text-secondary)] opacity-60">Brevo key usage status unavailable.</p>
            )}
          </div>

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
                {recentLogs.length === 0 ? (
                  <div className="p-20 text-center space-y-2 opacity-20">
                    <Mail className="w-10 h-10 mx-auto" />
                    <p className="text-xs font-bold uppercase tracking-widest">No logs available</p>
                  </div>
                ) : recentLogs.slice(0, 20).map(log => (
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
              {recentLogs.length > 0 && (
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
                    <div key={fb._id || Math.random()} className="mb-2">
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
          <div className="glass rounded-2xl border border-[var(--border-subtle)] p-5 sm:p-8 flex flex-col items-center justify-center relative overflow-hidden">
            <div className="absolute top-0 right-0 p-8 opacity-5">
              <TrendingUp className="w-40 h-40" />
            </div>
            <div className="flex flex-col sm:flex-row items-center gap-6 sm:gap-12 w-full relative z-10">
              <div className="flex-1 text-center sm:text-left w-full">
                <h2 className="text-lg sm:text-xl font-black text-[var(--text-primary)] uppercase tracking-tight mb-2">Email Sending Report</h2>
                <p className="text-xs sm:text-sm text-[var(--text-secondary)] opacity-60 mb-4 sm:mb-6 font-medium">Track how many certificates were successfully emailed.</p>
                <div className="grid grid-cols-2 gap-3 sm:gap-4">
                  <div className="p-3 sm:p-4 rounded-2xl bg-emerald-500/5 border border-emerald-500/10">
                    <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-1">Success Rate</p>
                    <p className="text-xl sm:text-2xl font-black text-emerald-500">{efficiency}%</p>
                  </div>
                  <div className="p-3 sm:p-4 rounded-2xl bg-indigo-500/5 border border-indigo-500/10">
                    <p className="text-[10px] font-black text-indigo-600 uppercase tracking-widest mb-1">Total Sent</p>
                    <p className="text-xl sm:text-2xl font-black text-indigo-500">{stats.sent}</p>
                  </div>
                </div>
              </div>

              <div className="relative w-44 h-44 sm:w-64 sm:h-64 shrink-0">
                {stats.sent === 0 && stats.failed === 0 ? (
                  <div className="flex flex-col items-center py-12">
                    <TrendingUp className="w-12 h-12 text-[var(--text-secondary)] opacity-20 mb-4" />
                    <p className="text-sm text-[var(--text-secondary)] font-bold uppercase tracking-widest">Waiting for data</p>
                  </div>
                ) : (
                  <>
                    <Doughnut data={doughnutData} options={{ plugins: { legend: { display: false } }, cutout: '78%' }} />
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                      <p className="text-3xl sm:text-4xl font-black text-[var(--text-primary)] tracking-tighter">{efficiency}%</p>
                      <p className="text-[10px] text-[var(--text-secondary)] font-black uppercase tracking-[0.2em] opacity-50">Score</p>
                    </div>
                  </>
                )}
              </div>

              <div className="flex flex-row sm:flex-col gap-3 shrink-0 w-full sm:w-auto">
                <div className="flex items-center gap-3 px-4 py-2 rounded-xl bg-black/20 border border-white/5 flex-1 sm:flex-none">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-lg shadow-emerald-500/40 shrink-0" />
                  <span className="text-xs font-black text-emerald-500 tracking-widest">{stats.sent} SUCCESS</span>
                </div>
                <div className="flex items-center gap-3 px-4 py-2 rounded-xl bg-black/20 border border-white/5 flex-1 sm:flex-none">
                  <div className="w-2.5 h-2.5 rounded-full bg-red-500 shadow-lg shadow-red-500/40 shrink-0" />
                  <span className="text-xs font-black text-red-500 tracking-widest">{stats.failed} FAILED</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : activeTab === 'users' ? (
        <div className="glass rounded-2xl border border-[var(--border-subtle)] overflow-hidden">
          <div className="px-4 sm:px-6 py-4 border-b border-[var(--border-subtle)] flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-[var(--text-primary)]">Registered Users</h2>
              <p className="text-xs text-[var(--text-secondary)]">{users.length} total accounts</p>
            </div>
            <Users className="w-4 h-4 text-[var(--text-secondary)]" />
          </div>
          <div className="overflow-x-auto mobile-table-wrapper">
            <table className="w-full text-left min-w-[480px]">
              <thead>
                <tr className="border-b border-[var(--border-subtle)] bg-[var(--border-subtle)]">
                  {['User', 'Role', 'Joined', ''].map((h, i) => (
                    <th key={i} className={`px-6 py-3 text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider ${i === 3 ? 'text-right' : ''}`}>{h}</th>
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
                    <td className="px-6 py-4 text-xs text-[var(--text-secondary)]">{fmt(u.createdAt || u._creationTime)}</td>
                    <td className="px-6 py-4 text-right">
                      {u.role !== 'admin' && (
                        <button
                          onClick={() => handleDeleteUser(u._id, u.name)}
                          title="Remove user"
                          className="p-2 rounded-lg text-red-400 hover:bg-red-500/10 hover:text-red-500 transition-all opacity-0 group-hover:opacity-100"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : activeTab === 'logs' ? (
        <div className="glass rounded-2xl border border-[var(--border-subtle)] overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 sm:px-6 py-4 border-b border-[var(--border-subtle)]">
            <div>
              <h2 className="text-base font-bold text-[var(--text-primary)]">Email Logs</h2>
              <p className="text-xs text-[var(--text-secondary)]">{logs.length} total delivery records</p>
            </div>
            <div className="relative w-full sm:w-auto">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-secondary)]" />
              <input type="text" placeholder="Search by email or ID..." value={logSearch} onChange={e => setLogSearch(e.target.value)}
                className="pl-9 pr-4 py-2 text-sm rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] text-[var(--text-primary)] focus:outline-none focus:border-indigo-500 w-full sm:w-64" />
            </div>
          </div>
          <div className="overflow-x-auto mobile-table-wrapper">
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
          <div className="flex flex-col gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-secondary)]" />
              <input type="text" placeholder="Search batches..." value={batchSearch} onChange={e => setBatchSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-sm rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] text-[var(--text-primary)] focus:outline-none focus:border-indigo-500" />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
                className="flex-1 sm:flex-none px-4 py-2 text-sm rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] text-[var(--text-secondary)] focus:outline-none cursor-pointer">
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
                    const dA = new Date(groupedBatches[a][0]?.createdAt || groupedBatches[a][0]?._creationTime || 0); const dB = new Date(groupedBatches[b][0]?.createdAt || groupedBatches[b][0]?._creationTime || 0);
                    return sortBy === 'newest' ? dB - dA : dA - dB;
                  })
                  .map(batchId => {
                    const certs = groupedBatches[batchId];
                    const sent = certs.filter(c => c.status === 'Sent').length;
                    const failed = certs.filter(c => c.status === 'Failed').length;
                    const pending = certs.length - sent - failed;
                    const isOpen = expandedBatch === batchId;
                    const creator = certs[0]?.createdBy?.name || (typeof certs[0]?.createdBy === 'string' ? certs[0]?.createdBy : 'Unknown');

                    return (
                      <div key={batchId} className={`glass rounded-2xl border overflow-hidden transition-all ${isOpen ? 'border-indigo-500/40' : 'border-[var(--border-subtle)]'}`}>
                        <div className="flex items-center justify-between px-6 py-5 hover:bg-[var(--border-subtle)] transition-colors">
                          <div onClick={() => setExpandedBatch(isOpen ? null : batchId)} className="flex-1 flex items-center gap-4 cursor-pointer">
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
                              <p className="text-xs text-[var(--text-secondary)]">By {certs[0]?.createdBy?.name || (typeof certs[0]?.createdBy === 'string' ? certs[0]?.createdBy : 'Admin')} · {safeDateStr(certs[0]?.createdAt || certs[0]?._creationTime) || 'Never'} · {certs.length} certificate{certs.length !== 1 ? 's' : ''}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="flex items-center gap-2 mr-2">
                              <a
                                href={`${API_BASE}/api/certificate/download-bulk?batchId=${encodeURIComponent(batchId)}&token=${sessionStorage.getItem('token')}`}
                                download
                                title="Download Batch (ZIP)"
                                className="p-2 hover:bg-indigo-500/10 text-indigo-400 rounded-lg transition-all flex items-center justify-center"
                              >
                                <Download className="w-3.5 h-3.5" />
                              </a>
                              <button onClick={() => handleResendBatch(batchId)} title="Resend All Emails" className="p-2 hover:bg-indigo-500/10 text-indigo-400 rounded-lg transition-all"><RefreshCw className="w-3.5 h-3.5" /></button>
                            </div>
                            <button onClick={() => setExpandedBatch(isOpen ? null : batchId)} className="p-2 hover:bg-[var(--border-subtle)] rounded-lg transition-all">
                              {expandedBatch === batchId ? <ChevronUp className="w-4 h-4 text-indigo-500" /> : <ChevronDown className="w-4 h-4 text-[var(--text-secondary)]" />}
                            </button>
                          </div>
                        </div>

                        {isOpen && (
                          <div className="border-t border-[var(--border-subtle)]">
                            <div className="flex flex-col sm:flex-row items-center gap-3 px-6 py-4 border-b border-[var(--border-subtle)] bg-[var(--border-subtle)]" onClick={e => e.stopPropagation()}>
                              <div className="relative flex-1">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-secondary)]" />
                                <input type="text" placeholder="Search certificates..." value={certSearch} onChange={e => setCertSearch(e.target.value)}
                                  className="w-full pl-9 pr-4 py-2 text-sm rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] text-[var(--text-primary)] focus:outline-none focus:border-indigo-500" />
                              </div>
                              <div className="flex items-center gap-1 bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-xl p-1">
                                {['all', 'ready', 'sent', 'failed'].map(s => (
                                  <button key={s} onClick={e => { e.stopPropagation(); setLocalStatusFilter(s); }}
                                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${localStatusFilter === s ? 'bg-indigo-600 text-white' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}>
                                    {s === 'ready' ? 'Pending' : s === 'failed' ? 'Failed' : s.charAt(0).toUpperCase() + s.slice(1)}
                                  </button>
                                ))}
                              </div>
                              <button onClick={e => { e.stopPropagation(); setLocalSortOrder(o => o === 'asc' ? 'desc' : 'asc'); }}
                                className="px-3 py-2 text-xs font-medium text-[var(--text-secondary)] border border-[var(--border-subtle)] rounded-xl hover:text-[var(--text-primary)] transition-all">
                                <List className="w-4 h-4" />
                              </button>
                              <span className="text-xs text-[var(--text-secondary)] whitespace-nowrap">{certs.filter(c => {
                                const s = certSearch.toLowerCase();
                                return !s || c.name?.toLowerCase().includes(s) || c.email?.toLowerCase().includes(s) || c.certificateId?.toLowerCase().includes(s);
                              }).length}/{certs.length}</span>
                            </div>
                            <div className="overflow-x-auto">
                              <table className="w-full text-left">
                                <thead><tr className="border-b border-[var(--border-subtle)]">
                                  {['Recipient', 'Email', 'Template', 'Created', 'Status', ''].map((h, i) => <th key={h} className={`px-6 py-3 text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider ${i === 5 ? 'text-right' : ''}`}>{h}</th>)}
                                </tr></thead>
                                <tbody className="divide-y divide-[var(--border-subtle)]">
                                  {certs.filter(c => {
                                    const s = (certSearch || batchSearch).toLowerCase();
                                    const matchSearch = !s || c.name?.toLowerCase().includes(s) || c.email?.toLowerCase().includes(s) || c.certificateId?.toLowerCase().includes(s);
                                    let matchStatus = true;
                                    if (localStatusFilter === 'sent') matchStatus = c.status === 'Sent';
                                    else if (localStatusFilter === 'ready') matchStatus = c.status === 'Pending';
                                    else if (localStatusFilter === 'failed') matchStatus = c.status === 'Failed';
                                    return matchSearch && matchStatus;
                                  }).sort((a, b) => localSortOrder === 'asc' ? (a.name || '').localeCompare(b.name || '') : (b.name || '').localeCompare(a.name || '')).map(cert => (
                                    <tr key={cert._id} className="hover:bg-[var(--border-subtle)] transition-colors group">
                                      <td className="px-6 py-4 whitespace-nowrap align-middle">
                                        <p className="text-sm font-semibold text-[var(--text-primary)]">{cert.name}</p>
                                        <p className="font-mono text-[10px] text-[var(--text-secondary)] opacity-60 uppercase tracking-tighter">{cert.certificateId}</p>
                                      </td>
                                      <td className="px-6 py-4 align-middle">
                                        <p className="text-xs text-[var(--text-secondary)] font-medium" title={cert.email}>{cert.email || '—'}</p>
                                      </td>
                                      <td className="px-6 py-4 whitespace-nowrap align-middle">
                                        <span className="text-xs font-medium text-[var(--text-secondary)] bg-[var(--border-subtle)] border border-[var(--border-subtle)] px-3 py-1 rounded-full">
                                          {cert.templateId?.name || 'Standard'}
                                        </span>
                                      </td>
                                      <td className="px-6 py-4 text-xs text-[var(--text-secondary)] font-medium whitespace-nowrap align-middle">
                                        {fmt(cert.createdAt || cert._creationTime)}
                                      </td>
                                      <td className="px-6 py-4 align-middle">
                                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-full border ${cert.status === 'Sent' ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' : cert.status === 'Failed' ? 'bg-red-500/10 text-red-600 border-red-500/20' : 'bg-indigo-500/10 text-indigo-500 border-indigo-500/20'}`}>
                                          <div className={`w-1.5 h-1.5 rounded-full ${cert.status === 'Sent' ? 'bg-emerald-500' : cert.status === 'Failed' ? 'bg-red-500' : 'bg-indigo-500'}`} />
                                          {cert.status}
                                        </span>
                                      </td>
                                      <td className="px-6 py-4 text-right align-middle">
                                        <div className="flex items-center justify-end gap-2">
                                          <button
                                            onClick={() => handleResendSingleCertificate(cert.certificateId, cert.email)}
                                            disabled={resendingCertId === cert.certificateId}
                                            className="p-2 text-amber-400 hover:bg-amber-500/10 hover:text-amber-500 rounded-lg transition-all disabled:opacity-50"
                                            title="Resend email for this certificate"
                                          >
                                            <RefreshCw className={`w-3.5 h-3.5 ${resendingCertId === cert.certificateId ? "animate-spin" : ""}`} />
                                          </button>
                                          <a
                                            href={`${API_BASE}/api/certificate/download/${cert.certificateId}`}
                                            download
                                            className="p-2 text-indigo-400 hover:bg-indigo-500/10 hover:text-indigo-500 rounded-lg transition-all"
                                            title="Download PDF"
                                          >
                                            <Download className="w-3.5 h-3.5" />
                                          </a>
                                          <button onClick={() => handleDeleteCertificate(cert.certificateId)} className="p-2 text-red-400 hover:bg-red-500/10 hover:text-red-500 rounded-lg transition-all">
                                            <Trash2 className="w-3.5 h-3.5" />
                                          </button>
                                        </div>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
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
                  <button onClick={() => loadTab(activeTab)} className="p-2 hover:bg-indigo-500/10 text-indigo-400 rounded-xl transition-all">
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
                        </div>
                        <div className="flex items-center justify-between text-[8px] font-black uppercase tracking-widest opacity-40 border-t border-[var(--border-subtle)] pt-3">
                          <div className="flex items-center gap-1"><Clock className="w-2.5 h-2.5" /> {auto.lastChecked ? new Date(auto.lastChecked).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Never'}</div>
                          <div className="flex items-center gap-2">
                            <button onClick={() => handleToggleAutomation(auto._id, auto.active)} className="hover:text-indigo-400 transition-colors">
                              {auto.active ? <PauseCircle className="w-3 h-3" /> : <PlayCircle className="w-3 h-3" />}
                            </button>
                            <button onClick={() => handleDeleteAutomation(auto._id)} className="hover:text-red-400 transition-colors">
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
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
