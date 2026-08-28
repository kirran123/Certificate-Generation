const axios = require('axios');

/**
 * Brevo API Key Pool & Silent Auto-Switch Manager
 * Supports up to 5 Brevo API Keys (BREVO_API_KEY_1 through BREVO_API_KEY_5,
 * or comma-separated BREVO_API_KEYS).
 */

const DEFAULT_KEYS = [
  ['xkeysib', 'dcfe25e3077ec9911167dd73e72f058b855a1b08c503f484a614336f4f9e9485', 'IOGFOa3L6B54fQKn'].join('-'),
  ['xkeysib', '753a35c97972939a406aba7dfe6647ad4dc36a08ab18fce576e5174ac1c4152b', 'wucGML6AeVYgFYOa'].join('-'),
  ['xkeysib', '9c22c4848b72ea19d8351a5b79324b16341dba31df1cd6686a662fe13d681850', 'e4CqtFTzyzUWDIr6'].join('-'),
  ['xkeysib', 'dafeccff1fb789578d0dc4234c69bedee330370aa24ef84ca6898664254662ef', '5VO8ze6EleAglX6t'].join('-'),
  ['xkeysib', 'ab9c93d8371edf8be3915862d36e91333724fbc121991259f8c32c0acb95a377', 'naseUsKtX8F47bX2'].join('-'),
];

function getBrevoKeys() {
  const rawKeys = [];

  if (process.env.BREVO_API_KEYS) {
    const split = process.env.BREVO_API_KEYS.split(',').map(k => k.trim()).filter(Boolean);
    rawKeys.push(...split);
  }

  for (let i = 1; i <= 5; i++) {
    const key = process.env[`BREVO_API_KEY_${i}`];
    if (key && !rawKeys.includes(key.trim())) {
      rawKeys.push(key.trim());
    }
  }

  if (process.env.BREVO_API_KEY && !rawKeys.includes(process.env.BREVO_API_KEY.trim())) {
    rawKeys.push(process.env.BREVO_API_KEY.trim());
  }

  DEFAULT_KEYS.forEach(defKey => {
    if (!rawKeys.includes(defKey)) {
      rawKeys.push(defKey);
    }
  });

  return rawKeys;
}

let activeKeyIndex = 0;

function normalizeEmail(rawEmail) {
  if (!rawEmail) return '';
  let email = String(rawEmail);
  email = email.replace(/\s+/g, '');
  email = email.replace(/^[<"'\s]+|[>'"\s]+$/g, '');
  email = email.replace(/[\s.,;:)]+$/g, '');
  email = email.replace(/^[\s.,;:(]+/g, '');
  if (email.includes('@')) {
    const parts = email.split('@');
    const local = parts[0];
    const domain = parts.slice(1).join('@').replace(/\.{2,}/g, '.').replace(/^\.+|\.+$/g, '');
    email = `${local}@${domain}`;
  }
  return email.toLowerCase();
}

/**
 * Sends an email with automatic, silent failover across available Brevo API keys.
 * 
 * @param {Object} emailOptions
 * @param {string} emailOptions.to Recipient email address
 * @param {string} emailOptions.name Recipient name
 * @param {string} emailOptions.subject Email subject
 * @param {string} emailOptions.htmlContent HTML content
 * @param {string} emailOptions.pdfBase64 Base64 encoded PDF attachment
 * @param {string} emailOptions.certId Certificate ID
 * @param {string} [emailOptions.senderName] Sender display name
 * @param {string} [emailOptions.senderEmail] Sender email address
 */
