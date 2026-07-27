/**
 * Vercel serverless function — ID Analyzer Core API v2 ID document extraction.
 * POST /api/extract-id
 *
 * Request body:
 *   { frontImage: "<data-url>", backImage?: "<data-url>" }
 *
 * Response body matches the client's OcrExtractionResult shape:
 *   { rawText: string, fields: { full_name, id_number, date_of_birth, expiry_date, nationality }, confidence: { ... } }
 */

const IDANALYZER_BASE = 'https://api2.idanalyzer.com';

/**
 * Safely read the request body as JSON.
 * Vercel's Node.js runtime may provide `req.body` already parsed (bodyParser: true by default),
 * but we also handle the raw-buffer case.
 */
async function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString()));
      } catch (e) {
        reject(new Error('Invalid JSON body'));
      }
    });
    req.on('error', reject);
  });
}

/**
 * Send a structured JSON response.
 */
function json(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(body);
}

export default async function handler(req, res) {
  // CORS headers (needed if called from a different origin in dev)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method !== 'POST') {
    json(res, 405, { error: 'Method not allowed' });
    return;
  }

  // --- Parse body ---
  let body;
  try {
    body = await readBody(req);
  } catch (err) {
    json(res, 400, { error: err.message || 'Invalid request body' });
    return;
  }

  const { frontImage, backImage } = body || {};

  if (!frontImage || typeof frontImage !== 'string') {
    json(res, 400, { error: 'Missing required field: frontImage (base64 data URL of the ID front)' });
    return;
  }

  // --- Build ID Analyzer v2 request ---
  const apiKey = process.env.ID_ANALYZER_API_KEY || process.env.IDANALYZER_API_KEY;
  if (!apiKey) {
    console.error('[extract-id] ID_ANALYZER_API_KEY / IDANALYZER_API_KEY is not set');
    json(res, 500, { error: 'Server misconfiguration: API key not found' });
    return;
  }

  const payload = {
    document_primary: frontImage,
  };
  if (backImage && typeof backImage === 'string') {
    payload.document_secondary = backImage;
  }

  let idAnalyzerResponse;
  try {
    const response = await fetch(`${IDANALYZER_BASE}/scan`, {
      method: 'POST',
      headers: {
        'X-API-KEY': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    idAnalyzerResponse = await response.json();

    // Log the full raw response during development for field-name discovery
    console.log('[extract-id] ID Analyzer raw response:', JSON.stringify(idAnalyzerResponse, null, 2));
  } catch (err) {
    console.error('[extract-id] Network error calling ID Analyzer:', err);
    json(res, 502, { error: `Failed to reach ID Analyzer API: ${err.message}` });
    return;
  }

  // --- Handle documented API errors ---
  if (!idAnalyzerResponse.success && idAnalyzerResponse.error) {
    const code = idAnalyzerResponse.error.code || idAnalyzerResponse.error;
    const message = idAnalyzerResponse.error.message || idAnalyzerResponse.message || 'Unknown ID Analyzer error';

    console.error(`[extract-id] ID Analyzer error [${code}]: ${message}`);

    // Map common error codes to user-friendly messages
    const friendlyMessages = {
      'auth_failed': 'Invalid API key — check IDANALYZER_API_KEY',
      'quota_exceeded': 'ID Analyzer quota exceeded for this billing period',
      'document_not_detected': 'Could not detect a valid ID document in the image. Try better lighting and a clearer photo.',
      'document_type_not_supported': 'The document type is not supported by ID Analyzer',
      'image_too_large': 'The uploaded image exceeds the size limit',
      'invalid_parameter': `Invalid request parameter: ${message}`,
    };

    json(res, 422, {
      rawText: '',
      fields: {},
      confidence: {},
      error: friendlyMessages[code] || message,
    });
    return;
  }

  // --- Parse result ---
  const result = idAnalyzerResponse.result || {};

  // ID Analyzer v2 may return firstName + lastName, or fullName, or both.
  const firstName = result.firstName || '';
  const lastName = result.lastName || '';
  let fullName = result.fullName || '';
  if (!fullName && (firstName || lastName)) {
    fullName = [firstName, lastName].filter(Boolean).join(' ');
  }

  // Build raw text from all available fields for downstream display
  const rawTextLines = [
    fullName && `Name: ${fullName}`,
    result.documentNumber && `ID Number: ${result.documentNumber}`,
    result.dob && `DOB: ${result.dob}`,
    result.expiry && `Expiry: ${result.expiry}`,
    result.nationality && `Nationality: ${result.nationality}`,
    result.documentType && `Document Type: ${result.documentType}`,
    result.issuingState && `Issuing State: ${result.issuingState}`,
  ].filter(Boolean);

  const rawText = rawTextLines.length > 0
    ? rawTextLines.join('\n')
    : JSON.stringify(result, null, 2);

  const fields = {
    full_name: fullName || '',
    id_number: result.documentNumber || '',
    date_of_birth: result.dob || '',
    expiry_date: result.expiry || '',
    nationality: result.nationality || '',
  };

  // --- Map confidence / accuracy ---
  // ID Analyzer v2 may return:
  //   - documentConfidence (overall 0-100)
  //   - per-field accuracy/confidence objects
  // We try several known field paths.
  const extractConfidence = (key) => {
    // Try result.accuracy?.key or result.confidence?.key or result.key + 'Confidence'
    const acc = result.accuracy;
    const conf = result.confidence;
    if (acc && typeof acc[key] === 'number') return Math.round(acc[key]);
    if (conf && typeof conf[key] === 'number') return Math.round(conf[key]);
    // Try camelCase variant
    const camelKey = key.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
    if (acc && typeof acc[camelKey] === 'number') return Math.round(acc[camelKey]);
    if (conf && typeof conf[camelKey] === 'number') return Math.round(conf[camelKey]);
    // Fallback to documentConfidence
    if (typeof result.documentConfidence === 'number') return Math.round(result.documentConfidence);
    return 85; // default when no confidence data
  };

  const confidence = {
    full_name: extractConfidence('full_name'),
    id_number: extractConfidence('id_number'),
    date_of_birth: extractConfidence('date_of_birth'),
    expiry_date: extractConfidence('expiry_date'),
    nationality: extractConfidence('nationality'),
  };

  json(res, 200, { rawText, fields, confidence });
}
