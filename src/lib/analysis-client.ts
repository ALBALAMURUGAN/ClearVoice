/**
 * Client-side analysis engine — a faithful TypeScript port of analysis/analyze.py
 * (phonetic skeletons · Levenshtein alignment · fluency & clarity models).
 * Powers the app when the Python service is unreachable (e.g. static deploy).
 */
import type { AnalysisResult, WordResult, WordStatus, WordTiming } from './types';

const tokenize = (t: string) => (t.toLowerCase().replace(/’/g, "'").match(/[a-zA-Z']+/g) ?? []);
const stripPoss = (w: string) => w.replace(/('s|s')$/, '');

const GRAPHEME_RULES: [RegExp, string][] = [
  [/ough|augh/g, 'o'], [/tion|sion/g, 'shn'], [/eigh/g, 'a'], [/igh/g, 'i'],
  [/ee|ea|ie/g, 'i'], [/oo|ew|ue|ui/g, 'u'], [/ay|ai|ey|ei/g, 'a'], [/ow|oa|oe/g, 'o'],
  [/ou|au/g, 'o'], [/ph/g, 'f'], [/ck/g, 'k'], [/qu/g, 'kw'], [/x/g, 'ks'],
  [/tch/g, 'ch'], [/wh/g, 'w'], [/wr/g, 'r'], [/kn|gn/g, 'n'], [/mb/g, 'm'],
  [/c(?=[eiy])/g, 's'], [/g(?=[eiy])/g, 'j'], [/y/g, 'i'], [/w/g, 'u'],
];
const VOWELS = 'aeiou';

const skeleton = (word: string) => {
  let w = stripPoss(word.toLowerCase());
  for (const [re, rep] of GRAPHEME_RULES) w = w.replace(re, rep);
  w = w.replace(/(.)\1+/g, '$1').replace(/e$/, '');
  return w;
};
const vowelPattern = (w: string) => [...skeleton(w)].filter((c) => VOWELS.includes(c)).join('');
const consPattern = (w: string) => [...skeleton(w)].filter((c) => !VOWELS.includes(c)).join('');

function lev(a: string, b: string): number {
  if (a === b) return 0;
  const la = a.length, lb = b.length;
  if (!la) return lb;
  if (!lb) return la;
  let prev: number[] = Array.from({ length: lb + 1 }, (_, j) => j);
  for (let i = 1; i <= la; i++) {
    const cur: number[] = [i];
    for (let j = 1; j <= lb; j++) {
      cur.push(Math.min(cur[cur.length - 1] + 1, prev[j] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)));
    }
    prev = cur;
  }
  return prev[lb];
}

export function phoneticSimilarity(exp: string, got: string): number {
  if (exp === got) return 1;
  const se = skeleton(exp), sg = skeleton(got);
  if (se === sg) return 0.96;
  const skel = 1 - lev(se, sg) / Math.max(se.length, sg.length, 1);
  const ve = vowelPattern(exp), vg = vowelPattern(got);
  const vow = 1 - lev(ve, vg) / Math.max(ve.length, vg.length, 1);
  const ce = consPattern(exp), cg = consPattern(got);
  const con = 1 - lev(ce, cg) / Math.max(ce.length, cg.length, 1);
  return Math.max(0, Math.min(1, 0.4 * skel + 0.35 * vow + 0.25 * con));
}

function align(expW: string[], gotW: string[]): [number | null, number | null][] {
  const n = expW.length, m = gotW.length;
  const d: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = 0; i <= n; i++) d[i][0] = i;
  for (let j = 0; j <= m; j++) d[0][j] = j;
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      const cost = expW[i - 1] === gotW[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
    }
  }
  const pairs: [number | null, number | null][] = [];
  let i = n, j = m;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0) {
      const cost = expW[i - 1] === gotW[j - 1] ? 0 : 1;
      if (d[i][j] === d[i - 1][j - 1] + cost) { pairs.push([i - 1, j - 1]); i--; j--; continue; }
    }
    if (i > 0 && d[i][j] === d[i - 1][j] + 1) { pairs.push([i - 1, null]); i--; continue; }
    pairs.push([null, j - 1]); j--;
  }
  return pairs.reverse();
}

const classify = (score: number): WordStatus =>
  score >= 0.93 ? 'perfect' : score >= 0.74 ? 'good' : score >= 0.45 ? 'shaky' : 'missed';

const syllables = (w: string) => Math.max(1, (w.toLowerCase().replace(/e$/, '').match(/[aeiouy]+/g) ?? []).length);

function errorClass(expected: string, heard: string): string {
  const e = expected.toLowerCase(), h = heard.toLowerCase();
  if (/[szscht dk p g b]$/.test(e) && !h.endsWith(e[e.length - 1])) return 'final-consonant';
  if (e.includes('th') !== h.includes('th')) return 'th-sound';
  if (Math.abs(e.length - h.length) >= 3 || e[0] !== h[0]) return 'word-shape';
  if (vowelPattern(e) !== vowelPattern(h)) return 'vowel-quality';
  return 'stress-rhythm';
}

