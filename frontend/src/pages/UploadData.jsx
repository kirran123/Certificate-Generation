import { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import {
  FileSpreadsheet, ArrowRight, Link as LinkIcon, Loader2,
  Zap, CheckCircle2, PauseCircle, Trash2, RefreshCw, Clock
} from 'lucide-react';
import { API_BASE } from '../apiConfig';

import { downloadSampleExcel, SAMPLE_FORM_URL } from '../utils/sampleExcelGenerator';
import { Download } from 'lucide-react';

export default function UploadData() {
  const navigate = useNavigate();

  // ── Data state ───────────────────────────────────────────────────────────
  const [file, setFile] = useState(null);
  const [data, setData] = useState(null);
  const [headers, setHeaders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sheetUrl, setSheetUrl] = useState('');

  const [sheetWarning, setSheetWarning] = useState('');

  // ── On mount ─────────────────────────────────────────────────────────────
  useEffect(() => {
    // Component mounted
  }, []);

  // ── Fetchers ─────────────────────────────────────────────────────────────


  const fetchSheet = async (navigateAfter = true) => {
    if (!sheetUrl) { setError('Paste a Google Sheets link first.'); return false; }
    setLoading(true); setError(''); setSheetWarning('');
    try {
      const token = sessionStorage.getItem('token');
      const res = await axios.post(`${API_BASE}/api/certificate/upload-sheet`,
        { sheetUrl },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const cols = res.data.headers || [];
      setHeaders(cols);
      setData(res.data.data || []);

      if (res.data.warning) {
        setSheetWarning(res.data.warning);
      }
      if (navigateAfter) {
        navigate('/designer', { state: { excelData: res.data.data, excelHeaders: cols, sheetUrl } });
      }
      return true;
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to import sheet. Make sure it is set to "Anyone with the link can view".');
      return false;
    } finally { setLoading(false); }
  };

  // ── File upload ──────────────────────────────────────────────────────────
  const handleFileChange = (e) => {
    if (e.target.files?.[0]) setFile(e.target.files[0]);
  };

  const handleUpload = async () => {
    if (!file) return;
    setLoading(true); setError('');
    const formData = new FormData();
    formData.append('file', file);
    try {
      const token = sessionStorage.getItem('token');
      const res = await axios.post(`${API_BASE}/api/certificate/upload-data`, formData, {
        headers: { 'Content-Type': 'multipart/form-data', Authorization: `Bearer ${token}` }
      });
      navigate('/designer', { state: { excelData: res.data.data, excelHeaders: res.data.headers } });
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to upload file.');
    } finally { setLoading(false); }
  };

  // ── Automation actions ───────────────────────────────────────────────────


  // ── Utilities ────────────────────────────────────────────────────────────
  const proceedToDesigner = () =>
    navigate('/designer', { state: { excelData: data, excelHeaders: headers } });

  const fmtDate = (d) => d ? new Date(d).toLocaleString() : 'Not yet';

  const showCards = !data || data.length === 0;

  // ══════════════════════════════════════════════════════════════════════════
  return (
    <div className="p-6 md:p-10 max-w-7xl mx-auto space-y-8">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <p className="text-xs font-semibold text-indigo-500 uppercase tracking-widest mb-1">Upload Data</p>
          <h1 className="text-3xl font-black text-[var(--text-primary)] tracking-tight mb-1">Select Source Data</h1>
          <p className="text-sm text-[var(--text-secondary)]">
            Import your recipient list via Excel, CSV, or Google Sheets to begin.
          </p>
        </div>
      </div>

      {/* ── Sample Form & Zero-Error Template Banner ───────────────────── */}
      <div className="rounded-3xl border border-indigo-500/20 bg-indigo-500/5 p-6 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-500/10 border border-indigo-500/20 rounded-full text-[11px] font-bold text-indigo-400 uppercase tracking-wider">
            <span>✨ Zero-Error Template Setup</span>
          </div>
          <h3 className="text-base font-bold text-[var(--text-primary)]">Sample Feedback Form & Standard Headers</h3>
          <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
            Kindly follow this template format to generate certificates without any errors: <br/>
            <span className="font-mono text-indigo-400 bg-black/30 px-2 py-0.5 rounded text-[11px] inline-block mt-1 mr-1">Name (Eg: Kirran S T)</span>
            <span className="font-mono text-indigo-400 bg-black/30 px-2 py-0.5 rounded text-[11px] inline-block mt-1 mr-1">Email (Eg: kirranvijay@gmail.com)</span>
            <span className="font-mono text-indigo-400 bg-black/30 px-2 py-0.5 rounded text-[11px] inline-block mt-1 mr-1">Department (Eg: B.Tech IT)</span>
            <span className="font-mono text-indigo-400 bg-black/30 px-2 py-0.5 rounded text-[11px] inline-block mt-1 mr-1">Year (Eg: IV Year)</span>
            <span className="font-mono text-indigo-400 bg-black/30 px-2 py-0.5 rounded text-[11px] inline-block mt-1">College (Eg: Ramco Institute Of Technology)</span>
          </p>
        </div>
        <div className="flex flex-col gap-2 shrink-0">
          <p className="text-xs sm:text-sm font-bold text-indigo-300 text-left md:text-right max-w-md leading-snug">
            Sample Feedback Form below like to check and Use this type to get the certificate without error. Kindly follow this template for generate certificate without any errors.
          </p>
          <div className="flex flex-col sm:flex-row gap-2.5 justify-end">
            <a
              href={SAMPLE_FORM_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs rounded-lg transition-all shadow-md active:scale-95 text-center"
            >
              <LinkIcon className="w-3.5 h-3.5" />
              <span>Open Sample Feedback Form</span>
            </a>
            <button
              onClick={downloadSampleExcel}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 bg-white/5 border border-white/10 hover:bg-white/10 text-[var(--text-primary)] font-semibold text-xs rounded-lg transition-all active:scale-95 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download Sample Excel</span>
            </button>
          </div>
        </div>
      </div>



      {/* ── Upload Cards (only when no data loaded) */}
      {showCards && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* Excel / CSV ─────────────────────────────────────────────────── */}
          <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-8 flex flex-col items-center text-center gap-6">
            <div>
              <div className="w-16 h-16 bg-indigo-500/10 border border-indigo-500/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <FileSpreadsheet className="w-8 h-8 text-indigo-500" />
              </div>
              <h3 className="text-lg font-bold text-[var(--text-primary)] mb-1">Excel / CSV File</h3>
              <p className="text-sm text-[var(--text-secondary)]">Upload a .xlsx or .csv recipient list</p>
            </div>

            <input type="file" id="file-upload" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFileChange} />
            <label htmlFor="file-upload"
              className="w-full cursor-pointer px-6 py-3 rounded-xl border-2 border-dashed border-[var(--border-subtle)] hover:border-indigo-500/40 hover:bg-indigo-500/5 text-sm text-[var(--text-secondary)] hover:text-indigo-500 transition-all">
              {file ? `📄 ${file.name}` : 'Click to select file'}
            </label>

            {file && (
              <button onClick={handleUpload} disabled={loading}
                className="w-full flex items-center justify-center gap-2 py-3 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold rounded-xl transition-all disabled:opacity-50 active:scale-95">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
                {loading ? 'Processing...' : 'Upload & Open Editor'}
              </button>
            )}
          </div>

          {/* Google Sheets ───────────────────────────────────────────────── */}
          <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-8 flex flex-col gap-5">
            <div>
              <div className="w-16 h-16 bg-violet-500/10 border border-violet-500/20 rounded-2xl flex items-center justify-center mb-4">
                <LinkIcon className="w-8 h-8 text-violet-500" />
              </div>
              <h3 className="text-lg font-bold text-[var(--text-primary)] mb-1">Google Sheets</h3>
              <p className="text-sm text-[var(--text-secondary)]">
                Import from a public Google Sheet to begin.
              </p>
            </div>

            {/* URL input */}
            <div className="relative">
              <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-secondary)]" />
              <input type="text" placeholder="Paste Google Sheets public link..."
                className="w-full pl-10 pr-4 py-3 text-sm rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-main)] text-[var(--text-primary)] focus:outline-none focus:border-violet-500 transition-all"
                value={sheetUrl} onChange={e => setSheetUrl(e.target.value)} disabled={loading} />
            </div>

            {/* Action button */}
            <button onClick={() => fetchSheet(true)} disabled={loading || !sheetUrl}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold transition-all disabled:opacity-40 active:scale-95">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
              Open Editor
            </button>

            <p className="text-xs text-[var(--text-secondary)] text-center opacity-70">
              Sheet must be set to "Anyone with the link can view"
            </p>

            {/* Error */}
            {error && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl">
                <p className="text-red-500 text-xs font-medium">{error}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Data Preview (after manual import, before navigating) ─────── */}
      {data && data.length > 0 && (
        <div className="space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-[var(--text-primary)]">Data Preview</h2>
              <p className="text-sm text-[var(--text-secondary)]">{data.length} records loaded</p>
            </div>
            <div className="flex items-center gap-3">
              <button onClick={() => { setData(null); setFile(null); setSheetUrl(''); setHeaders([]); }}
                className="px-4 py-2 text-sm rounded-xl border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all">
                Clear
              </button>
              <button onClick={proceedToDesigner}
                className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold rounded-xl transition-all active:scale-95">
                Open Editor <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-[var(--border-subtle)] bg-[var(--border-subtle)]">
                    {headers.map((h, i) => (
                      <th key={i} className="px-5 py-3 text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-subtle)]">
                  {data.slice(0, 10).map((row, i) => (
                    <tr key={i} className="hover:bg-[var(--border-subtle)] transition-colors">
                      {headers.map((h, j) => (
                        <td key={j} className="px-5 py-3 text-sm text-[var(--text-secondary)]">{String(row[h] ?? '')}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {data.length > 10 && (
              <div className="px-5 py-3 border-t border-[var(--border-subtle)] text-center">
                <p className="text-xs text-[var(--text-secondary)]">Showing 10 of {data.length} records</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
