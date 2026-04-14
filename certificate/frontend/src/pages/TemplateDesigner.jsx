import { useState, useRef, useEffect } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import axios from "axios";
import { API_BASE } from "../apiConfig";
import { Rnd } from "react-rnd";
import {
  Save,
  Plus,
  ArrowRight,
  Image as ImageIcon,
  Download,
  Eye,
  EyeOff,
  Mail,
  Check,
  PenTool,
  Loader2,
  Type,
  Bold,
  Baseline,
  ChevronLeft,
  Settings,
  X,
  Minus,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Italic,
  Underline,
  Zap,
  Zap,
  Trash2,
  XCircle
} from "lucide-react";

// ── Small helper component: manual field name entry ──────────────────────
function ManualFieldInput({ onAdd }) {
  const [val, setVal] = useState('');
  const submit = () => {
    const trimmed = val.trim();
    if (!trimmed) return;
    onAdd(trimmed, true); // Pass true for isStatic
    setVal('');
  };
  return (
    <div className="flex gap-2">
      <input
        type="text"
        placeholder="e.g. Batch Name, Signature, Venue..."
        value={val}
        onChange={e => setVal(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && submit()}
        className="flex-1 bg-black/40 border border-white/5 rounded-xl px-3 py-2.5 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] focus:outline-none focus:border-indigo-500 transition-all"
      />
      <button
        onClick={submit}
        disabled={!val.trim()}
        className="p-2.5 bg-indigo-600/10 border border-indigo-500/20 rounded-xl text-indigo-400 hover:bg-indigo-600 hover:text-white transition-all disabled:opacity-30"
      >
        <Plus className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

export default function TemplateDesigner() {
  const { state } = useLocation();
  const navigate = useNavigate();
  
  // Guard against missing state or accidental direct navigation
  const excelHeaders = state?.excelHeaders || [];
  const excelData = state?.excelData || [];
  const passedSheetUrl = state?.sheetUrl || '';

  const [templateName, setTemplateName] = useState(
    "Certificate Batch " + new Date().toLocaleDateString(),
  );
  const [file, setFile] = useState(null);
  const [searchParams] = useSearchParams();
  const templateIdFromUrl = searchParams.get("id");
  const [imageUrl, setImageUrl] = useState("");
  const [imgError, setImgError] = useState(false);
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
  const [fields, setFields] = useState([]);
  const [qrCode, setQrCode] = useState(null);
  const [saving, setSaving] = useState(false);
  const [designLoading, setDesignLoading] = useState(false);
  const [selectedFieldId, setSelectedFieldId] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [genData, setGenData] = useState({ count: 0, skipped: 0, batchId: "" });
  const [emailConfig, setEmailConfig] = useState({
    subject: "Certificate of Achievement",
    message: "Congratulations! Your certificate is attached.",
    senderName: "DigiCertify",
    senderEmail: "digicertify00@gmail.com",
  });
  const [selection, setSelection] = useState({}); // To store field -> excel header mapping
  const [showId, setShowId] = useState(true);
  const [showQr, setShowQr] = useState(true);
  const [batchName, setBatchName] = useState(
    "Batch " + new Date().toISOString().slice(0, 10) + " " + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })
  ); // Custom batch name
  const [zoom, setZoom] = useState(0.8);
  const [isPreview, setIsPreview] = useState(false);
  const canvasContainerRef = useRef(null);
  const canvasRef = useRef(null);
  const imgRef = useRef(null);

  // ── Auto-cert state (appears after saving template) ──────────────────
  const [showAutoCert, setShowAutoCert] = useState(false);
  const [savedTemplateId, setSavedTemplateId] = useState('');
  const [autoNameCol, setAutoNameCol] = useState('');
  const [autoEmailCol, setAutoEmailCol] = useState('');
  const [autoActivating, setAutoActivating] = useState(false);
  const [autoSuccess, setAutoSuccess] = useState(false);

  useEffect(() => {
    const fetchTemplate = async () => {
      if (templateIdFromUrl) {
        setSaving(true);
        const token = sessionStorage.getItem('token');
        try {
          const res = await axios.get(`${API_BASE}/api/template/${templateIdFromUrl}`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          const t = res.data;
          setTemplateName(t.name);
          // Handle imageUrl correctly on load
          const finalUrl = t.imageUrl.startsWith('http') ? t.imageUrl : `${API_BASE}${t.imageUrl}`;
          setImageUrl(finalUrl);
          setFields(t.layoutConfig?.fields || []);
          setQrCode(t.qrCode || null);
          setShowId(t.showId !== undefined ? t.showId : true);
          setShowQr(t.showQr !== undefined ? t.showQr : true);
          setSavedTemplateId(t._id);
          localStorage.setItem("lastSavedTemplateId", t._id);
        } catch (err) {
          console.error("Failed to load template:", err);
          alert("Failed to load design template. Showing blank editor.");
        } finally {
          setSaving(false);
        }
      }
    };
    fetchTemplate();
  }, [templateIdFromUrl]);

  // ── Auto-redirect after success ──────────────────────────────────────────
  useEffect(() => {
    if (autoSuccess) {
      const timer = setTimeout(() => {
        navigate('/dashboard');
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [autoSuccess, navigate]);

  const hexToRgb = (hex) => {
    const h = hex.replace("#", "");
    return {
      r: parseInt(h.substring(0, 2), 16),
      g: parseInt(h.substring(2, 4), 16),
      b: parseInt(h.substring(4, 6), 16),
    };
  };

  const rgbToHex = (color) => {
    if (!color) return "#000000";
    const norm = (val) => Math.round(val).toString(16).padStart(2, "0");
    return `#${norm(color.r || 0)}${norm(color.g || 0)}${norm(color.b || 0)}`;
  };

  const handleImageUpload = async (e, droppedFile = null) => {
    const fileToUpload = droppedFile || (e.target.files && e.target.files[0]);
    if (fileToUpload) {
      setFile(fileToUpload);
      setDesignLoading(true);
      setImgError(false);

      const formData = new FormData();
      formData.append("image", fileToUpload);

      try {
        const token = sessionStorage.getItem('token');
        const res = await axios.post(
          `${API_BASE}/api/template/upload-image`,
          formData,
          {
            headers: {
              "Content-Type": "multipart/form-data",
              Authorization: `Bearer ${token}`,
            },
          },
        );
        const uploadedUrl = res.data.imageUrl;
        setImageUrl(uploadedUrl.startsWith('http') ? uploadedUrl : `${API_BASE}${uploadedUrl}`);
      } catch (err) {
        console.error(err);
        alert("UPLOAD FAILED: " + (err.response?.data?.message || "Check your internet connection or file size."));
      } finally {
        setDesignLoading(false);
      }
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleImageUpload(null, e.dataTransfer.files[0]);
    }
  };

  const handleImageLoad = (e) => {
    const { naturalWidth, naturalHeight } = e.target;
    setImageSize({ width: naturalWidth, height: naturalHeight });
    
    // Auto-fit on load
    if (canvasContainerRef.current) {
      const containerWidth = canvasContainerRef.current.clientWidth - 100;
      const containerHeight = canvasContainerRef.current.clientHeight - 100;
      const fitZoom = Math.min(containerWidth / naturalWidth, containerHeight / naturalHeight, 1);
      setZoom(Number(fitZoom.toFixed(2)));
    }
  };

  const handleZoom = (type) => {
    if (type === 'in') setZoom(prev => Math.min(prev + 0.1, 3));
    if (type === 'out') setZoom(prev => Math.max(prev - 0.1, 0.1));
    if (type === 'fit') {
      if (canvasContainerRef.current && imageSize.width) {
        const containerWidth = canvasContainerRef.current.clientWidth - 100;
        const containerHeight = canvasContainerRef.current.clientHeight - 100;
        const fitZoom = Math.min(containerWidth / imageSize.width, containerHeight / imageSize.height, 1);
        setZoom(Number(fitZoom.toFixed(2)));
      }
    }
    if (type === 'reset') setZoom(1);
  };

  const addField = (headerName, isStatic = false) => {
    setFields([
      ...fields,
      {
        id: Date.now().toString(),
        key: headerName, // This binds to the excel header
        staticValue: isStatic ? headerName : null,
        x: 50,
        y: 50,
        width: 200,
        height: 40,
        fontSize: 24,
        color: { r: 50, g: 50, b: 50 },
      },
    ]);
  };

  const addQrCode = () => {
    if (qrCode) return;
    setQrCode({
      x: 50,
      y: 50,
      width: 140,
      height: 140,
    });
  };

  const saveLayout = async () => {
    setSaving(true);
    try {
      const token = sessionStorage.getItem('token');
      const layoutConfig = {
        fields,
        qrCode,
      };

      const res = await axios.post(
        `${API_BASE}/api/template/save-layout`,
        {
          templateId: savedTemplateId || templateIdFromUrl, // Pass ID if editing
          name: templateName || "My Template",
          imageUrl: imageUrl.replace(API_BASE, ""),
          layoutConfig,
          showId,
          showQr,
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      localStorage.setItem("lastSavedTemplateId", res.data._id);
      setSavedTemplateId(res.data._id);
      setSaving("done");

      setSaving("done");
    } catch (err) {
      console.error(err);
      alert("Failed to save layout");
    }
  };

  // ── Auto-cert activation ────────────────────────────────────────────────
  const handleActivateAutoCert = async (overrideNameCol, overrideEmailCol) => {
    const finalNameCol = overrideNameCol || autoNameCol;
    const finalEmailCol = overrideEmailCol || autoEmailCol;
    const actualTemplateId = savedTemplateId || localStorage.getItem("lastSavedTemplateId");
    
    if (!passedSheetUrl) {
      alert("No Google Sheet URL detected. Go back to Upload Data and paste your connection URL.");
      return;
    }
    if (!actualTemplateId) {
      alert("Template ID not found. Try clicking 'Save Template' again.");
      return;
    }
    if (!finalNameCol || !finalEmailCol) {
      alert("Please select both Name and Email columns.");
      return;
    }

    setAutoActivating(true);
    try {
      const token = sessionStorage.getItem('token');
      await axios.post(`${API_BASE}/api/certificate/form-automation`, {
        sheetUrl: passedSheetUrl,
        templateId: actualTemplateId,
        nameColumn: finalNameCol,
        emailColumn: finalEmailCol,
        batchId: batchName || "Automation Batch"
      }, { headers: { Authorization: `Bearer ${token}` } });
      setAutoSuccess(true);
      setSaving("auto_success");
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to activate automation.');
    } finally { setAutoActivating(false); }
  };

  const handlePreview = async (download = false) => {
    if (!imageUrl) return;

    setPreviewLoading(true);
    try {
      const firstRow = (excelData && excelData[0]) || {};
      const sampleData = {};

      if (excelHeaders.length > 0) {
        excelHeaders.forEach((h) => {
          sampleData[h] = firstRow[h] || `[${h} Sample]`;
        });
      } else {
        sampleData.name = "Jane Smith";
        sampleData.course = "Advanced Design Course";
      }

      const token = sessionStorage.getItem('token');
      
      // Upgrade to 'blob' response type for maximum stability
      const res = await axios.post(
        `${API_BASE}/api/certificate/preview`,
        {
          templateId: localStorage.getItem("lastSavedTemplateId"),
          layoutConfig: { fields, qrCode }, 
          imageUrl: imageUrl, 
          sampleData,
          showId,
          showQr,
        },
        {
          headers: { Authorization: `Bearer ${token}` },
          responseType: 'blob' // Essential for receiving raw binary PDF
        },
      );

      // Create blob directly from binary response
      const blob = new Blob([res.data], { type: "application/pdf" });
      const blobUrl = URL.createObjectURL(blob);

      if (download) {
        const link = document.createElement("a");
        link.href = blobUrl;
        link.download = `preview_${templateName || "certificate"}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else {
        // Open the blob directly in a new tab
        const win = window.open(blobUrl, "_blank");
        if (!win || win.closed || typeof win.closed === 'undefined') {
          alert('Popup blocked! Please allow popups to view the certificate.');
        }
      }

      // Cleanup blob memory after a delay (enough for browser to load it)
      setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);
      
    } catch (err) {
      console.error("Preview Error:", err);
      alert("Preview failed. Please ensure the template is saved and layout is valid.");
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleGenerateAndEmail = async (sendEmail = false) => {
    const mappedName = selection["name"];
    const mappedEmail = selection["email"];

    if (!mappedName) {
      alert('REQUIRED: Please map the "Recipient Name" field in the generation panel.');
      return;
    }

    if (sendEmail && !mappedEmail) {
       alert('REQUIRED FOR EMAIL: Please map the "Recipient Email" field.');
       return;
    }

    if (!batchName.trim()) {
       alert('NAME YOUR BATCH: Please enter a name for this batch before proceeding.');
       return;
    }

    setSaving(sendEmail ? "sending" : "generating");
    const token = sessionStorage.getItem('token');

    try {
      const genRes = await axios.post(
        `${API_BASE}/api/certificate/generate`,
        {
          templateId: localStorage.getItem("lastSavedTemplateId"),
          mappings: selection,
          rawData: state?.excelData || [],
          layoutConfig: { fields, qrCode }, // Send live design
          showId,
          showQr,
          batchId: batchName || undefined,
        },
        { headers: { Authorization: `Bearer ${token}` } },
      );

      const { generatedIds, generatedCount, skippedCount, batchId } =
        genRes.data;
      setGenData({ count: generatedCount, skipped: skippedCount, batchId });

      if (sendEmail && generatedIds.length > 0) {
        setSaving("sending");
        await axios.post(
          `${API_BASE}/api/certificate/send-bulk`,
          {
            certificateIds: generatedIds,
            subject: emailConfig.subject,
            message: emailConfig.message,
            senderName: emailConfig.senderName,
            senderEmail: emailConfig.senderEmail,
          },
          { headers: { Authorization: `Bearer ${token}` } },
        );
      }

      setSaving("done_all");
    } catch (e) {
      console.error(e);
      alert("Operation failed: " + (e.response?.data?.message || "Server Error"));
      setSaving("done");
    }
  };

  const toggleReview = () => setIsPreview(!isPreview);

  return (
    <div className="flex h-[calc(100vh-140px)] overflow-hidden animate-fade-in-up relative">
      {/* Sidebar Controls */}
      {!isPreview && (
        <div className="w-[380px] bg-[var(--bg-sidebar)] border-r border-[var(--border-subtle)] flex flex-col h-full overflow-y-auto no-scrollbar transition-all duration-500">
          <div className="p-8 space-y-10">
          <div>
            <div className="flex items-center space-x-2 text-indigo-400 text-[10px] font-black uppercase tracking-[0.3em] mb-4">
              <div className="w-8 h-px bg-indigo-500/50" />
              <span>Editor</span>
            </div>
            <h2 className="text-3xl font-black text-[var(--text-primary)] tracking-tighter leading-none mb-2">Design</h2>
            <p className="text-[var(--text-secondary)] text-xs font-medium">Design your certificate layout with precision.</p>
          </div>

          <div className="space-y-6">
            <div className="space-y-4">
               <label className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--text-secondary)] ml-1 opacity-70">Zoom</label>
               <div className="flex items-center space-x-2 bg-black/40 p-2 rounded-2xl border border-white/5 shadow-inner">
                  <button onClick={() => handleZoom('out')} className="flex-1 py-3 hover:bg-white/5 rounded-xl text-[var(--text-secondary)] transition-all flex items-center justify-center group/z">
                     <Minus className="w-3.5 h-3.5 group-hover/z:scale-110 transition-transform" />
                  </button>
                  <button onClick={() => handleZoom('in')} className="flex-1 py-3 hover:bg-white/5 rounded-xl text-[var(--text-secondary)] transition-all flex items-center justify-center group/z">
                     <Plus className="w-3.5 h-3.5 group-hover/z:scale-110 transition-transform" />
                  </button>
                  <button onClick={() => handleZoom('fit')} className="px-4 py-3 hover:bg-white/5 rounded-xl text-[9px] font-black text-[var(--text-secondary)] uppercase tracking-widest transition-all">
                     Fit
                  </button>
                  <button onClick={() => handleZoom('reset')} className="px-4 py-3 hover:bg-white/5 rounded-xl text-[9px] font-black text-[var(--text-secondary)] uppercase tracking-widest transition-all">
                     1:1
                  </button>
               </div>
            </div>

            <div className="space-y-4">
               <label className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--text-secondary)] ml-1 opacity-70">Template Info</label>
               <div className="space-y-6">
                   {/* ── Connection Status ── */}
                   {passedSheetUrl && (
                     <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 space-y-2">
                        <div className="flex items-center space-x-2">
                           <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                           <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest leading-none">Sheet Connected</span>
                        </div>
                        <p className="text-[10px] text-[var(--text-secondary)] font-medium truncate opacity-70 italic">
                           {passedSheetUrl}
                        </p>
                        {excelHeaders.length > 0 && (
                          <div className="pt-1 flex flex-wrap gap-1">
                             {excelHeaders.slice(0, 3).map(h => (
                               <span key={h} className="text-[8px] bg-emerald-500/10 text-emerald-500 px-1.5 py-0.5 rounded-md border border-emerald-500/10 uppercase font-bold">
                                  {h}
                               </span>
                             ))}
                             {excelHeaders.length > 3 && <span className="text-[8px] text-emerald-500/50 font-bold">+{excelHeaders.length - 3} more</span>}
                          </div>
                        )}
                     </div>
                   )}

                  <div className="space-y-1.5 ring-1 ring-white/5 p-4 rounded-2xl bg-black/20">
                    <label className="text-[10px] font-black text-indigo-400 uppercase tracking-widest ml-1">Template Identity</label>
                    <input
                      type="text"
                      className="w-full bg-transparent border-none py-1 px-1 text-sm text-[var(--text-primary)] focus:outline-none transition-all font-medium placeholder:text-[var(--text-secondary)] opacity-80"
                      value={templateName}
                      onChange={(e) => setTemplateName(e.target.value)}
                      placeholder="e.g., Year 10 Excellence"
                    />
                  </div>
                  <div className="space-y-1.5 ring-1 ring-white/5 p-4 rounded-2xl bg-black/20">
                    <label className="text-[10px] font-black text-indigo-400 uppercase tracking-widest ml-1">Archive Batch Name</label>
                    <input
                      type="text"
                      className="w-full bg-transparent border-none py-1 px-1 text-sm text-[var(--text-primary)] focus:outline-none transition-all font-medium placeholder:text-[var(--text-secondary)] opacity-80"
                      value={batchName}
                      onChange={(e) => setBatchName(e.target.value)}
                      placeholder="e.g., April_2026_Run"
                    />
                  </div>
               </div>
            </div>

            <div className="space-y-4">
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--text-secondary)] ml-1 opacity-70">Certificate Design</label>
              <label 
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                className="w-full group flex flex-col items-center justify-center space-y-2 p-8 bg-white/[0.02] hover:bg-white/[0.05] border border-white/5 rounded-[2.5rem] transition-all duration-500 hover:border-indigo-500/30 active:scale-95 cursor-pointer relative overflow-hidden"
              >
                {designLoading && (
                   <div className="absolute inset-0 bg-indigo-600/10 backdrop-blur-sm flex flex-col items-center justify-center z-10 animate-fade-in">
                      <Loader2 className="w-8 h-8 text-indigo-400 animate-spin mb-2" />
                      <span className="text-[8px] font-black text-indigo-400 uppercase tracking-widest">Importing...</span>
                   </div>
                )}
                <div className="w-12 h-12 bg-indigo-600/10 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform duration-500 shadow-xl shadow-indigo-600/5">
                  <ImageIcon className="w-6 h-6 text-indigo-400" />
                </div>
                <div className="text-center">
                  <p className="text-[10px] font-black text-[var(--text-primary)] uppercase tracking-widest leading-none mb-1">
                    {file ? 'Change Design' : 'Upload Design'}
                  </p>
                  <p className="text-[9px] text-[var(--text-secondary)] font-bold uppercase tracking-tight opacity-70">PNG/JPG High-Res</p>
                </div>
                <input
                  type="file"
                  className="hidden"
                  accept="image/png, image/jpeg"
                  onChange={handleImageUpload}
                />
              </label>
            </div>

            <div className="space-y-4">
               <label className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--text-secondary)] ml-1 opacity-70">Actions</label>
               <div className="grid grid-cols-2 gap-2">
                  <button onClick={toggleReview} className="flex items-center justify-center space-x-2 py-4 bg-white/5 hover:bg-white/10 border border-white/5 rounded-2xl transition-all group/op active:scale-95">
                     <Eye className="w-4 h-4 text-indigo-400" />
                     <span className="text-[10px] font-black uppercase tracking-widest">Preview</span>
                  </button>
                  <button onClick={() => handlePreview(true)} className="flex items-center justify-center space-x-2 py-4 bg-white/5 hover:bg-white/10 border border-white/5 rounded-2xl transition-all group/op active:scale-95">
                     <Download className="w-4 h-4 text-emerald-400" />
                     <span className="text-[10px] font-black uppercase tracking-widest">Draft</span>
                  </button>
                  <button onClick={saveLayout} className="col-span-2 py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl transition-all shadow-xl shadow-indigo-600/20 active:scale-95 text-[10px] font-black uppercase tracking-widest flex items-center justify-center space-x-2">
                     <Check className="w-4 h-4" />
                     <span>{saving === 'done' ? '✓ Saved' : 'Save Template'}</span>
                  </button>
               </div>
            </div>



            <div className="space-y-4">
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--text-secondary)] ml-1 opacity-70">Verification Settings</label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: "both", label: "Global", sid: true, sqr: true },
                  { id: "qr", label: "QR Only", sid: false, sqr: true },
                  { id: "id", label: "ID Only", sid: true, sqr: false },
                  { id: "none", label: "Off", sid: false, sqr: false },
                ].map((mode) => (
                  <button
                    key={mode.id}
                    onClick={() => {
                      setShowId(mode.sid);
                      setShowQr(mode.sqr);
                      if (!mode.sid) setFields((prev) => prev.filter((f) => f.key !== "certificateId"));
                      if (!mode.sqr) setQrCode(null);
                      else if (mode.sqr && !qrCode) {
                        setQrCode({ x: 50, y: 50, width: 140, height: 140 });
                      }
                    }}
                    className={`px-4 py-3 rounded-2xl border text-[10px] font-black uppercase tracking-widest transition-all ${
                      showId === mode.sid && showQr === mode.sqr
                        ? "border-indigo-500 bg-indigo-500/10 text-indigo-400 shadow-lg shadow-indigo-500/10"
                        : "border-white/5 bg-black/40 text-[var(--text-secondary)] opacity-50 hover:opacity-100 hover:border-white/10"
                    }`}
                  >
                    {mode.label}
                  </button>
                ))}
              </div>
            </div>

            {imageUrl && (
              <div className="space-y-8 animate-fade-in-up">
                <div className="space-y-4">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--text-secondary)] ml-1 opacity-70">Certificate Fields</label>
                  <div className="space-y-2">

                    {/* ── Columns from imported data ── */}
                    {excelHeaders.length > 0 ? (
                      excelHeaders.map((h) => (
                        <button
                          key={h}
                          onClick={() => addField(h)}
                          className="w-full text-left p-4 bg-black/40 border border-white/5 rounded-2xl text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-indigo-500/50 flex items-center justify-between group transition-all active:scale-95"
                        >
                          <span className="text-xs font-bold uppercase tracking-wider">{h}</span>
                          <div className="p-1.5 bg-white/5 rounded-lg group-hover:bg-indigo-600 transition-colors">
                             <Plus className="w-3 h-3" />
                          </div>
                        </button>
                      ))
                    ) : (
                      /* ── No data imported — show common presets ── */
                      <div className="space-y-2">
                        <p className="text-[9px] text-[var(--text-secondary)] opacity-60 font-black uppercase tracking-widest px-1">
                          Common Fields — click to add
                        </p>
                        {['name', 'email', 'course', 'date', 'grade'].map(preset => (
                          <button
                            key={preset}
                            onClick={() => addField(preset)}
                            className="w-full text-left p-4 bg-black/40 border border-white/5 rounded-2xl text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-indigo-500/50 flex items-center justify-between group transition-all active:scale-95"
                          >
                            <span className="text-xs font-bold uppercase tracking-wider">{preset}</span>
                            <div className="p-1.5 bg-white/5 rounded-lg group-hover:bg-indigo-600 transition-colors">
                              <Plus className="w-3 h-3" />
                            </div>
                          </button>
                        ))}
                      </div>
                    )}

                    {/* ── Manual field name input ── */}
                    <div className="pt-2">
                      <p className="text-[9px] text-[var(--text-secondary)] opacity-60 font-black uppercase tracking-widest px-1 mb-2">
                        Custom Text
                      </p>
                      <ManualFieldInput onAdd={addField} />
                    </div>

                    <div className="grid grid-cols-2 gap-2 mt-4">
                       {showId && (
                        <button
                          onClick={() => addField("certificateId")}
                          className="p-4 bg-indigo-600/5 border border-indigo-500/20 rounded-2xl text-indigo-400 hover:bg-indigo-600 hover:text-white flex items-center justify-center space-x-2 transition-all text-[10px] font-black uppercase tracking-widest"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>ID Box</span>
                        </button>
                      )}

                      {showQr && (
                        <button
                          onClick={addQrCode}
                          className="p-4 bg-emerald-600/5 border border-emerald-500/20 rounded-2xl text-emerald-400 hover:bg-emerald-600 hover:text-white flex items-center justify-center space-x-2 transition-all text-[10px] font-black uppercase tracking-widest disabled:opacity-30"
                          disabled={!!qrCode}
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>QR Box</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {selectedFieldId && fields.find((f) => f.id === selectedFieldId) && (() => {
                  const selField = fields.find(f => f.id === selectedFieldId);
                  const updateField = (updates) => {
                    const newFields = [...fields];
                    const idx = newFields.findIndex(f => f.id === selectedFieldId);
                    newFields[idx] = { ...newFields[idx], ...updates };
                    setFields(newFields);
                  };

                  const FONT_OPTIONS = [
                    { label: 'Sans', value: 'sans-serif' },
                    { label: 'Serif', value: 'serif' },
                    { label: 'Mono', value: 'monospace' },
                    { label: 'Georgia', value: 'Georgia, serif' },
                    { label: 'Palatino', value: '"Palatino Linotype", Palatino, serif' },
                    { label: 'Garamond', value: 'Garamond, serif' },
                    { label: 'Trebuchet', value: '"Trebuchet MS", sans-serif' },
                    { label: 'Impact', value: 'Impact, fantasy' },
                  ];

                  const PRESET_COLORS = [
                    '#FFFFFF', '#E5E7EB', '#9CA3AF', '#374151',
                    '#111111', '#1E3A5F', '#1D4ED8', '#7C3AED',
                    '#BE185D', '#DC2626', '#EA580C', '#D97706',
                    '#15803D', '#0F766E', '#0369A1', '#831843',
                  ];

                  return (
                  <div className="bg-white/[0.03] rounded-3xl border border-white/10 overflow-hidden animate-fade-in">
                    {/* Panel Header */}
                    <div className="flex items-center justify-between px-5 py-4 border-b border-white/5 bg-black/20">
                      <div className="flex items-center space-x-2">
                        <div className="w-1.5 h-4 bg-indigo-500 rounded-full" />
                        <span className="text-[10px] font-black uppercase tracking-widest text-[var(--text-primary)]">Text Style</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <button 
                          onClick={() => { setFields(fields.filter((f) => f.id !== selectedFieldId)); setSelectedFieldId(null); }}
                          title="Delete Field"
                          className="p-1.5 rounded-lg hover:bg-red-500/20 text-red-500/70 hover:text-red-500 transition-all"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => setSelectedFieldId(null)} className="p-1.5 rounded-lg hover:bg-white/10 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="p-5 space-y-5">

                      {/* Font Family */}
                      <div className="space-y-2">
                        <label className="text-[9px] font-black uppercase tracking-[0.2em] text-[var(--text-secondary)] opacity-60">Font</label>
                        <div className="grid grid-cols-4 gap-1.5">
                          {FONT_OPTIONS.map(f => (
                            <button
                              key={f.value}
                              onClick={() => updateField({ fontFamily: f.value })}
                              style={{ fontFamily: f.value }}
                              className={`py-2.5 rounded-xl border text-[10px] font-bold transition-all active:scale-95 ${
                                (selField.fontFamily || 'sans-serif') === f.value
                                  ? 'border-indigo-500 bg-indigo-500/15 text-indigo-300'
                                  : 'border-white/5 bg-black/30 text-[var(--text-secondary)] hover:border-white/20 hover:text-[var(--text-primary)]'
                              }`}
                            >
                              {f.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Font Size */}
                      <div className="space-y-2">
                        <label className="text-[9px] font-black uppercase tracking-[0.2em] text-[var(--text-secondary)] opacity-60">Font Size</label>
                        <div className="flex items-center space-x-2 bg-black/30 rounded-xl border border-white/5 p-1">
                          <button
                            onClick={() => updateField({ fontSize: Math.max(8, (selField.fontSize || 24) - 2) })}
                            className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-white/10 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <input
                            type="number"
                            min="8" max="200"
                            className="flex-1 bg-transparent text-center text-[var(--text-primary)] text-sm font-black outline-none"
                            value={selField.fontSize || 24}
                            onChange={(e) => updateField({ fontSize: parseInt(e.target.value) || 12 })}
                          />
                          <button
                            onClick={() => updateField({ fontSize: Math.min(200, (selField.fontSize || 24) + 2) })}
                            className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-white/10 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Style Toggles */}
                      <div className="space-y-2">
                        <label className="text-[9px] font-black uppercase tracking-[0.2em] text-[var(--text-secondary)] opacity-60">Style</label>
                        <div className="grid grid-cols-4 gap-1.5">
                          {[
                            { icon: <Bold className="w-3.5 h-3.5" />, label: 'Bold', active: selField.fontWeight === 'bold', action: () => updateField({ fontWeight: selField.fontWeight === 'bold' ? 'normal' : 'bold' }) },
                            { icon: <Italic className="w-3.5 h-3.5" />, label: 'Italic', active: selField.fontStyle === 'italic', action: () => updateField({ fontStyle: selField.fontStyle === 'italic' ? 'normal' : 'italic' }) },
                            { icon: <Underline className="w-3.5 h-3.5" />, label: 'Underline', active: selField.textDecoration === 'underline', action: () => updateField({ textDecoration: selField.textDecoration === 'underline' ? 'none' : 'underline' }) },
                            { icon: <span className="text-[9px] font-black">AA</span>, label: 'Caps', active: selField.textTransform === 'uppercase', action: () => updateField({ textTransform: selField.textTransform === 'uppercase' ? 'none' : 'uppercase' }) },
                          ].map(btn => (
                            <button
                              key={btn.label}
                              onClick={btn.action}
                              title={btn.label}
                              className={`py-2.5 rounded-xl border flex items-center justify-center transition-all active:scale-95 ${
                                btn.active
                                  ? 'border-indigo-500 bg-indigo-500/15 text-indigo-300'
                                  : 'border-white/5 bg-black/30 text-[var(--text-secondary)] hover:border-white/20 hover:text-[var(--text-primary)]'
                              }`}
                            >
                              {btn.icon}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Text Alignment */}
                      <div className="space-y-2">
                        <label className="text-[9px] font-black uppercase tracking-[0.2em] text-[var(--text-secondary)] opacity-60">Alignment</label>
                        <div className="grid grid-cols-3 gap-1.5">
                          {[
                            { icon: <AlignLeft className="w-3.5 h-3.5" />, value: 'left' },
                            { icon: <AlignCenter className="w-3.5 h-3.5" />, value: 'center' },
                            { icon: <AlignRight className="w-3.5 h-3.5" />, value: 'right' },
                          ].map(a => (
                            <button
                              key={a.value}
                              onClick={() => updateField({ textAlign: a.value })}
                              className={`py-2.5 rounded-xl border flex items-center justify-center transition-all active:scale-95 ${
                                (selField.textAlign || 'left') === a.value
                                  ? 'border-indigo-500 bg-indigo-500/15 text-indigo-300'
                                  : 'border-white/5 bg-black/30 text-[var(--text-secondary)] hover:border-white/20 hover:text-[var(--text-primary)]'
                              }`}
                            >
                              {a.icon}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Color Swatches */}
                      <div className="space-y-2">
                        <label className="text-[9px] font-black uppercase tracking-[0.2em] text-[var(--text-secondary)] opacity-60">Color</label>
                        <div className="grid grid-cols-8 gap-1.5">
                          {PRESET_COLORS.map(hex => (
                            <button
                              key={hex}
                              onClick={() => updateField({ color: hexToRgb(hex) })}
                              title={hex}
                              className={`w-full aspect-square rounded-lg border-2 transition-all active:scale-90 ${
                                rgbToHex(selField.color) === hex
                                  ? 'border-indigo-400 scale-110 shadow-lg shadow-indigo-500/30'
                                  : 'border-transparent hover:border-white/30'
                              }`}
                              style={{ backgroundColor: hex }}
                            />
                          ))}
                        </div>
                        {/* Custom color picker */}
                        <div className="flex items-center space-x-3 mt-2 bg-black/30 p-2.5 rounded-xl border border-white/5">
                          <label className="text-[9px] font-black uppercase tracking-widest text-[var(--text-secondary)] opacity-50 flex-1">Custom</label>
                          <input
                            type="color"
                            className="w-8 h-8 rounded-lg bg-transparent cursor-pointer border-2 border-white/10 p-0 overflow-hidden"
                            value={rgbToHex(selField.color)}
                            onChange={(e) => updateField({ color: hexToRgb(e.target.value) })}
                          />
                        </div>
                      </div>

                      {/* Extra info/actions can go here */}
                    </div>
                  </div>
                  );
                })()}
              </div>
            )}
          </div>
        </div>
      </div>
    )}

      {/* Canvas Area */}
      <div 
        ref={canvasContainerRef}
        className="flex-1 bg-[var(--bg-main)] opacity-95 p-12 overflow-auto relative custom-scrollbar flex items-center justify-center transition-colors duration-500"
      >
        {!imageUrl && (
          <div className="w-full max-w-2xl flex flex-col items-center justify-center text-center p-10 space-y-10 animate-fade-in-up">
            {excelData.length > 0 && (
              <div className="w-full p-6 bg-emerald-500/5 border border-emerald-500/20 rounded-3xl flex items-center space-x-4 text-left">
                <div className="w-10 h-10 bg-emerald-500/10 rounded-xl flex items-center justify-center shrink-0">
                  <Check className="w-5 h-5 text-emerald-400" />
                </div>
                <div>
                  <p className="text-sm font-black text-emerald-400">Data Loaded Successfully</p>
                  <p className="text-xs text-[var(--text-secondary)] opacity-70 mt-0.5">{excelData.length} records · {excelHeaders.length} columns imported</p>
                </div>
              </div>
            )}

            <div className="w-full p-8 border-2 border-dashed border-white/5 bg-white/[0.01] rounded-[3rem] group">
              <div className="w-24 h-24 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-6 border border-white/5 group-hover:scale-110 transition-transform duration-700">
                <ImageIcon className="w-10 h-10 text-[var(--text-secondary)] opacity-30" />
              </div>
              <h3 className="text-2xl font-black text-[var(--text-primary)] tracking-tighter mb-3">Upload Certificate Design</h3>
              <p className="text-[var(--text-secondary)] text-sm font-medium max-w-sm mx-auto mb-8">Use the <span className="text-indigo-400 font-black">"Upload Design"</span> button on the left panel to set your certificate background image (PNG or JPG).</p>
              <div className="flex items-center justify-center space-x-3 text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)] opacity-40">
                <span className="w-8 h-px bg-current" />
                <span>Step 1 of 3</span>
                <span className="w-8 h-px bg-current" />
              </div>
            </div>
          </div>
        )}

        {imageUrl && (
          <div 
            className="relative group/canvas transition-transform duration-300 ease-out origin-center"
            style={{ transform: `scale(${zoom})`, minWidth: imageSize.width, minHeight: imageSize.height }}
          >
              {/* Preview Status Overlay */}
              <div className="absolute -top-12 left-0 right-0 flex justify-between items-center px-4">
                 <div className="flex items-center space-x-4">
                    <div className="flex items-center space-x-2">
                       <div className="w-2 h-2 rounded-full bg-indigo-500 pulse" />
                       <span className="text-[10px] font-black text-[var(--text-primary)] uppercase tracking-widest opacity-60">
                         {isPreview ? 'Preview Mode' : 'Editor Active'} • {Math.round(zoom * 100)}%
                       </span>
                    </div>
                    {isPreview && (
                      <button 
                        onClick={toggleReview}
                        className="fixed bottom-12 right-12 z-[100] bg-black/95 hover:bg-black text-white px-12 py-6 rounded-[2rem] font-black text-sm uppercase tracking-[0.3em] shadow-[0_20px_50px_rgba(0,0,0,0.8)] flex items-center space-x-4 animate-bounce-in border flex-row border-white/10 transition-all hover:scale-105 active:scale-95 group"
                      >
                        <EyeOff className="w-6 h-6 group-hover:rotate-12 transition-transform text-indigo-400" />
                        <span>Exit Preview Mode</span>
                      </button>
                    )}
                 </div>
              </div>

             <div className="rounded-3xl overflow-hidden shadow-[0_0_100px_rgba(30,41,59,0.5)] border border-[var(--border-subtle)] bg-[var(--bg-main)]">
                <img
                  src={imageUrl}
                  alt="Template"
                  ref={imgRef}
                  onLoad={(e) => { setImgError(false); handleImageLoad(e); }}
                  onError={() => setImgError(true)}
                  crossOrigin="anonymous"
                  className={`max-w-none block ${imgError ? 'opacity-20 grayscale' : ''}`}
                  draggable={false}
                />

                {imgError && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 backdrop-blur-sm p-10 text-center">
                    <div className="w-16 h-16 bg-red-500/10 rounded-2xl flex items-center justify-center mb-4 border border-red-500/20">
                      <XCircle className="w-8 h-8 text-red-500" />
                    </div>
                    <h3 className="text-lg font-black text-white mb-2 uppercase tracking-tight">Image Load Failed</h3>
                    <p className="text-zinc-400 text-xs max-w-xs mb-6 font-medium">We couldn't reach the background image. Please try re-uploading.</p>
                    <label htmlFor="bg-re-upload" className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest cursor-pointer transition-all active:scale-95 shadow-xl shadow-indigo-600/20">
                       Select New Background
                    </label>
                    <input type="file" id="bg-re-upload" className="hidden" accept="image/*" onChange={handleImageUpload} />
                  </div>
                )}

                {fields.map((f, i) => {
                  if (f.key === "certificateId" && !showId) return null;
                  return (
                    <Rnd
                      key={f.id}
                      size={{ width: f.width, height: f.height }}
                      position={{ x: f.x, y: f.y }}
                      scale={zoom}
                      bounds="parent"
                      onDragStart={() => setSelectedFieldId(f.id)}
                      onDragStop={(e, d) => {
                        const newFields = [...fields];
                        newFields[i] = { ...f, x: d.x, y: d.y };
                        setFields(newFields);
                        setSelectedFieldId(f.id);
                      }}
                      onResizeStop={(e, dir, ref, delta, pos) => {
                        const newFields = [...fields];
                        newFields[i] = { ...f, width: ref.offsetWidth, height: ref.offsetHeight, ...pos };
                        setFields(newFields);
                        setSelectedFieldId(f.id);
                      }}
                      className={`group/field border-2 flex items-center px-4 cursor-move transition-all ${selectedFieldId === f.id ? "border-indigo-400 bg-indigo-600/10 shadow-[0_0_30px_rgba(79,70,229,0.2)]" : "border-indigo-500/10 hover:border-indigo-500/40 bg-white/[0.02]"}`}
                    >
                      <div className="absolute -top-8 left-0 flex items-center space-x-1 opacity-0 group-hover/field:opacity-100 transition-opacity z-20">
                        <div className="text-[9px] font-black text-indigo-400 bg-black/80 px-3 py-1.5 rounded-lg border border-indigo-500/20 whitespace-nowrap shadow-2xl">
                          {f.key} • {f.fontSize}px
                        </div>
                        <button 
                          onClick={(e) => { e.stopPropagation(); setFields(fields.filter(field => field.id !== f.id)); setSelectedFieldId(null); }}
                          className="p-1.5 bg-red-600 text-white rounded-lg shadow-xl hover:bg-red-500 transition-all active:scale-90"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                      <span
                        onClick={() => setSelectedFieldId(f.id)}
                        className="select-none pointer-events-none w-full block"
                        style={{
                          fontSize: `${f.fontSize}px`,
                          color: `rgb(${f.color.r},${f.color.g},${f.color.b})`,
                          fontWeight: f.fontWeight || 'normal',
                          fontStyle: f.fontStyle || 'normal',
                          textDecoration: f.textDecoration || 'none',
                          textTransform: f.textTransform || 'none',
                          textAlign: f.textAlign || 'left',
                          fontFamily: f.fontFamily || 'sans-serif',
                          lineHeight: 1.2,
                        }}
                       >
                         {/* Display logic: staticValue (typed text) > [KEY] (column tag) */}
                        {f.staticValue || `[${f.key}]`}
                      </span>
                    </Rnd>
                  );
                })}

                {qrCode && showQr && (
                  <Rnd
                    size={{ width: qrCode.width, height: qrCode.height }}
                    position={{ x: qrCode.x, y: qrCode.y }}
                    scale={zoom}
                    lockAspectRatio={true}
                    bounds="parent"
                    onDragStop={(e, d) => setQrCode({ ...qrCode, x: d.x, y: d.y })}
                    onResizeStop={(e, dir, ref, delta, pos) => {
                      setQrCode({ 
                        ...qrCode, 
                        width: ref.offsetWidth, 
                        height: ref.offsetHeight, 
                        ...pos 
                      });
                    }}
                    className="group border-2 border-emerald-500/30 hover:border-emerald-500 bg-emerald-500/5 flex flex-col items-center justify-center cursor-move transition-all z-10"
                  >
                     <div className="absolute -top-8 left-0 flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity z-20">
                        <div className="text-[9px] font-black text-emerald-400 bg-black/80 px-3 py-1.5 rounded-lg border border-emerald-500/20 whitespace-nowrap shadow-2xl">
                          Verification QR Code
                        </div>
                        <button 
                          onClick={(e) => { e.stopPropagation(); setQrCode(null); setShowQr(false); }}
                          className="p-1.5 bg-red-600 text-white rounded-lg shadow-xl hover:bg-red-500 transition-all active:scale-90"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                     <ImageIcon className="w-6 h-6 text-emerald-500/30 mb-1" />
                     <span className="text-[10px] font-black text-emerald-500/50 uppercase tracking-widest pointer-events-none">Global QR</span>
                  </Rnd>
                )}
             </div>
          </div>
        )}
      </div>

      {/* Generation Portal - Modal Overlays */}
      {(saving === true || saving === "done" || saving === "generating" || saving === "sending" || saving === "done_all" || saving === "auto_success") && (
        <div className="fixed inset-0 bg-[var(--bg-main)]/95 z-[100] flex items-center justify-center p-6 backdrop-blur-3xl animate-fade-in">
           <div className="glass rounded-[3.5rem] w-full max-w-2xl overflow-hidden shadow-[0_0_100px_rgba(0,0,0,0.4)] border border-white/10">
              
               {saving === true ? (
                 <div className="p-32 flex flex-col items-center justify-center text-center space-y-8">
                   <div className="relative">
                      <div className="absolute inset-0 bg-indigo-500/20 rounded-full blur-2xl animate-pulse" />
                      <Loader2 className="w-16 h-16 text-indigo-500 animate-spin relative z-10" />
                   </div>
                   <div>
                      <h1 className="text-3xl font-black text-[var(--text-primary)] tracking-tighter mb-2">Saving Template</h1>
                      <p className="text-[var(--text-secondary)] text-sm font-black uppercase tracking-[0.2em] opacity-50">Please wait...</p>
                   </div>
                </div>
              ) : saving === "auto_success" ? (
                <div className="p-32 flex flex-col items-center justify-center text-center space-y-8 animate-fade-in-up">
                   <div className="relative">
                      <div className="absolute inset-0 bg-emerald-500/20 rounded-full blur-2xl pulse" />
                      <div className="w-16 h-16 bg-emerald-600 rounded-full flex items-center justify-center relative z-10 shadow-xl shadow-emerald-500/20">
                         <Zap className="w-8 h-8 text-white animate-bounce" />
                      </div>
                   </div>
                   <div>
                      <h1 className="text-4xl font-black text-emerald-400 tracking-tighter mb-2">Auto-Cert Live!</h1>
                      <p className="text-[var(--text-secondary)] text-sm font-black uppercase tracking-[0.2em] opacity-50">Launching Operational Dashboard...</p>
                   </div>
                </div>
              ) : saving === "done_all" ? (
                <div className="animate-fade-in-up">
                   <div className="p-10 border-b border-white/5 flex justify-between items-center bg-white/5">
                      <div>
                         <h1 className="text-3xl font-black text-[var(--text-primary)] tracking-tighter mb-1">Process Finalized</h1>
                         <p className="text-xs text-[var(--text-secondary)] opacity-50 font-black uppercase tracking-[0.2em]">Deployment Success • <span className="text-emerald-400">Authenticated</span></p>
                      </div>
                      <div className="p-4 bg-emerald-500/10 rounded-2xl text-emerald-500 border border-emerald-500/20">
                         <Check className="w-6 h-6" />
                      </div>
                   </div>
                   
                   <div className="p-12 space-y-12">
                      <div className="grid grid-cols-2 gap-8">
                         <div className="bg-black/40 rounded-[2.5rem] p-10 border border-white/5 text-center group hover:border-indigo-500/30 transition-colors">
                            <span className="block text-[10px] font-black text-[var(--text-secondary)] opacity-50 uppercase tracking-widest mb-4">Total Generated</span>
                            <span className="text-6xl font-black text-[var(--text-primary)] tracking-tighter">{genData.count}</span>
                         </div>
                         <div className="bg-black/40 rounded-[2.5rem] p-10 border border-white/5 text-center group hover:border-red-500/30 transition-colors">
                            <span className="block text-[10px] font-black text-[var(--text-secondary)] opacity-50 uppercase tracking-widest mb-4">Duplicates Omitted</span>
                            <span className="text-6xl font-black text-[var(--text-primary)] tracking-tighter opacity-20">{genData.skipped}</span>
                         </div>
                      </div>
                      
                      <button
                        onClick={() => navigate("/?tab=managed")}
                        className="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-6 rounded-[2rem] text-xs font-black uppercase tracking-[0.3em] transition-all shadow-2xl shadow-indigo-600/30 active:scale-95 flex items-center justify-center space-x-4 group"
                      >
                         <span>Access Operational Dashboard</span>
                         <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                      </button>
                   </div>
                </div>
              ) : (
                <div className="animate-fade-in-up">
                   <div className="p-10 border-b border-white/5 flex justify-between items-center bg-white/5">
                      <div>
                         <h1 className="text-3xl font-black text-[var(--text-primary)] tracking-tighter mb-1">Send Certificates</h1>
                         <div className="flex items-center space-x-2 mt-2">
                           <span className="text-[10px] text-[var(--text-secondary)] font-black uppercase tracking-[0.2em] opacity-50">Batch ID:</span>
                           <input
                             type="text"
                             className="bg-transparent border-b border-indigo-500/30 text-indigo-400 text-xs font-black uppercase tracking-[0.1em] focus:outline-none focus:border-indigo-500 transition-all w-64 placeholder:text-indigo-400/30"
                             value={batchName}
                             onChange={(e) => setBatchName(e.target.value)}
                             placeholder="Enter custom batch name..."
                           />
                         </div>
                      </div>
                      <button onClick={() => setSaving(false)} className="p-4 bg-white/5 hover:bg-white/10 rounded-2xl text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-white/5 transition-all outline-none">
                         <X className="w-6 h-6" />
                      </button>
                   </div>

                   <div className="p-10 space-y-10 max-h-[60vh] overflow-y-auto custom-scrollbar">
                      {/* Mapping Section */}
                      <div className="space-y-6">
                         <div className="flex items-center space-x-3 mb-2">
                           <Settings className="w-5 h-5 text-indigo-400" />
                           <h3 className="text-sm font-black text-[var(--text-primary)] uppercase tracking-widest">Map Fields</h3>
                         </div>
                         <div className="grid grid-cols-2 gap-6">
                            <div className="space-y-3 text-left">
                               <span className="text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)] ml-1 opacity-50">Recipient Name Column</span>
                               <select
                                 className="w-full bg-black/40 border border-white/5 rounded-2xl p-4 text-[var(--text-primary)] text-sm focus:border-indigo-500 appearance-none cursor-pointer"
                                 value={selection["name"] || ""}
                                 onChange={(e) => setSelection({ ...selection, name: e.target.value })}
                               >
                                 <option value="">Select Target...</option>
                                 {excelHeaders.map((h) => (<option key={h} value={h}>{h}</option>))}
                               </select>
                            </div>
                            <div className="space-y-3 text-left">
                               <span className="text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)] ml-1 opacity-50">Recipient Email Column</span>
                               <select
                                 className="w-full bg-black/40 border border-white/5 rounded-2xl p-4 text-[var(--text-primary)] text-sm focus:border-indigo-500 appearance-none cursor-pointer"
                                 value={selection["email"] || ""}
                                 onChange={(e) => setSelection({ ...selection, email: e.target.value })}
                               >
                                 <option value="">Select Channel...</option>
                                 {excelHeaders.map((h) => (<option key={h} value={h}>{h}</option>))}
                               </select>
                            </div>
                         </div>
                      </div>

                      {/* Email Config */}
                      <div className="space-y-6 p-8 bg-black/40 border border-white/5 rounded-[2.5rem]">
                         <div className="flex items-center space-x-3 mb-4">
                           <Mail className="w-5 h-5 text-indigo-400" />
                           <h3 className="text-sm font-black text-[var(--text-primary)] uppercase tracking-widest">Email Content</h3>
                         </div>
                         <div className="space-y-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                              <div className="space-y-2 text-left">
                                <span className="text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)] ml-1 opacity-50">Sender Name</span>
                                <input
                                  type="text"
                                  className="w-full bg-white/5 border border-white/5 rounded-2xl py-4 px-6 text-sm text-[var(--text-primary)] focus:outline-none focus:border-indigo-500 transition-all font-medium placeholder:text-[var(--text-secondary)] opacity-50"
                                  placeholder="Sender Name..."
                                  value={emailConfig.senderName}
                                  onChange={(e) => setEmailConfig({ ...emailConfig, senderName: e.target.value })}
                                />
                              </div>
                              <div className="space-y-2 text-left">
                                <span className="text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)] ml-1 opacity-50">Sender Email</span>
                                <input
                                  type="email"
                                  className="w-full bg-white/5 border border-white/5 rounded-2xl py-4 px-6 text-sm text-[var(--text-primary)] focus:outline-none focus:border-indigo-500 transition-all font-medium placeholder:text-[var(--text-secondary)] opacity-50"
                                  placeholder="Sender Email..."
                                  value={emailConfig.senderEmail}
                                  onChange={(e) => setEmailConfig({ ...emailConfig, senderEmail: e.target.value })}
                                />
                              </div>
                            </div>
                            <div className="space-y-2 text-left">
                              <span className="text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)] ml-1 opacity-50">Subject</span>
                              <input
                                type="text"
                                className="w-full bg-white/5 border border-white/5 rounded-2xl py-4 px-6 text-sm text-[var(--text-primary)] focus:outline-none focus:border-indigo-500 transition-all font-medium placeholder:text-[var(--text-secondary)] opacity-50"
                                placeholder="Email Subject..."
                                value={emailConfig.subject}
                                onChange={(e) => setEmailConfig({ ...emailConfig, subject: e.target.value })}
                              />
                            </div>
                            <div className="space-y-2 text-left">
                              <span className="text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)] ml-1 opacity-50">Message Body</span>
                              <textarea
                                className="w-full bg-white/5 border border-white/5 rounded-2xl py-4 px-6 text-sm text-[var(--text-primary)] h-32 resize-none focus:outline-none focus:border-indigo-500 transition-all font-medium placeholder:text-[var(--text-secondary)] opacity-50"
                                placeholder="Email Message..."
                                value={emailConfig.message}
                                onChange={(e) => setEmailConfig({ ...emailConfig, message: e.target.value })}
                              />
                            </div>
                         </div>
                      </div>

                      <div className="flex flex-col space-y-4 pt-6">
                         <button
                           onClick={() => {
                             if (!selection.name || !selection.email) {
                               alert("Please select both a Name and Email column from your spreadsheet.");
                               return;
                             }
                             handleGenerateAndEmail(true);
                           }}
                           disabled={saving === "generating" || saving === "sending"}
                           className="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-6 rounded-[2rem] text-xs font-black uppercase tracking-[0.3em] transition-all shadow-2xl shadow-indigo-600/30 active:scale-95 group flex items-center justify-center space-x-4"
                         >
                           {saving === "sending" ? <Loader2 className="w-5 h-5 animate-spin" /> : <Mail className="w-5 h-5" />}
                           <span>Generate & Send Emails</span>
                         </button>
                         <button
                           onClick={() => handleGenerateAndEmail(false)}
                           disabled={saving === "generating" || saving === "sending"}
                           className="w-full bg-white/5 hover:bg-white/10 text-[var(--text-secondary)] hover:text-[var(--text-primary)] py-6 rounded-[2rem] text-xs font-black uppercase tracking-[0.3em] transition-all border border-white/5 active:scale-95"
                         >
                           {saving === "generating" ? "Processing..." : "Generate Without Emailing"}
                         </button>
                         
                         {/* Trigger auto cert logic, which uses standard modal states */}
                         <button
                           onClick={() => {
                             if (!selection.name || !selection.email) {
                               alert("Please map both Name and Email columns before activating Auto-Cert.");
                               return;
                             }
                             
                             // Close modal so user can see the sidebar auto-cert panel
                             setSaving("done"); 
                             
                             setAutoNameCol(selection.name);
                             setAutoEmailCol(selection.email);
                             
                             // Immediately call activation so it processes
                             
                             setTimeout(() => {
                               
                               handleActivateAutoCert(selection.name, selection.email);
                             }, 100);
                           }}
                           disabled={saving === "generating" || saving === "sending" || !passedSheetUrl}
                           className="w-full bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-500 py-6 rounded-[2rem] text-xs font-black uppercase tracking-[0.3em] transition-all border border-emerald-500/20 active:scale-95 flex justify-center items-center gap-2"
                         >
                           <Zap className="w-4 h-4" /> Activate Auto-Cert
                         </button>
                      </div>
                   </div>
                </div>
              )}
           </div>
        </div>
      )}
    </div>
  );
}