const TIP_LIBRARY: Record<string, string> = {
  'final-consonant': 'Release final consonants fully — let /t/, /d/, /s/ and /k/ land with a light, audible tap. Trailing sounds are the #1 clarity leak for intermediate speakers.',
  'th-sound': 'For /θ/ and /ð/, place the tongue tip lightly between the teeth and let air flow over it — not behind the teeth like /s/ or /f/. Feel the difference on ‘think’ vs ‘sink’.',
  'word-shape': 'This word’s outline changed shape — exaggerated articulation helps. Slow it down 50%, hit every vowel, then rebuild speed while keeping the skeleton intact.',
  'vowel-quality': 'English vowels reduce under stress — aim for a relaxed schwa /ə/ in weak syllables and a full, long vowel on the stressed beat. Contrast the two deliberately.',
  'stress-rhythm': 'Unstressed syllables flatten into schwas. Tap the stressed beat with your finger while speaking to lock in English’s stress-timed rhythm.',
  pace: 'Aim for the 120–160 WPM band — quick enough to flow, slow enough for consonants to land. Use a breath, not a stumble, between thought groups.',
  pauses: 'Cluster pauses at thought boundaries only. Hesitations mid-phrase fracture the rhythmic line — mark the commas in the sentence and breathe exactly there.',
};

export interface ClientAnalysisInput {
  expected: string; heard: string; durationMs: number;
  pauses: { start_ms: number; end_ms: number }[];
}

export function analyzeClientSide(input: ClientAnalysisInput): AnalysisResult {
  const expectedRaw = input.expected ?? '';
  const heardRaw = input.heard ?? '';
  const durationMs = Math.max(600, input.durationMs || 4000);
  const pauses = input.pauses ?? [];

  const expWords = tokenize(expectedRaw);
  const gotWords = tokenize(heardRaw);
  const pairs = align(expWords, gotWords);

  const wordResults: WordResult[] = [];
  const scores: number[] = [];
  for (const [ei, gi] of pairs) {
    if (ei === null || gi === null) {
      if (ei === null) {
        wordResults.push({ expected: null, heard: gotWords[gi as number], status: 'extra', score: 0.5, issue: 'word-shape' });
      } else {
        wordResults.push({ expected: expWords[ei], heard: null, status: 'missed', score: 0, issue: 'word-shape' });
        scores.push(0);
      }
      continue;
    }
    const e = expWords[ei], h = gotWords[gi];
    const sim = phoneticSimilarity(e, h);
    scores.push(sim);
    const status = classify(sim);
    wordResults.push({ expected: e, heard: h, status, score: sim, issue: sim >= 0.74 ? null : errorClass(e, h) });
  }

  const accuracy = expWords.length ? (scores.reduce((s, x) => s + x, 0) / expWords.length) * 100 : 0;
  const clarity = scores.length ? 100 / (scores.reduce((s, x) => s + 1 / Math.max(x, 1e-6), 0) / scores.length) : 0;

  const wordCount = expWords.length;
  const wpm = ((gotWords.length || wordCount) / Math.max(durationMs / 60000, 1e-6));
  let pace = 100;
  if (wpm < 118) pace = Math.max(35, 100 - (118 - wpm) * 1.15);
  else if (wpm > 165) pace = Math.max(35, 100 - (wpm - 165) * 1.25);
  const minutes = Math.max(wordCount / Math.max(wpm, 1), 0.05);
  const pauseCount = pauses.length;
  const longestPause = pauses.reduce((m, p) => Math.max(m, p.end_ms - p.start_ms), 0);
  const pausePen = Math.min(38, (pauseCount / minutes) * 4.6);
  const longestPen = Math.min(22, Math.max(0, (longestPause - 650) / 90));
  const fluency = Math.max(20, Math.min(100, pace - pausePen - longestPen));

  const totalSyl = expWords.reduce((s, w) => s + syllables(w), 0) || 1;
  let cursor = 0;
  const timings: WordTiming[] = expWords.map((w) => {
    const span = (syllables(w) / totalSyl) * durationMs;
    const t = { word: w, start_ms: Math.round(cursor), end_ms: Math.round(cursor + span) };
    cursor += span;
    return t;
  });

  const classes: Record<string, number> = {};
  for (const wr of wordResults) {
    if (wr.status === 'shaky' || wr.status === 'missed') {
      const cls = errorClass(wr.expected ?? '', wr.heard ?? '');
      classes[cls] = (classes[cls] ?? 0) + 1;
    }
  }
  const tips: string[] = [];
  for (const cls of Object.keys(classes).sort((a, b) => classes[b] - classes[a])) {
    tips.push(TIP_LIBRARY[cls]);
    if (tips.length === 2) break;
  }
  if (wpm > 165 || wpm < 118) tips.push(TIP_LIBRARY.pace);
  if (pauseCount / minutes > 4) tips.push(TIP_LIBRARY.pauses);
  if (!tips.length) tips.push('Excellent control — this attempt is studio grade. Raise the difficulty: longer sentences, faster delivery, or whispered reading for articulation precision.');

  const graded = wordResults.filter((w) => w.expected);
  const strong = graded.filter((w) => w.status === 'perfect' || w.status === 'good').length;
  const weakWords = graded.filter((w) => w.status === 'shaky' || w.status === 'missed').map((w) => w.expected as string);
  const overall = Math.round((accuracy * 0.45 + fluency * 0.25 + clarity * 0.3) * 10) / 10;
  const r1 = (n: number) => Math.round(n * 10) / 10;

  return {
    overall, accuracy: r1(accuracy), clarity: r1(clarity), fluency: r1(fluency), wpm: r1(wpm),
    word_count: wordCount, duration_ms: durationMs, pause_count: pauseCount, longest_pause_ms: longestPause,
    thought_boundary_pauses: pauses.filter((p) => p.end_ms - p.start_ms <= 650 && p.end_ms - p.start_ms >= 200).length,
    strong_words: strong, weak_words: weakWords,
    substitutions: graded.filter((w) => w.status === 'shaky').length,
    deletions: graded.filter((w) => w.status === 'missed').length,
    word_results: wordResults, timings, tips: tips.slice(0, 4),
    engine: 'clearvoice-js/1.4.2 (browser engine)',
  };
}
