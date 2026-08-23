// Centralized API configuration — All requests go to the Express backend (Render)
// Firebase Firestore + Cloudinary handles storage. Express handles all logic.

export const API_BASE = import.meta.env.VITE_BACKEND_URL || 'https://certificate-generation-8gbo.onrender.com';

// IO_API_BASE kept as alias for backward compatibility with existing page components
export const IO_API_BASE = API_BASE;