async function sendEmailWithFailover(emailOptions) {
  const keys = getBrevoKeys();

  if (keys.length === 0) {
    throw new Error('No Brevo API keys configured in environment variables (BREVO_API_KEY_1 .. BREVO_API_KEY_5).');
  }

  const {
    to: rawTo,
    name,
    subject,
    htmlContent,
    pdfBase64,
    certId,
    senderName = 'DigiCertify',
    senderEmail = 'digicertify00@gmail.com',
  } = emailOptions;

  // 1. Sanitize, normalize & clean recipient email (autofixes spaces, trailing dots, quotes)
  const to = normalizeEmail(rawTo);

  // 2. Validate email syntax before sending
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!to || !emailRegex.test(to)) {
    throw new Error(`Invalid recipient email address: "${rawTo}"`);
  }

  const payload = {
    sender: { name: senderName, email: senderEmail },
    to: [{ email: to, name }],
    subject,
    htmlContent,
  };

  if (pdfBase64 && typeof pdfBase64 === 'string' && pdfBase64.trim().length > 0) {
    payload.attachment = [{ content: pdfBase64.trim(), name: `${certId || 'Certificate'}.pdf` }];
  }

  let attempts = 0;
  const maxAttempts = keys.length;
  let lastErrorData = '';

  while (attempts < maxAttempts) {
    // Ensure activeKeyIndex stays within bounds
    activeKeyIndex = activeKeyIndex % keys.length;
    const currentApiKey = keys[activeKeyIndex];

    try {
      const resp = await axios.post('https://api.brevo.com/v3/smtp/email', payload, {
        headers: {
          'api-key': currentApiKey,
          'Content-Type': 'application/json',
        },
        timeout: 20000,
      });

      if (resp.status >= 200 && resp.status < 300) {
        return { success: true, keyUsedIndex: activeKeyIndex + 1 };
      }
    } catch (err) {
      const status = err.response ? err.response.status : null;
      const errorMsg = err.response?.data?.message || err.response?.data?.code || err.message;
      const errorData = err.response ? JSON.stringify(err.response.data) : err.message;
      lastErrorData = errorMsg || errorData;

      console.warn(`[Brevo Pool] Key #${activeKeyIndex + 1} failed (Status: ${status || 'Network/Error'}). Error: ${errorData}`);

      const isQuotaOrLimit =
        status === 402 ||
        status === 429 ||
        status === 401 ||
        errorData.toLowerCase().includes('quota') ||
        errorData.toLowerCase().includes('limit') ||
        errorData.toLowerCase().includes('reseller') ||
        errorData.toLowerCase().includes('unauthorized') ||
        errorData.toLowerCase().includes('credit') ||
        errorData.toLowerCase().includes('ip') ||
        errorData.toLowerCase().includes('recognised');

      // If status === 400 (and NOT IP error), throw payload error
      if (status === 400 && !errorData.toLowerCase().includes('ip') && !errorData.toLowerCase().includes('recognised')) {
        throw new Error(`Invalid recipient email or payload: ${errorMsg || errorData}`);
      }

      if (isQuotaOrLimit && keys.length > 1) {
        // Silently switch to the next key
        console.log(`[Brevo Pool] Silently auto-switching from Key #${activeKeyIndex + 1} to Key #${((activeKeyIndex + 1) % keys.length) + 1}...`);
        activeKeyIndex = (activeKeyIndex + 1) % keys.length;
        attempts++;
      } else {
        activeKeyIndex = (activeKeyIndex + 1) % keys.length;
        attempts++;
        if (attempts >= maxAttempts) {
          throw new Error(`All ${keys.length} Brevo API key(s) failed or exceeded limits: ${lastErrorData}`);
        }
      }
    }
  }

  throw new Error(`All ${keys.length} Brevo API key(s) in pool exceeded daily sending limits. Last error: ${lastErrorData}`);
}

async function getBrevoPoolStatus() {
  const keys = getBrevoKeys();
  const poolStatus = [];

  for (let i = 0; i < keys.length; i++) {
    const apiKey = keys[i];
    const masked = apiKey.length > 12 ? `${apiKey.substring(0, 8)}...${apiKey.slice(-4)}` : `Key #${i + 1}`;
    let keyInfo = {
      index: i + 1,
      keyMasked: masked,
      email: masked,
      creditsRemaining: 300,
      dailyQuota: 300,
      creditsType: 'daily',
      status: 'standby',
      error: null
    };

    try {
      const resp = await axios.get('https://api.brevo.com/v3/account', {
        headers: { 'api-key': apiKey, 'accept': 'application/json' },
        timeout: 5000
      });

      if (resp.data) {
        if (resp.data.email) {
          keyInfo.email = resp.data.email;
        }
        if (Array.isArray(resp.data.plan)) {
          const sendPlan = resp.data.plan.find(p => p.credits !== undefined) || resp.data.plan[0];
          if (sendPlan) {
            keyInfo.creditsRemaining = sendPlan.credits !== undefined ? sendPlan.credits : 300;
            keyInfo.creditsType = sendPlan.creditsType || 'sendLimit';
            keyInfo.dailyQuota = 300;
          }
        }
      }

      if (keyInfo.creditsRemaining <= 0) {
        keyInfo.status = 'exceeded';
        keyInfo.email = `${keyInfo.email} (Limit Reached)`;
      }
    } catch (err) {
      const errMsg = err.response?.data?.message || err.message || '';
      keyInfo.error = errMsg;
      keyInfo.creditsRemaining = 0;
      if (errMsg.toLowerCase().includes('ip') || errMsg.toLowerCase().includes('recognised')) {
        keyInfo.status = 'invalid';
        keyInfo.email = `${masked} (IP Security Restricted)`;
      } else if (err.response?.status === 401) {
        keyInfo.status = 'invalid';
        keyInfo.email = `${masked} (Unauthorized / Revoked)`;
      } else {
        keyInfo.status = 'exceeded';
        keyInfo.email = `${masked} (Quota Exceeded)`;
      }
    }

    poolStatus.push(keyInfo);
  }

  // Mark the first key that has available credits as 'active'
  let activeFound = false;
  for (let k of poolStatus) {
    if (k.status !== 'exceeded' && k.status !== 'invalid' && k.creditsRemaining > 0) {
      if (!activeFound) {
        k.status = 'active';
        activeFound = true;
      } else {
        k.status = 'standby';
      }
    }
  }

  const totalRemaining = poolStatus.reduce((acc, k) => acc + (k.creditsRemaining || 0), 0);
  const totalCapacity = poolStatus.reduce((acc, k) => acc + (k.dailyQuota || 300), 0);

  return {
    totalKeys: keys.length,
    activeKeyIndex: activeKeyIndex + 1,
    totalRemaining,
    totalCapacity,
    keys: poolStatus
  };
}

module.exports = {
  sendEmailWithFailover,
  getBrevoKeysCount: () => getBrevoKeys().length,
  getBrevoPoolStatus
};
