// Qest4 report analysis with Claude. Used by api/analyze-report.js.
// Kept separate from the HTTP handler so it can be tested on its own.
import Anthropic from '@anthropic-ai/sdk';

export const MODEL = 'claude-sonnet-5-5';

export const APPROVED_BRANDS = [
  'Biolight Technologies',
  'Pure Encapsulations',
  'Biotics Research',
  'Premier Research Labs',
  'Metagenics',
];

export const DISCLAIMER =
  'This report is for educational purposes only and is not intended to diagnose, treat, cure, or prevent any disease or medical condition.';

export const WELLNESS_AREAS = ['energy', 'digestive', 'immune', 'hormonal', 'stress', 'nutritional'];

export const SYSTEM_PROMPT = `You are a holistic wellness assistant for Quest for Wellness, LLC. Kelly Parsons is a certified Qest4 Bioenergetic Practitioner, CHHP, and CNC. You analyze Qest4 bioenergetic scan reports and produce client-friendly summaries.

IMPORTANT RULES:
- Never use medical diagnostic language
- Never say 'diagnosed', 'disease', 'treat', or 'cure'
- Always use phrases like 'energetic stress', 'imbalance', 'support', 'optimize'
- Keep language warm, encouraging, and easy to understand
- Supplement recommendations MUST only come from these 5 brands: Biolight Technologies, Pure Encapsulations, Biotics Research, Premier Research Labs, Metagenics

Analyze the Qest4 scan report and return a JSON response with exactly this structure:
{
  wellnessScores: {
    energy: <0-100>,
    digestive: <0-100>,
    immune: <0-100>,
    hormonal: <0-100>,
    stress: <0-100>,
    nutritional: <0-100>
  },
  overallScore: <0-100>,
  summary: '<2-3 sentence layman friendly overview>',
  keyFindings: ['<finding 1>', '<finding 2>', '<finding 3>'],
  topSupplements: [
    {
      rank: 1,
      name: '<supplement name>',
      brand: '<one of the 5 approved brands>',
      reason: '<1 sentence why this helps this client>',
      priority: 'High'
    },
    {
      rank: 2,
      name: '<supplement name>',
      brand: '<one of the 5 approved brands>',
      reason: '<1 sentence why>',
      priority: 'High'
    },
    {
      rank: 3,
      name: '<supplement name>',
      brand: '<one of the 5 approved brands>',
      reason: '<1 sentence why>',
      priority: 'Medium'
    }
  ],
  allRecommendations: ['<rec 1>', '<rec 2>', '<rec 3>', '<rec 4>', '<rec 5>'],
  lifestyleNotes: '<1-2 sentences on lifestyle support>',
  followUpRecommended: <true/false>,
  disclaimer: 'This report is for educational purposes only and is not intended to diagnose, treat, cure, or prevent any disease or medical condition.'
}`;

// Structured-output schema: guarantees parseable JSON and restricts brands to the approved list.
const supplementSchema = {
  type: 'object',
  properties: {
    rank: { type: 'integer' },
    name: { type: 'string' },
    brand: { type: 'string', enum: APPROVED_BRANDS },
    reason: { type: 'string' },
    priority: { type: 'string', enum: ['High', 'Medium', 'Low'] },
  },
  required: ['rank', 'name', 'brand', 'reason', 'priority'],
  additionalProperties: false,
};

export const ANALYSIS_SCHEMA = {
  type: 'object',
  properties: {
    wellnessScores: {
      type: 'object',
      properties: Object.fromEntries(WELLNESS_AREAS.map(a => [a, { type: 'integer' }])),
      required: WELLNESS_AREAS,
      additionalProperties: false,
    },
    overallScore: { type: 'integer' },
    summary: { type: 'string' },
    keyFindings: { type: 'array', items: { type: 'string' } },
    topSupplements: { type: 'array', items: supplementSchema },
    allRecommendations: { type: 'array', items: { type: 'string' } },
    lifestyleNotes: { type: 'string' },
    followUpRecommended: { type: 'boolean' },
    disclaimer: { type: 'string' },
  },
  required: [
    'wellnessScores', 'overallScore', 'summary', 'keyFindings', 'topSupplements',
    'allRecommendations', 'lifestyleNotes', 'followUpRecommended', 'disclaimer',
  ],
  additionalProperties: false,
};

export class AnalysisError extends Error {
  constructor(message, status = 502) {
    super(message);
    this.status = status;
  }
}

const clampScore = n => Math.max(0, Math.min(100, Math.round(Number(n) || 0)));

// Enforce the ranges and counts the schema can't express.
export function normalizeAnalysis(raw) {
  const scores = Object.fromEntries(WELLNESS_AREAS.map(a => [a, clampScore(raw.wellnessScores?.[a])]));
  return {
    wellnessScores: scores,
    overallScore: clampScore(raw.overallScore),
    summary: String(raw.summary || '').trim(),
    keyFindings: (raw.keyFindings || []).map(String).filter(Boolean),
    topSupplements: (raw.topSupplements || [])
      .filter(s => APPROVED_BRANDS.includes(s.brand))
      .slice(0, 3)
      .map((s, i) => ({ ...s, rank: i + 1 })),
    allRecommendations: (raw.allRecommendations || []).map(String).filter(Boolean),
    lifestyleNotes: String(raw.lifestyleNotes || '').trim(),
    followUpRecommended: Boolean(raw.followUpRecommended),
    disclaimer: DISCLAIMER,
  };
}

/**
 * Analyze a Qest4 scan report PDF.
 * @param {string} pdfBase64 base64-encoded PDF (no data: prefix, no newlines)
 * @returns {Promise<{analysis: object, model: string}>}
 */
export async function analyzeQest4Pdf(pdfBase64, { client } = {}) {
  // Function limit is 30s, so fail fast rather than retry past it.
  const anthropic = client || new Anthropic({ timeout: 27_000, maxRetries: 0 });

  const response = await anthropic.beta.messages.create({
    model: MODEL,
    max_tokens: 16000,
    // If a safety classifier wrongly declines, retry on Anthropic's recommended fallback model
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    output_config: {
      effort: 'medium',
      format: { type: 'json_schema', schema: ANALYSIS_SCHEMA },
    },
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: pdfBase64 } },
          { type: 'text', text: 'Analyze this Qest4 scan report.' },
        ],
      },
    ],
  });

  if (response.stop_reason === 'refusal') {
    throw new AnalysisError('The AI declined to analyze this report. Please review it manually.', 422);
  }
  if (response.stop_reason === 'max_tokens') {
    throw new AnalysisError('The analysis was cut off before it finished. Please try again.', 502);
  }

  const text = response.content.filter(b => b.type === 'text').map(b => b.text).join('');
  let raw;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new AnalysisError('The AI returned an unreadable response. Please try again.', 502);
  }
  return { analysis: normalizeAnalysis(raw), model: response.model };
}
