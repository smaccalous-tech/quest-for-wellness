// POST /api/analyze-report — analyze a Qest4 scan PDF with Claude for the admin panel.
//
// SETUP (one time, in Vercel):
//   Project → Settings → Environment Variables → add
//     ANTHROPIC_API_KEY = <your key>        (Production + Preview)
//   Optional:
//     ALLOWED_ORIGINS   = comma-separated extra origins allowed to call this API
//   Redeploy after adding variables. The local .env file is NOT uploaded to Vercel.
//
// Security:
//   - Only Kelly's signed-in, email-verified Firebase account can call this (ID token checked here).
//   - The client name and PDF are never logged, stored, or forwarded — only the PDF goes to Claude.
import Anthropic from '@anthropic-ai/sdk';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { analyzeQest4Pdf, AnalysisError } from '../lib/analyze.js';

const FIREBASE_PROJECT_ID = 'quest-for-wellness-1a0f4';
const ADMIN_EMAIL = 'questforwellness22@gmail.com';
// Vercel rejects request bodies over 4.5 MB; base64 adds ~33%, so PDFs must be under ~3 MB.
const MAX_BASE64_LENGTH = 4_200_000;

const DEFAULT_ORIGINS = [
  'https://questforwellnessllc.com',
  'https://www.questforwellnessllc.com',
  'http://localhost:3000',
  'http://localhost:5173',
];
const allowedOrigins = new Set([
  ...DEFAULT_ORIGINS,
  ...(process.env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean),
]);

const firebaseKeys = createRemoteJWKSet(
  new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com')
);

function setCors(req, res) {
  const origin = req.headers.origin;
  // Same-origin requests need no CORS; cross-origin only from known sites and this deployment's own URL
  const ownOrigin = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null;
  if (origin && (allowedOrigins.has(origin) || origin === ownOrigin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Max-Age', '600');
}

async function verifyAdmin(req) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return false;
  try {
    const { payload } = await jwtVerify(token, firebaseKeys, {
      issuer: `https://securetoken.google.com/${FIREBASE_PROJECT_ID}`,
      audience: FIREBASE_PROJECT_ID,
    });
    return payload.email_verified === true && String(payload.email || '').toLowerCase() === ADMIN_EMAIL;
  } catch {
    return false;
  }
}

export default async function handler(req, res) {
  setCors(req, res);
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  if (!(await verifyAdmin(req))) {
    return res.status(401).json({ error: 'Not authorized. Please sign in to the admin panel again.' });
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: 'The AI service is not configured yet (missing ANTHROPIC_API_KEY in Vercel).' });
  }

  // clientName is accepted for the admin panel's convenience but deliberately unused:
  // it is not needed for the analysis, so it is never sent to Claude or logged.
  const { pdfBase64 } = req.body || {};
  if (typeof pdfBase64 !== 'string' || !pdfBase64) {
    return res.status(400).json({ error: 'No PDF was received.' });
  }
  if (pdfBase64.length > MAX_BASE64_LENGTH) {
    return res.status(413).json({ error: 'That PDF is too large. Please upload a file under 3 MB.' });
  }
  const data = pdfBase64.replace(/\s/g, '');
  if (!data.startsWith('JVBER')) { // "%PDF" in base64
    return res.status(400).json({ error: 'That file does not look like a PDF.' });
  }

  try {
    const { analysis, model } = await analyzeQest4Pdf(data);
    return res.status(200).json({ analysis, model, analyzedAt: new Date().toISOString() });
  } catch (err) {
    // Log only the error type and status — never request content
    if (err instanceof AnalysisError) {
      console.error('analyze-report: analysis error', err.status);
      return res.status(err.status).json({ error: err.message });
    }
    if (err instanceof Anthropic.RateLimitError) {
      console.error('analyze-report: rate limited');
      return res.status(429).json({ error: 'The AI service is busy. Please wait a minute and try again.' });
    }
    if (err instanceof Anthropic.AuthenticationError) {
      console.error('analyze-report: Anthropic authentication failed');
      return res.status(500).json({ error: 'The AI service key is invalid. Check ANTHROPIC_API_KEY in Vercel.' });
    }
    if (err instanceof Anthropic.APIConnectionTimeoutError) {
      console.error('analyze-report: timeout');
      return res.status(504).json({ error: 'The analysis took too long. Please try again.' });
    }
    if (err instanceof Anthropic.APIError) {
      console.error('analyze-report: Anthropic API error', err.status);
      return res.status(502).json({ error: 'The AI service returned an error. Please try again.' });
    }
    console.error('analyze-report: unexpected error', err?.name);
    return res.status(500).json({ error: 'Something went wrong analyzing the report.' });
  }
}
