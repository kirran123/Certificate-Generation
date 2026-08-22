// Centralized API configuration
// API_BASE: Convex HTTP Base URL for Auth & lightweight DB queries
export const API_BASE = import.meta.env.VITE_CONVEX_URL || import.meta.env.VITE_API_URL || 'https://hearty-blackbird-795.convex.site';

// IO_API_BASE: Render Node.js Backend for Heavy IO (PDF Generation, ZIP downloads, 5-Brevo Key Bulk Mail dispatching, Excel parsing)
export const IO_API_BASE = import.meta.env.VITE_BACKEND_URL || 'https://certificate-generation-8gbo.onrender.com';
