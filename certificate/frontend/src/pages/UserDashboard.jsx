import { useState, useEffect, useContext } from 'react';
import axios from 'axios';
import { AuthContext } from '../context/AuthContext';
import { Award, Search, FileUp, PenTool, Mail, CheckCircle, BarChart2, List, Calendar, ChevronDown, ChevronUp, Loader2, X, ArrowRight, Package, Inbox, Zap, RefreshCw, Clock, Trash2, PauseCircle } from 'lucide-react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { API_BASE } from '../apiConfig';

export default function UserDashboard() {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [receivedCerts, setReceivedCerts] = useState([]);
  const [generatedCerts, setGeneratedCerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') === 'managed' ? 'managed' : 'received');
  const [showMappingModal, setShowMappingModal] = useState(false);
  const [selectedBatchId, setSelectedBatchId] = useState('');
  const [excelData, setExcelData] = useState([]);
  const [excelHeaders, setExcelHeaders] = useState([]);
  const [mapping, setMapping] = useState({ targetId: '', email: '' });
  const [mappingLoading, setMappingLoading] = useState(false);
  const [googleSheetUrl, setGoogleSheetUrl] = useState('');
  const [batchSearch, setBatchSearch] = useState('');
  const [certSearch, setCertSearch] = useState('');
  const [expandedBatch, setExpandedBatch] = useState(null);
  const [expandedReceivedBatch, setExpandedReceivedBatch] = useState(null);
  const [localStatusFilter, setLocalStatusFilter] = useState('all');
  const [localSortOrder, setLocalSortOrder] = useState('asc');
  const [sortBy, setSortBy] = useState('newest');
  const [statusFilter, setStatusFilter] = useState('all');
  const [automations, setAutomations] = useState([]);

  const fetchData = async () => {
    const token = sessionStorage.getItem('token');
    const headers = { Authorization: `Bearer ${token}` };
    setLoading(true);
    try {
      const [receivedRes, generatedRes, autoRes] = await Promise.all([
        axios.get(`${API_BASE}/api/user/my-certificates`, { headers }),
        axios.get(`${API_BASE}/api/certificate/my-generations`, { headers }),
        axios.get(`${API_BASE}/api/certificate/form-automations`, { headers })
      ]);
      setReceivedCerts(receivedRes.data);
      setGeneratedCerts(generatedRes.data);
      setAutomations(autoRes.data || []);
    } catch {} finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSendBatchEmails = async (batchCerts) => {
    const ids = batchCerts.filter(c => c.status !== 'Sent').map(c => c.certificateId);
    if (!ids.length) { alert('All emails already sent.'); return; }
    const token = sessionStorage.getItem('token');
    try {
      await axios.post(`${API_BASE}/api/certificate/send-bulk`, { certificateIds: ids, subject: 'Your Certificate', message: 'Congratulations! Your certificate is attached.' }, { headers: { Authorization: `Bearer ${token}` } });
      alert(`Sent ${ids.length} emails.`); window.location.reload();
    } catch { alert('Failed to send emails'); }
  };

  const handleSendEmail = async (certId) => {
    const token = sessionStorage.getItem('token');
    try {
      await axios.post(`${API_BASE}/api/certificate/send-bulk`, { certificateIds: [certId], subject: 'Your Certificate', message: 'Congratulations! Your certificate is attached.' }, { headers: { Authorization: `Bearer ${token}` } });
      alert('Email sent.'); window.location.reload();
    } catch { alert('Failed to send email'); }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0]; if (!file) return;
    const formData = new FormData(); formData.append('file', file);
    const token = sessionStorage.getItem('token');
    try { setMappingLoading(true); const r = await axios.post(`${API_BASE}/api/certificate/upload-data`, formData, { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' } }); setExcelData(r.data.data); setExcelHeaders(r.data.headers); } catch { alert('Failed to parse file'); } finally { setMappingLoading(false); }
  };

  const handleSheetImportInModal = async () => {
    if (!googleSheetUrl) return; setMappingLoading(true);
    const token = sessionStorage.getItem('token');
    try { const r = await axios.post(`${API_BASE}/api/certificate/upload-sheet`, { sheetUrl: googleSheetUrl }, { headers: { Authorization: `Bearer ${token}` } }); setExcelData(r.data.data); setExcelHeaders(r.data.headers); } catch (e) { alert(e.response?.data?.message || 'Failed to import sheet.'); } finally { setMappingLoading(false); }
  };

  const confirmMapping = async () => {
    if (!mapping.targetId || !mapping.email) { alert('Select both columns'); return; }
    setMappingLoading(true);
    const token = sessionStorage.getItem('token');
    try {
      const batchCerts = generatedCerts.filter(c => c.batchId === selectedBatchId);
      const updates = excelData.map(row => { const cert = batchCerts.find(c => c.certificateId === String(row[mapping.targetId]) || c.name === String(row[mapping.targetId])); return cert ? { certificateId: cert.certificateId, email: String(row[mapping.email]) } : null; }).filter(Boolean);
      if (!updates.length) { alert('No matches found.'); return; }
      await axios.post(`${API_BASE}/api/certificate/update-batch-emails`, { updates }, { headers: { Authorization: `Bearer ${token}` } });
      alert(`Updated ${updates.length} certificates.`); window.location.reload();
    } catch { alert('Failed to update emails'); } finally { setMappingLoading(false); }
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

  const groupedBatches = generatedCerts.reduce((acc, cert) => {
    let bid = cert.batchId || (cert.createdAt ? `Generated ${new Date(cert.createdAt).toLocaleDateString()}` : 'Individual');
    if (bid.toLowerCase().includes(batchSearch.toLowerCase())) { if (!acc[bid]) acc[bid] = []; acc[bid].push(cert); }
    return acc;
  }, {});

  // Merge in automations that have 0 certs yet
  automations.forEach(auto => {
    if (auto.batchId && !groupedBatches[auto.batchId]) {
      if (auto.batchId.toLowerCase().includes(batchSearch.toLowerCase())) {
        groupedBatches[auto.batchId] = [{ 
           _id: `auto-${auto._id}`, 
           batchId: auto.batchId, 
           isAutomation: true, 
           status: 'Pending',
           createdAt: auto.createdAt,
           name: 'Waiting for responses...',
           certificateId: 'AUTO-PENDING'
        }];
      }
    }
  });

  const groupedReceived = receivedCerts.reduce((acc, cert) => {
    const bid = cert.batchId || 'Individual Certificates'; if (!acc[bid]) acc[bid] = []; acc[bid].push(cert); return acc;
  }, {});

  const fmt = (d) => d ? new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(d)) : '';

  const TABS = [
    { id: 'received', label: 'My Certificates', icon: <Inbox className="w-4 h-4" /> },
    { id: 'managed', label: 'Sent Batches', icon: <Package className="w-4 h-4" /> },
  ];

  const totalSent = generatedCerts.filter(c => c.status === 'Sent').length;

  // ── Stat cards ──────────────────────────────────────────────────────────────
  const stats = [
    { label: 'Certificates Received', value: receivedCerts.length, icon: <Award className="w-5 h-5" />, color: 'indigo' },
    { label: 'Batches Created', value: Object.keys(groupedBatches).length || generatedCerts.length > 0 ? Object.keys(groupedBatches).length : 0, icon: <Package className="w-5 h-5" />, color: 'violet' },
    { label: 'Emails Delivered', value: totalSent, icon: <Mail className="w-5 h-5" />, color: 'emerald' },
    { label: 'Pending', value: generatedCerts.filter(c => c.status !== 'Sent').length, icon: <Loader2 className="w-5 h-5" />, color: 'amber' },
  ];

  const colorMap = { indigo: 'bg-indigo-500/10 text-indigo-500 border-indigo-500/20', violet: 'bg-violet-500/10 text-violet-500 border-violet-500/20', emerald: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20', amber: 'bg-amber-500/10 text-amber-500 border-amber-500/20' };

  return (
    <div className="p-6 md:p-10 max-w-7xl mx-auto space-y-8">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold text-indigo-500 uppercase tracking-widest mb-1">Dashboard</p>
          <h1 className="text-3xl font-black text-[var(--text-primary)] tracking-tight">Welcome back, {user?.name?.split(' ')[0]} 👋</h1>
          <p className="text-sm text-[var(--text-secondary)] mt-1">Manage your certificates and track email delivery.</p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <button onClick={() => navigate('/upload')} className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-lg shadow-indigo-500/20 active:scale-95">
            <FileUp className="w-4 h-4" /><span>New Batch</span>
          </button>
          <button onClick={() => navigate('/designer')} className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-indigo-500/40 transition-all active:scale-95">
            <PenTool className="w-4 h-4" /><span>Editor</span>
          </button>
        </div>
      </div>

      {/* ── Stat Cards ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s, i) => (
          <div key={i} className="glass rounded-2xl p-5 flex items-center gap-4">
            <div className={`p-3 rounded-xl border ${colorMap[s.color]}`}>{s.icon}</div>
            <div>
              <p className="text-xs text-[var(--text-secondary)] font-medium">{s.label}</p>
              <p className="text-2xl font-black text-[var(--text-primary)] tracking-tight">{loading ? '—' : s.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Tabs ───────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[var(--border-subtle)] pb-0">
        <div className="flex gap-1">
          {TABS.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-5 py-3 text-sm font-semibold border-b-2 transition-all ${activeTab === tab.id ? 'border-indigo-500 text-indigo-500' : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}>
              {tab.icon}{tab.label}
            </button>
          ))}
        </div>

        {activeTab === 'managed' && (
          <div className="flex items-center gap-3 pb-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-secondary)]" />
              <input type="text" placeholder="Search batches..." value={batchSearch} onChange={e => setBatchSearch(e.target.value)}
                className="pl-9 pr-4 py-2 text-sm rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] text-[var(--text-primary)] focus:outline-none focus:border-indigo-500 w-52" />
            </div>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
              className="px-3 py-2 text-sm rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] text-[var(--text-secondary)] focus:outline-none cursor-pointer">
              <option value="all">All Status</option>
              <option value="sent">Sent</option>
              <option value="pending">Pending</option>
            </select>
            {generatedCerts.length > 0 && (
              <div className="flex items-center gap-2 px-4 py-2 rounded-xl border border-[var(--border-subtle)] text-[var(--text-secondary)] text-sm font-black uppercase tracking-widest opacity-30 select-none">
                 Ready
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Content ────────────────────────────────────────────────────────── */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <div key={i} className="h-20 bg-[var(--border-subtle)] rounded-2xl animate-pulse" />)}
        </div>
      ) : activeTab === 'received' ? (
        receivedCerts.length === 0 ? (
          <div className="glass rounded-3xl p-20 text-center border border-[var(--border-subtle)]">
            <Award className="w-16 h-16 mx-auto mb-4 text-[var(--text-secondary)] opacity-20" />
            <h3 className="text-xl font-bold text-[var(--text-primary)] mb-2">No Certificates Yet</h3>
            <p className="text-sm text-[var(--text-secondary)]">Certificates issued to you will appear here.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {Object.keys(groupedReceived).map(batchId => {
              const certs = groupedReceived[batchId];
              const isOpen = expandedReceivedBatch === batchId;
              return (
                <div key={batchId} className="glass rounded-2xl border border-[var(--border-subtle)] overflow-hidden transition-all">
                  <div onClick={() => setExpandedReceivedBatch(isOpen ? null : batchId)}
                    className="flex items-center justify-between px-6 py-5 cursor-pointer hover:bg-[var(--border-subtle)] transition-colors">
                    <div className="flex items-center gap-4">
                      <div className={`p-2.5 rounded-xl ${isOpen ? 'bg-indigo-600 text-white' : 'bg-indigo-500/10 text-indigo-500'}`}><Calendar className="w-4 h-4" /></div>
                      <div>
                        <p className="font-semibold text-[var(--text-primary)] text-sm">{batchId}</p>
                        <p className="text-xs text-[var(--text-secondary)]">{fmt(certs[0]?.createdAt)} · {certs.length} certificate{certs.length !== 1 ? 's' : ''}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-semibold text-emerald-500 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 rounded-full">Verified</span>
                      {isOpen ? <ChevronUp className="w-4 h-4 text-indigo-500" /> : <ChevronDown className="w-4 h-4 text-[var(--text-secondary)]" />}
                    </div>
                  </div>
                  {isOpen && (
                    <div className="border-t border-[var(--border-subtle)] overflow-x-auto">
                      <table className="w-full text-left">
                        <thead><tr className="border-b border-[var(--border-subtle)] bg-[var(--border-subtle)]">
                          {['Recipient', 'Certificate ID', 'Actions'].map(h => <th key={h} className="px-6 py-3 text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">{h}</th>)}
                        </tr></thead>
                        <tbody className="divide-y divide-[var(--border-subtle)]">
                          {certs.map(cert => (
                            <tr key={cert._id} className="hover:bg-[var(--border-subtle)] transition-colors">
                              <td className="px-6 py-4"><p className="font-semibold text-sm text-[var(--text-primary)]">{cert.name}</p><p className="text-xs text-[var(--text-secondary)]">{cert.email || '—'}</p></td>
                              <td className="px-6 py-4"><span className="font-mono text-xs text-[var(--text-secondary)] bg-[var(--border-subtle)] px-2 py-1 rounded-lg">{cert.certificateId}</span></td>
                              <td className="px-6 py-4">
                                <span className="text-[10px] font-black uppercase tracking-widest opacity-20 select-none">Protected</span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )
      ) : (
        Object.keys(groupedBatches).length === 0 ? (
          <div className="glass rounded-3xl p-20 text-center border border-[var(--border-subtle)]">
            <Package className="w-16 h-16 mx-auto mb-4 text-[var(--text-secondary)] opacity-20" />
            <h3 className="text-xl font-bold text-[var(--text-primary)] mb-2">No Batches Yet</h3>
            <p className="text-sm text-[var(--text-secondary)] mb-8">Upload a recipient list to create your first batch.</p>
            <button onClick={() => navigate('/upload')} className="px-8 py-3 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold rounded-xl transition-all shadow-lg shadow-indigo-500/20 active:scale-95">
              Create Batch →
            </button>
          </div>
        ) : (
          <div className="flex flex-col lg:flex-row gap-8 items-start">
            <div className="flex-1 space-y-3 w-full">
              {Object.keys(groupedBatches)
                .filter(bid => { if (statusFilter === 'all') return true; const cs = groupedBatches[bid]; const allSent = cs.every(c => c.status === 'Sent'); return statusFilter === 'sent' ? allSent : !allSent; })
                .sort((a, b) => { if (sortBy === 'az') return a.localeCompare(b); const dA = new Date(groupedBatches[a][0]?.createdAt || 0); const dB = new Date(groupedBatches[b][0]?.createdAt || 0); return sortBy === 'newest' ? dB - dA : dA - dB; })
                .map(batchId => {
                  const certs = groupedBatches[batchId];
                  const sent = certs.filter(c => c.status === 'Sent').length;
                  const failed = certs.filter(c => c.status === 'Failed').length;
                  const pending = certs.length - sent - failed;
                  const isOpen = expandedBatch === batchId;

                  const filteredCerts = certs.filter(c => {
                    const s = certSearch.toLowerCase();
                    const matchSearch = !s || c.name?.toLowerCase().includes(s) || c.email?.toLowerCase().includes(s) || c.certificateId?.toLowerCase().includes(s);
                    let matchStatus = true;
                    if (localStatusFilter === 'sent') matchStatus = c.status === 'Sent';
                    else if (localStatusFilter === 'ready') matchStatus = c.status !== 'Sent';
                    return matchSearch && matchStatus;
                  }).sort((a, b) => localSortOrder === 'asc' ? (a.name || '').localeCompare(b.name || '') : (b.name || '').localeCompare(a.name || ''));

                  return (
                    <div key={batchId} className={`glass rounded-2xl border overflow-hidden transition-all ${isOpen ? 'border-indigo-500/40' : 'border-[var(--border-subtle)]'}`}>
                      {/* Batch Header */}
                      <div onClick={() => setExpandedBatch(isOpen ? null : batchId)}
                        className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-6 py-5 cursor-pointer hover:bg-[var(--border-subtle)] transition-colors">
                        <div className="flex items-center gap-4">
                          <div className={`p-2.5 rounded-xl shrink-0 ${isOpen ? 'bg-indigo-600 text-white' : 'bg-indigo-500/10 text-indigo-500'}`}><Calendar className="w-4 h-4" /></div>
                          <div>
                            <p className="font-semibold text-[var(--text-primary)] text-sm flex items-center gap-2">
                               {batchId}
                               {certs.some(c => c.isAutomation) && (
                                 <span className="text-[9px] bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 px-2 py-0.5 rounded-full uppercase font-black tracking-widest shrink-0 flex items-center gap-1">
                                    <Zap className="w-2.5 h-2.5" /> Auto-Cert Generation
                                 </span>
                               )}
                            </p>
                            <p className="text-xs text-[var(--text-secondary)]">By {certs[0]?.createdBy?.name || 'Super Admin'} · {fmt(certs[0]?.createdAt)} · {certs.length} certificate{certs.length !== 1 ? 's' : ''}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 flex-wrap">
                          <div className="flex items-center gap-3 text-xs font-medium">
                            <span className="flex items-center gap-1.5 text-emerald-500"><div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />{sent} Sent</span>
                            {failed > 0 && <span className="flex items-center gap-1.5 text-red-500"><div className="w-1.5 h-1.5 rounded-full bg-red-500" />{failed} Failed</span>}
                            {pending > 0 && <span className="flex items-center gap-1.5 text-amber-500"><div className="w-1.5 h-1.5 rounded-full bg-amber-500" />{pending} Pending</span>}
                          </div>
                          <button onClick={e => { e.stopPropagation(); navigate(`/designer?id=${certs[0].templateId?._id || certs[0].templateId}`); }}
                            className="px-3 py-1.5 rounded-lg border border-indigo-500/30 text-indigo-500 hover:bg-indigo-500 hover:text-white text-xs font-black uppercase tracking-widest transition-all active:scale-95 flex items-center gap-2 group">
                            <PenTool className="w-3.5 h-3.5" />
                            <span>Edit Layout</span>
                          </button>
                          <button onClick={e => { e.stopPropagation(); setSelectedBatchId(batchId); setShowMappingModal(true); }}
                            className="px-3 py-1.5 rounded-lg border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] text-xs font-medium transition-all">
                            Missing Emails?
                          </button>
                          <button onClick={e => { e.stopPropagation(); handleSendBatchEmails(certs); }}
                            disabled={pending === 0 && failed === 0}
                            className="flex items-center gap-2 px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-30 text-white text-xs font-semibold rounded-lg transition-all active:scale-95">
                            <Mail className="w-3.5 h-3.5" />Send Emails
                          </button>
                          {isOpen ? <ChevronUp className="w-4 h-4 text-indigo-500" /> : <ChevronDown className="w-4 h-4 text-[var(--text-secondary)]" />}
                        </div>
                      </div>

                      {/* Expanded Table */}
                      {isOpen && (
                        <div className="border-t border-[var(--border-subtle)]">
                          <div className="flex flex-col sm:flex-row items-center gap-3 px-6 py-4 border-b border-[var(--border-subtle)] bg-[var(--border-subtle)]" onClick={e => e.stopPropagation()}>
                            <div className="relative flex-1">
                              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-secondary)]" />
                              <input type="text" placeholder="Search certificates..." value={certSearch} onChange={e => setCertSearch(e.target.value)}
                                className="w-full pl-9 pr-4 py-2 text-sm rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] text-[var(--text-primary)] focus:outline-none focus:border-indigo-500" />
                            </div>
                            <div className="flex items-center gap-1 bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-xl p-1">
                              {['all', 'ready', 'sent'].map(s => (
                                <button key={s} onClick={e => { e.stopPropagation(); setLocalStatusFilter(s); }}
                                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${localStatusFilter === s ? 'bg-indigo-600 text-white' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}>
                                  {s === 'ready' ? 'Pending' : s.charAt(0).toUpperCase() + s.slice(1)}
                                </button>
                              ))}
                            </div>
                            <button onClick={e => { e.stopPropagation(); setLocalSortOrder(o => o === 'asc' ? 'desc' : 'asc'); }}
                              className="px-3 py-2 text-xs font-medium text-[var(--text-secondary)] border border-[var(--border-subtle)] rounded-xl hover:text-[var(--text-primary)] transition-all">
                              <List className="w-4 h-4" />
                            </button>
                            <span className="text-xs text-[var(--text-secondary)] whitespace-nowrap">{filteredCerts.length}/{certs.length}</span>
                          </div>
                          <div className="overflow-x-auto">
                            <table className="w-full text-left">
                              <thead><tr className="border-b border-[var(--border-subtle)]">
                                {['Name / Email', 'Certificate ID', 'Status', 'Actions'].map(h => <th key={h} className="px-6 py-3 text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">{h}</th>)}
                              </tr></thead>
                              <tbody className="divide-y divide-[var(--border-subtle)]">
                                {filteredCerts.map(cert => (
                                  <tr key={cert._id} className="hover:bg-[var(--border-subtle)] transition-colors group">
                                    <td className="px-6 py-4"><p className="font-semibold text-sm text-[var(--text-primary)]">{cert.name}</p><p className="text-xs text-[var(--text-secondary)]">{cert.email || 'No email set'}</p></td>
                                    <td className="px-6 py-4"><span className="font-mono text-xs text-[var(--text-secondary)] bg-[var(--border-subtle)] px-2 py-1 rounded-lg">#{cert.certificateId?.substring(0, 12)}…</span></td>
                                    <td className="px-6 py-4">
                                      {cert.status === 'Sent' ? <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 text-xs font-semibold rounded-full"><div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />Delivered</span>
                                      : cert.email ? <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-500/10 text-indigo-600 border border-indigo-500/20 text-xs font-semibold rounded-full"><div className="w-1.5 h-1.5 rounded-full bg-indigo-500" />Ready</span>
                                      : <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-500/10 text-amber-600 border border-amber-500/20 text-xs font-semibold rounded-full"><div className="w-1.5 h-1.5 rounded-full bg-amber-500" />No Email</span>}
                                    </td>
                                    <td className="px-6 py-4">
                                      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button onClick={e => { e.stopPropagation(); handleSendEmail(cert.certificateId); }} className="p-2 rounded-lg border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-emerald-500 hover:border-emerald-500/40 transition-all" title="Send Email"><Mail className="w-4 h-4" /></button>
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
                })}
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
                                       className={`p-1.5 rounded-lg border transition-all ${auto.active ? 'border-amber-500/30 text-amber-600 hover:bg-amber-500/10' : 'border-emerald-500/30 text-emerald-500 hover:bg-emerald-500/10'}`}>
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
        )
      )}

      {/* ── Verify Banner ──────────────────────────────────────────────────── */}
      <div className="glass rounded-2xl p-8 border border-[var(--border-subtle)] flex flex-col sm:flex-row items-center justify-between gap-6">
        <div>
          <h3 className="text-lg font-bold text-[var(--text-primary)] mb-1">Certificate Verification Portal</h3>
          <p className="text-sm text-[var(--text-secondary)]">Anyone can verify the authenticity of a certificate using its ID or QR code.</p>
        </div>
        <Link to="/verify-portal" className="shrink-0 flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold rounded-xl transition-all shadow-lg shadow-indigo-500/20 active:scale-95">
          <Search className="w-4 h-4" /><span>Verify Portal</span>
        </Link>
      </div>

      {/* ── Email Mapping Modal ────────────────────────────────────────────── */}
      {showMappingModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="glass w-full max-w-xl rounded-2xl border border-[var(--border-subtle)] shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b border-[var(--border-subtle)]">
              <div>
                <h2 className="text-lg font-bold text-[var(--text-primary)]">Upload Email List</h2>
                <p className="text-xs text-[var(--text-secondary)] mt-0.5">Batch: <span className="text-indigo-500 font-semibold">{selectedBatchId}</span></p>
              </div>
              <button onClick={() => { setShowMappingModal(false); setExcelData([]); }} className="p-2 rounded-xl hover:bg-[var(--border-subtle)] text-[var(--text-secondary)] transition-all"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-6">
              {!excelData.length ? (
                <>
                  <label htmlFor="mapping-upload" className="flex flex-col items-center justify-center p-10 border-2 border-dashed border-[var(--border-subtle)] rounded-2xl cursor-pointer hover:border-indigo-500/40 hover:bg-indigo-500/5 transition-all">
                    <div className="p-4 bg-indigo-500/10 rounded-2xl mb-4"><FileUp className="w-8 h-8 text-indigo-500" /></div>
                    <p className="font-semibold text-[var(--text-primary)] text-sm">Upload Excel or CSV</p>
                    <p className="text-xs text-[var(--text-secondary)] mt-1">Must contain name and email columns</p>
                    <input type="file" id="mapping-upload" className="hidden" accept=".xlsx,.csv" onChange={handleFileUpload} />
                  </label>
                  <div className="flex items-center gap-3"><div className="flex-1 h-px bg-[var(--border-subtle)]" /><span className="text-xs text-[var(--text-secondary)]">or use Google Sheets</span><div className="flex-1 h-px bg-[var(--border-subtle)]" /></div>
                  <div className="flex gap-3">
                    <input type="text" placeholder="Google Sheets public link..." value={googleSheetUrl} onChange={e => setGoogleSheetUrl(e.target.value)}
                      className="flex-1 px-4 py-2.5 text-sm rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] text-[var(--text-primary)] focus:outline-none focus:border-indigo-500" />
                    <button onClick={handleSheetImportInModal} disabled={mappingLoading || !googleSheetUrl}
                      className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold rounded-xl disabled:opacity-40 transition-all active:scale-95">
                      {mappingLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Import'}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    {[{ label: 'Name / ID Column', key: 'targetId', placeholder: 'Select name column...' }, { label: 'Email Column', key: 'email', placeholder: 'Select email column...' }].map(f => (
                      <div key={f.key}>
                        <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-2">{f.label}</label>
                        <select value={mapping[f.key]} onChange={e => setMapping({ ...mapping, [f.key]: e.target.value })}
                          className="w-full px-4 py-2.5 text-sm rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] text-[var(--text-primary)] focus:outline-none focus:border-indigo-500 cursor-pointer">
                          <option value="">{f.placeholder}</option>
                          {excelHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                        </select>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-3">
                    <button onClick={() => setExcelData([])} className="flex-1 py-2.5 text-sm font-semibold rounded-xl border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all">Back</button>
                    <button onClick={confirmMapping} disabled={mappingLoading}
                      className="flex-[2] py-2.5 flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold rounded-xl disabled:opacity-40 transition-all active:scale-95">
                      {mappingLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><span>Save Updates</span><ArrowRight className="w-4 h-4" /></>}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
