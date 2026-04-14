import { useState, useEffect } from 'react';
import axios from 'axios';
import { API_BASE } from '../apiConfig';
import { Search, CheckCircle, XCircle, Camera, X, Upload, Download, Loader2, MessageSquare, Send } from 'lucide-react';
import { useParams, useNavigate } from 'react-router-dom';
import { Html5QrcodeScanner, Html5Qrcode } from 'html5-qrcode';
import Footer from '../components/Footer';

export default function VerifyPortal() {
  const { id: paramId } = useParams();
  const navigate = useNavigate();

  const [certId, setCertId] = useState('');
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [isScanning, setIsScanning] = useState(false);



  // If accessed via QR URL directly, verify immediately
  useEffect(() => {
    if (paramId) {
      setCertId(paramId);
      verifyCertificate(paramId);
    }
  }, [paramId]);

  useEffect(() => {
    let scanner = null;
    if (isScanning) {
      scanner = new Html5QrcodeScanner(
        "qr-reader",
        { fps: 10, qrbox: { width: 250, height: 250 } },
        false
      );

      scanner.render((decodedText) => {
        setIsScanning(false);
        scanner.clear();
        
        // QR text is like "http://localhost:5173/verify/CERT123..."
        let extractedId = decodedText;
        if (decodedText.includes('/verify/')) {
          extractedId = decodedText.split('/verify/')[1];
        }
        
        setCertId(extractedId);
        verifyCertificate(extractedId);
      }, (err) => {
        // silently ignore read errors
      });
    }

    return () => {
      if (scanner) {
        scanner.clear().catch(e => console.error("Failed to clear scanner", e));
      }
    };
  }, [isScanning]);

  const handleImageUpload = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      setResult(null);
      setError('');
      const file = e.target.files[0];
      const html5QrCode = new Html5Qrcode("qr-reader-hidden");
      
      html5QrCode.scanFile(file, true)
        .then(decodedText => {
          let extractedId = decodedText;
          if (decodedText.includes('/verify/')) {
            extractedId = decodedText.split('/verify/')[1];
          }
          setCertId(extractedId);
          verifyCertificate(extractedId);
        })
        .catch(err => {
          setError('No QR code found in the image or it could not be read.');
        });
    }
  };

  const verifyCertificate = async (idToVerify) => {
    const id = idToVerify || certId;
    if (!id) return;
    
    setLoading(true);
    setError('');
    setResult(null);

    // Update URL without reloading if user manually searched
    if (!paramId && idToVerify !== paramId) {
       navigate(`/verify/${id}`, { replace: true });
    }

    try {
      const res = await axios.get(`${API_BASE}/api/verify/${id}`);
      setResult(res.data.certificate);
    } catch (err) {
      setError('Certificate not found or invalid');
    } finally {
      setLoading(false);
    }
  };



  return (
    <>
    <div className="min-h-screen relative flex flex-col items-center justify-center p-6 overflow-hidden">
      {/* Dynamic Background Elements */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-indigo-500/10 rounded-full blur-[120px] animate-pulse" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-purple-500/10 rounded-full blur-[120px] animate-pulse" />

      <div className="max-w-3xl w-full relative z-10 animate-fade-in-up">
        <div className="text-center mb-16">
          <div className="inline-flex items-center space-x-2 text-indigo-400 text-[10px] font-black uppercase tracking-[0.3em] mb-4 bg-indigo-500/5 px-4 py-1.5 rounded-full border border-indigo-500/10">
            <CheckCircle className="w-3.5 h-3.5" />
            <span>Secure Verification</span>
          </div>
          <h1 className="text-5xl font-black text-[var(--text-primary)] tracking-tighter leading-none mb-4">Verify Certificate</h1>
          <p className="text-[var(--text-secondary)] text-lg font-medium max-w-lg mx-auto">Check if a certificate is real and valid by entering its ID or scanning the QR code.</p>
        </div>

        <div className="glass rounded-[3.5rem] p-12 shadow-2xl border border-[var(--border-subtle)] relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-all duration-1000">
             <Search className="w-48 h-48 text-indigo-400" />
          </div>

          {!isScanning ? (
            <div className="space-y-10">
              <div className="relative group/input">
                <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-6 h-6 text-[var(--text-secondary)] opacity-50 group-focus-within/input:text-indigo-400 transition-colors" />
                <input
                  type="text"
                  placeholder="Enter Certificate ID..."
                  className="w-full bg-black/40 border border-white/5 rounded-[2rem] py-6 pl-16 pr-8 text-lg text-[var(--text-primary)] focus:outline-none focus:border-indigo-500 focus:bg-black/60 transition-all font-medium placeholder:text-[var(--text-secondary)]"
                  value={certId}
                  onChange={(e) => setCertId(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && verifyCertificate()}
                />
              </div>
              
              <div className="flex items-center">
                <div className="flex-1 h-px bg-white/5"></div>
                <span className="mx-8 text-[10px] font-black text-[var(--text-secondary)] opacity-30 uppercase tracking-[0.5em]">OR</span>
                <div className="flex-1 h-px bg-white/5"></div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <button
                  onClick={() => { setResult(null); setError(''); setIsScanning(true); }}
                  className="group flex flex-col items-center justify-center space-y-4 p-10 bg-white/2 hover:bg-white/5 border border-white/5 rounded-[2.5rem] transition-all duration-500 hover:border-indigo-500/30 active:scale-95"
                >
                  <div className="w-16 h-16 bg-indigo-600/10 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform duration-500">
                     <Camera className="w-8 h-8 text-indigo-400" />
                  </div>
                   <div className="text-center">
                    <p className="text-sm font-black text-[var(--text-primary)] uppercase tracking-widest leading-none mb-1">Scan QR Code</p>
                    <p className="text-[10px] text-[var(--text-secondary)] font-bold uppercase tracking-tight opacity-70">Scan with Camera</p>
                  </div>
                </button>

                <label className="group flex flex-col items-center justify-center space-y-4 p-10 bg-white/2 hover:bg-white/5 border border-white/5 rounded-[2.5rem] transition-all duration-500 hover:border-indigo-500/30 active:scale-95 cursor-pointer">
                  <div className="w-16 h-16 bg-purple-600/10 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform duration-500">
                     <Upload className="w-8 h-8 text-purple-400" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-black text-[var(--text-primary)] uppercase tracking-widest leading-none mb-1">Upload QR Image</p>
                    <p className="text-[10px] text-[var(--text-secondary)] font-bold uppercase tracking-tight opacity-70">Upload an image of the QR</p>
                  </div>
                  <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} />
                </label>
              </div>

              <button
                onClick={() => verifyCertificate()}
                disabled={loading || !certId}
                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-6 rounded-[2rem] text-xs font-black uppercase tracking-[0.3em] transition-all shadow-2xl shadow-indigo-600/30 disabled:opacity-0 active:scale-95 flex items-center justify-center space-x-3"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />}
                <span>{loading ? 'Verifying...' : 'Verify'}</span>
              </button>
            </div>
          ) : (
             <div className="animate-fade-in">
                 <div className="flex justify-between items-center mb-10">
                   <div>
                      <h2 className="text-2xl font-black text-[var(--text-primary)] tracking-tighter">Scanning...</h2>
                      <p className="text-[10px] text-[var(--text-secondary)] font-black uppercase tracking-widest mt-1 opacity-70">Point camera at the QR code</p>
                   </div>
                   <button onClick={() => setIsScanning(false)} className="p-4 bg-white/5 hover:bg-white/10 rounded-2xl text-zinc-500 hover:text-white border border-white/5 transition-all outline-none">
                      <X className="w-6 h-6" />
                   </button>
                </div>
                <div id="qr-reader" className="w-full bg-black/40 rounded-[2rem] overflow-hidden border border-white/5 animate-pulse-slow"></div>
                <div className="mt-8 text-center">
                   <p className="text-[10px] text-[var(--text-secondary)] font-black uppercase tracking-[0.4em] opacity-30">Waiting for QR Code...</p>
                </div>
             </div>
          )}

          {error && (
            <div className="mt-10 bg-red-500/5 border border-red-500/20 p-12 rounded-[2.5rem] flex flex-col items-center text-center animate-shake">
              <XCircle className="w-20 h-20 text-red-500 mb-6" />
              <h1 className="text-2xl font-black text-[var(--text-primary)] mb-2 tracking-tighter uppercase tracking-widest">Verification Failed</h1>
              <p className="text-red-400 font-medium">{error}</p>
            </div>
          )}

          {result && (
            <div className="mt-10 bg-emerald-500/5 border border-emerald-500/20 p-12 rounded-[2.5rem] text-center animate-fade-in-up">
              <div className="w-24 h-24 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto mb-8 animate-bounce-subtle">
                 <CheckCircle className="w-12 h-12 text-emerald-500 shadow-xl shadow-emerald-500/20" />
              </div>
              <h1 className="text-3xl font-black text-[var(--text-primary)] mb-8 tracking-tighter uppercase tracking-widest">Certificate Verified</h1>
              
               <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-left mb-10">
                <div className="bg-black/40 rounded-3xl p-6 border border-[var(--border-subtle)] group hover:border-indigo-500/30 transition-colors">
                  <span className="text-[10px] text-[var(--text-secondary)] font-black uppercase tracking-widest block mb-2 opacity-50">Awarded To</span>
                  <span className="text-[var(--text-primary)] font-black tracking-tight text-lg">{result.name}</span>
                </div>
                <div className="bg-black/40 rounded-3xl p-6 border border-[var(--border-subtle)] group hover:border-indigo-500/30 transition-colors">
                  <span className="text-[10px] text-[var(--text-secondary)] font-black uppercase tracking-widest block mb-2 opacity-50">Course/Event</span>
                  <span className="text-[var(--text-primary)] font-black tracking-tight text-lg">{result.course || 'Achievement'}</span>
                </div>
                <div className="bg-black/40 rounded-3xl p-6 border border-[var(--border-subtle)] group hover:border-indigo-500/30 transition-colors">
                  <span className="text-[10px] text-[var(--text-secondary)] font-black uppercase tracking-widest block mb-2 opacity-50">Date Issued</span>
                  <span className="text-[var(--text-primary)] font-black tracking-tight text-lg">{new Date(result.date).toLocaleDateString()}</span>
                </div>
                <div className="bg-black/40 rounded-3xl p-6 border border-[var(--border-subtle)] group hover:border-indigo-500/30 transition-colors">
                  <span className="text-[10px] text-[var(--text-secondary)] font-black uppercase tracking-widest block mb-1 opacity-50">Certificate ID</span>
                  <span className="text-indigo-400 font-mono text-xs font-black uppercase">{result.certificateId}</span>
                </div>
              </div>

              {result && (
                <a
                  href={`${API_BASE}/api/certificate/download/${result.certificateId}`}
                  download
                  className="inline-flex items-center space-x-3 bg-white/5 hover:bg-white/10 border border-[var(--border-subtle)] text-[var(--text-primary)] px-10 py-5 rounded-[2rem] text-[10px] font-black uppercase tracking-[0.2em] transition-all active:scale-95"
                >
                  <Download className="w-4.5 h-4.5" />
                  <span>View Certificate</span>
                </a>
              )}
            </div>
          )}
        </div>

      </div>
    </div>
    <div id="qr-reader-hidden" style={{ display: 'none' }}></div>
    <Footer />
    </>
  );
}
