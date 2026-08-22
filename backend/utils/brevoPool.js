const axios = require('axios');

/**
 * Brevo API Key Pool & Silent Auto-Switch Manager
 * Supports up to 5 Brevo API Keys (BREVO_API_KEY_1 through BREVO_API_KEY_5,
 * or comma-separated BREVO_API_KEYS).
 */

function getBrevoKeys() {
  const keys = [];

  // Check BREVO_API_KEYS (comma separated)
  if (process.env.BREVO_API_KEYS) {
    const split = process.env.BREVO_API_KEYS.split(',').map(k => k.trim()).filter(Boolean);
    keys.push(...split);
  }

  // Check numbered BREVO_API_KEY_1 to BREVO_API_KEY_5
  for (let i = 1; i <= 5; i++) {
    const key = process.env[`BREVO_API_KEY_${i}`];
    if (key && !keys.includes(key.trim())) {
      keys.push(key.trim());
    }
  }

  // Fallback to BREVO_API_KEY
  if (process.env.BREVO_API_KEY && !keys.includes(process.env.BREVO_API_KEY.trim())) {
    keys.push(process.env.BREVO_API_KEY.trim());
  }

  return keys;
}

let activeKeyIndex = 0;

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
    to,
    name,
    subject,
    htmlContent,
    pdfBase64,
    certId,
    senderName = 'DigiCertify',
    senderEmail = 'digicertify00@gmail.com',
  } = emailOptions;

  const payload = {
    sender: { name: senderName, email: senderEmail },
    to: [{ email: to, name }],
    subject,
    htmlContent,
    attachment: pdfBase64 ? [{ content: pdfBase64, name: `${certId || 'Certificate'}.pdf` }] : [],
  };

  let attempts = 0;
  const maxAttempts = keys.length;

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
      const errorData = err.response ? JSON.stringify(err.response.data) : err.message;
      const isQuotaOrLimit =
        status === 402 ||
        status === 429 ||
        status === 400 ||
        status === 401 ||
        errorData.toLowerCase().includes('quota') ||
        errorData.toLowerCase().includes('limit') ||
        errorData.toLowerCase().includes('reseller') ||
        errorData.toLowerCase().includes('unauthorized') ||
        errorData.toLowerCase().includes('credit');

      console.warn(`[Brevo Pool] Key #${activeKeyIndex + 1} failed (Status: ${status || 'Network/Error'}). Error: ${errorData}`);

      if (isQuotaOrLimit && keys.length > 1) {
        // Silently switch to the next key without throwing an error to the caller
        console.log(`[Brevo Pool] Silently auto-switching from Key #${activeKeyIndex + 1} to Key #${((activeKeyIndex + 1) % keys.length) + 1}...`);
        activeKeyIndex = (activeKeyIndex + 1) % keys.length;
        attempts++;
      } else {
        // If it's not a quota issue or we've tried all keys, increment index for next attempt & rethrow
        activeKeyIndex = (activeKeyIndex + 1) % keys.length;
        attempts++;
        if (attempts >= maxAttempts) {
          throw new Error(`All ${keys.length} Brevo API key(s) failed or exceeded limits: ${errorData}`);
        }
      }
    }
  }

  throw new Error(`All ${keys.length} Brevo API key(s) in pool exceeded daily sending limits.`);
}

module.exports = {
  sendEmailWithFailover,
  getBrevoKeysCount: () => getBrevoKeys().length,
};
