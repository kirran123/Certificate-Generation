// Centralized API configuration
// In production, set the VITE_API_BASE_URL env var in your Render/hosting dashboard
// to point to your backend service (e.g. https://digicertify-backend.onrender.com)
export const API_BASE =
  import.meta.env.VITE_API_BASE_URL ||
  (typeof window !== 'undefined' &&
    (window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1')
    ? 'http://localhost:5000'
    : '');
