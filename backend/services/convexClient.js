const axios = require('axios');

/**
 * Convex Client helper for Express backend (Render)
 * Makes lightweight HTTP requests to Convex to read DB metadata and write records.
 */

function getConvexSiteUrl() {
  return process.env.CONVEX_SITE_URL || process.env.VITE_CONVEX_SITE_URL || 'https://hearty-blackbird-795.convex.site';
}

/**
 * Helper to execute an HTTP query/action against Convex
 */
async function callConvex(path, method = 'GET', data = null, headers = {}) {
  const baseUrl = getConvexSiteUrl();
  const url = `${baseUrl}${path.startsWith('/') ? path : '/' + path}`;

  const requestConfig = {
    method,
    url,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
  };

  if (data && (method === 'POST' || method === 'PATCH' || method === 'PUT')) {
    requestConfig.data = data;
  }

  try {
    const response = await axios(requestConfig);
    return response.data;
  } catch (err) {
    const errMsg = err.response && err.response.data && err.response.data.message
      ? err.response.data.message
      : err.message;
    console.error(`[Convex Client Error] ${method} ${path}:`, errMsg);
    throw new Error(errMsg);
  }
}

/**
 * Get Template metadata by ID
 */
async function getTemplate(templateId, authHeader) {
  return callConvex(`/api/template/${templateId}`, 'GET', null, {
    Authorization: authHeader,
  });
}

/**
 * Get User's certificate generations
 */
async function getMyGenerations(authHeader) {
  return callConvex('/api/certificate/my-generations', 'GET', null, {
    Authorization: authHeader,
  });
}

/**
 * Download single cert metadata / check cert existence
 */
async function getCertById(certId) {
  return callConvex(`/api/certificate/download/${certId}`, 'GET');
}

module.exports = {
  getConvexSiteUrl,
  callConvex,
  getTemplate,
  getMyGenerations,
  getCertById,
};
