// Centralized API configuration to handle localhost port shifts
export const getApiBase = () => {
  // If we are on localhost, always target the backend at port 5000
  // Robust detection for local dev environments
  if (
    window.location.hostname === 'localhost' || 
    window.location.hostname === '127.0.0.1' || 
    window.location.port === '5173'
  ) {
    return 'http://localhost:5000';
  }
  // For production, assume backend is at the same origin but possibly a different subdomain or just use origin
  return window.location.origin;
};

export const API_BASE = getApiBase();
