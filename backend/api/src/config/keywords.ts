/**
 * Deepgram keyword vocabulary for Layer A ASR biasing.
 *
 * Deepgram Nova-2 keyterm vocabulary for ASR biasing.
 * Uses the keyterm parameter (replaces the deprecated keywords param).
 * Boost values are not supported by keyterm — just the word/phrase.
 *
 * These are injected into the Deepgram WebSocket URL query parameters so the
 * ASR model biases toward recognizing these words during recording.
 *
 * To add a new region or project: append entries here and redeploy the backend.
 * No mobile rebuild is required — keywords are fetched at recording time.
 *
 * Multi-word phrases are supported by Deepgram (Nova-2) and will be URL-encoded
 * by the mobile client before appending to the WebSocket URL.
 */

export const DEEPGRAM_KEYWORDS: string[] = [
  // ── Hawaii / Honolulu place names ─────────────────────────────────────────
  'Puuhale',
  'Waiakamilo',
  'Dillingham',
  'Kamehameha',
  'Kalihi',
  'Nimitz',
  'Moanalua',
  'Likelike',
  'Kapalama',
  'Halawa',
  'Sand Island',
  'Kunia',
  'Middle Street',
  'Mapunapuna',
  'Iwilei',
  'Auld Lane',
  'Lagoon Drive',
  'Honolulu Harbor',

  // ── Construction / field operations vocabulary ────────────────────────────
  'drainage inlet',
  'manhole',
  'trench plate',
  'dewatering',
  'vac truck',
  'Godwin pump',
  'traffic control',
  'lane closure',
  'utility conflict',
  'asphalt patch',
  'curb and gutter',
  'submittal',
  'punch list',
  'turnover',
  'shoring',
  'conduit',
  'catch basin',
  'storm drain',
  'change order',
];
