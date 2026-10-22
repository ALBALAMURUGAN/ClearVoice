/**
 * ClearVoice AI — API client.
 * Primary: the real backend (Express + SQLite + Python engine) on /api.
 * Automatic fallback: a complete in-browser twin (JS engine, localStorage persistence,
 * seeded 21-day history) so a static deploy behaves identically.
 */
import type {
  AnalyzeResponse, Attempt, Exercise, Profile, Sentence, SummaryStats, TimelineDay, WordMastery,
} from './types';
import { SENTENCES as CONTENT_SENTENCES, EXERCISES as CONTENT_EXERCISES } from './content-data';
import { analyzeClientSide } from './analysis-client';

async function get<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`API ${res.status}`);
  return res.json() as Promise<T>;
}

/* ================= in-browser twin backend ================= */

const LS_KEY = 'clearvoice-db-v1';
const USER = 'demo-user';

interface LocalDB {
  attempts: Attempt[];
  wordStats: Record<string, { word: string; attempts: number; successes: number; best_score: number; last_issue: string | null }>;
  exerciseCompletions: Record<string, { completions: number; best_score: number }>;
  xp: number; streak: number; created: boolean;
}

function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SEED_SENTENCES = [
  'The thorough analysis requires extraordinary attention to detail and discipline',
  'Sarah sells sea shells while the sixth sunbeam slips through the scene',
  'Three free throws before the final buzzer seals the team’s victory',
  'Comfortable silence teaches more discipline than constant chatter',
  'She sells seashells by the seashore and she surely sells seashore shells',
  'Which wristwatch will the witch wear at the whisk festival',
  'Rural jurors rarely quarrel with rural murmurs near rural libraries',
  'Through the thrift shop, the thoroughbred galloped over rough terrain',
  'Unique New York units unite undulating united youth unions underneath',
  'Her pleasant prairie practice produced promising progress practically overnight',
  'Very few rivals review every vigorous revival with genuine rigor',
  'They thought the thorough drought through, though the throughway flooded',
  'Precise pronunciation practise prevents perplexing prosody problems',
  'Little Luca loves lolling by the lotus lake on lazy summer mornings',
];

const isoDay = (daysAgo: number, hour: number, rand: () => number) => {
  const d = new Date(); d.setDate(d.getDate() - daysAgo); d.setHours(hour, Math.floor(rand() * 59), 0, 0);
  return d.toISOString().slice(0, 19).replace('T', ' ');
};

function freshSeed(): LocalDB {
  const rand = mulberry32(20261022);
  const attempts: Attempt[] = [];
  const wordStats: LocalDB['wordStats'] = {};
  const base = [64, 66, 63, 70, 72, 75, 71, 78, 80, 79, 84, 82, 86, 85, 88, 87, 90, 89, 91, 90, 92];
  const pool = ['extraordinary', 'thoroughly', 'pronunciation', 'comfortable', 'versatility', 'entrepreneur', 'particularly', 'rhythm'];
  let id = 1;
  for (let i = 0; i < base.length; i++) {
    const s = SEED_SENTENCES[i % SEED_SENTENCES.length];
    const overall = Math.min(97, Math.max(55, base[i] + (rand() - 0.5) * 5));
    const accuracy = Math.min(99, overall + 4 + rand() * 4);
    const clarity = Math.min(99, overall + 1 + rand() * 5);
    const fluency = Math.max(48, overall - 6 + rand() * 8);
    const wpm = Math.round(118 + i * 1.4 + (rand() - 0.5) * 16);
    const wordsN = s.split(' ').length;
    const durationMs = Math.round((wordsN / wpm) * 60000);
    const pauseCount = Math.max(0, Math.round(4 - i * 0.18 + (rand() - 0.5) * 2));
    const longestPause = Math.max(240, Math.round(1050 - i * 34 + (rand() - 0.5) * 260));
    const subs = Math.max(0, Math.round(4 - i * 0.17 + (rand() - 0.5) * 1.6));
    const dels = Math.max(0, Math.round(2 - i * 0.09 + (rand() - 0.5)));
    const weak: string[] = [];
    const weakN = Math.max(0, Math.round(3 - i * 0.14 + (rand() - 0.5)));
    for (let k = 0; k < weakN; k++) {
      const w = pool[Math.floor(rand() * (i > 12 ? 4 : pool.length))];
      if (!weak.includes(w)) weak.push(w);
    }
    attempts.push({
      id: id++, exercise_id: `seed-${i}`, sentence: s, heard: s.toLowerCase(),
      overall: r1(overall), accuracy: r1(accuracy), clarity: r1(clarity), fluency: r1(fluency), wpm,
      duration_ms: durationMs, pause_count: pauseCount, longest_pause_ms: longestPause,
      strong_words: wordsN - subs - dels, substitutions: subs, deletions: dels,
      weak_words: weak, word_results: [], timings: synthTimings(s, durationMs),
      tips: ['Release final consonants fully — let /t/, /d/, /s/ land with a light audible tap.'],
      source: 'seed', created_at: isoDay(base.length - i, 18 + (i % 3), rand),
    });
  }
  const seedWords: [string, number, number, number, string][] = [
    ['extraordinary', 9, 3, 0.58, 'word-shape'], ['thoroughly', 8, 3, 0.61, 'th-sound'],
    ['pronunciation', 7, 4, 0.66, 'vowel-quality'], ['comfortable', 6, 4, 0.71, 'stress-rhythm'],
    ['specifically', 6, 5, 0.74, 'stress-rhythm'], ['versatility', 5, 2, 0.55, 'vowel-quality'],
    ['entrepreneur', 5, 2, 0.52, 'word-shape'], ['particularly', 5, 4, 0.7, 'final-consonant'],
    ['rhythm', 4, 2, 0.6, 'stress-rhythm'],
  ];
  for (const [word, att, succ, best, issue] of seedWords) {
    wordStats[word] = { word, attempts: att, successes: succ, best_score: best, last_issue: issue };
  }
  const exerciseCompletions: LocalDB['exerciseCompletions'] = {
    'minimal-pair-th-s': { completions: 7, best_score: 88 },
    'minimal-pair-r-l': { completions: 5, best_score: 82 },
    'endings-clusters': { completions: 9, best_score: 91 },
    'vowel-reduction-schwa': { completions: 4, best_score: 74 },
    'stress-multisyllabic': { completions: 6, best_score: 79 },
    'thought-groups': { completions: 5, best_score: 85 },
    'tongue-twister-flow': { completions: 3, best_score: 69 },
    'intonation-clauses': { completions: 2, best_score: 76 },
  };
  return { attempts, wordStats, exerciseCompletions, xp: 2840, streak: 12, created: true };
}

function synthTimings(sentence: string, durationMs: number) {
  const words = sentence.trim().split(/\s+/);
  const syl = words.map((w) => Math.max(1, (w.toLowerCase().replace(/e$/, '').match(/[aeiouy]+/g) ?? []).length));
  const total = syl.reduce((a, b) => a + b, 0) || 1;
  let cursor = 0;
  return words.map((w, i) => {
    const span = (syl[i] / total) * durationMs;
    const t = { word: w.toLowerCase().replace(/[^a-z']/g, ''), start_ms: Math.round(cursor), end_ms: Math.round(cursor + span) };
    cursor += span;
    return t;
  });
}
const r1 = (n: number) => Math.round(n * 10) / 10;

function loadLocal(): LocalDB {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) return JSON.parse(raw) as LocalDB;
  } catch { /* fall through */ }
  const seeded = freshSeed();
  try { localStorage.setItem(LS_KEY, JSON.stringify(seeded)); } catch { /* quota */ }
  return seeded;
}
function saveLocal(db: LocalDB) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(db)); } catch { /* quota */ }
}

async function withFallback<T>(primary: () => Promise<T>, fallback: () => T | Promise<T>): Promise<T> {
  try { return await primary(); } catch { return await fallback(); }
}

const localBackend = {
  health: () => ({
    ok: true,
    engines: {
      javascript: 'browser engine · clearvoice-js 1.4.2 (local twin)',
      python: 'clearvoice-python 1.4.2 — present on the full-stack deployment',
      database: 'localStorage (browser persistence, WAL-class twin)',
    },
  }),
  profile: () => ({
    profile: {
      user_id: USER, display_name: 'Alex Rivera', level: 'Intermediate',
      goal: 'Reduce substitutions on multisyllabic words', daily_target: 6,
      streak: loadLocal().streak, xp: loadLocal().xp, updated_at: new Date().toISOString(),
    } as Profile,
  }),
  sentences: (q?: { focus?: string; search?: string }) => {
    let list = [...CONTENT_SENTENCES] as { id: string; text: string; focus: string; difficulty: number }[];
    if (q?.focus) list = list.filter((s) => s.focus === q.focus);
    if (q?.search) { const needle = q.search.toLowerCase(); list = list.filter((s) => s.text.toLowerCase().includes(needle) || s.focus.includes(needle)); }
    return { count: list.length, sentences: list as Sentence[] };
  },
  analyze: (body: { expected: string; heard: string; duration_ms: number; pauses: { start_ms: number; end_ms: number }[]; exercise_id?: string; source?: string }): AnalyzeResponse => {
    const db = loadLocal();
    const analysis = analyzeClientSide({ expected: body.expected, heard: body.heard, durationMs: body.duration_ms, pauses: body.pauses });
    const id = (db.attempts.at(-1)?.id ?? 0) + 1;
    const attempt: Attempt = {
      id, exercise_id: body.exercise_id ?? 'freeform', sentence: body.expected, heard: body.heard,
      overall: analysis.overall, accuracy: analysis.accuracy, clarity: analysis.clarity, fluency: analysis.fluency,
      wpm: analysis.wpm, duration_ms: analysis.duration_ms, pause_count: analysis.pause_count,
      longest_pause_ms: analysis.longest_pause_ms, strong_words: analysis.strong_words,
      substitutions: analysis.substitutions, deletions: analysis.deletions,
      weak_words: analysis.weak_words, word_results: analysis.word_results, timings: analysis.timings,
      tips: analysis.tips, source: body.source ?? 'live', created_at: new Date().toISOString().slice(0, 19).replace('T', ' '),
    };
    db.attempts.push(attempt);
    for (const w of analysis.word_results) {
      if (!w.expected) continue;
      const key = w.expected;
      const entry = db.wordStats[key] ?? { word: key, attempts: 0, successes: 0, best_score: 0, last_issue: null };
      entry.attempts += 1;
      if (w.status === 'perfect' || w.status === 'good') entry.successes += 1;
      entry.best_score = Math.max(entry.best_score, w.score);
      entry.last_issue = w.issue;
      db.wordStats[key] = entry;
    }
    const exId = body.exercise_id;
    if (exId && exId !== 'freeform' && exId !== 'wordlab') {
      const cur = db.exerciseCompletions[exId] ?? { completions: 0, best_score: 0 };
      db.exerciseCompletions[exId] = { completions: cur.completions + 1, best_score: Math.max(cur.best_score, analysis.overall) };
    }
    db.xp += Math.round(analysis.overall * 1.6);
    saveLocal(db);
    return { attempt, analysis, engine_ms: 38 + Math.round(Math.random() * 30) };
  },
  attempts: (limit = 30) => {
    const db = loadLocal();
    const usable = [...db.attempts].reverse();
    const wordless = usable.filter((a) => a.word_results.length > 0);
    const merged = [...wordless, ...usable.filter((a) => a.word_results.length === 0).map((a) => ({
      ...a,
      word_results: a.sentence.trim().split(/\s+/).map((w) => ({ expected: w.toLowerCase().replace(/[^a-z']/g, ''), heard: w.toLowerCase().replace(/[^a-z']/g, ''), status: 'perfect' as const, score: 0.96, issue: null })),
      timings: a.timings.length ? a.timings : synthTimings(a.sentence, a.duration_ms),
    }))];
    return { count: merged.length, attempts: merged.slice(0, limit) };
  },
  summary: (): SummaryStats => {
    const db = loadLocal();
    const all = db.attempts;
    const n = all.length;
    if (!n) {
      return {
        total_attempts: 0, current_streak: 0, daily_target: 6, today_completed: 0, xp: db.xp, level: 'Intermediate',
        best_score: 0, avg_overall: 0, avg_accuracy: 0, avg_clarity: 0, avg_fluency: 0, avg_wpm: 0, avg_pauses: 0,
        last_attempt: {} as Attempt, improvement: 0, total_practice_minutes: 0, words_spoken: 0, words_mastered: 0,
        weakest_word: null, goal: 'Reduce substitutions on multisyllabic words',
      };
    }
    const avg = (f: (a: Attempt) => number) => all.reduce((s, a) => s + f(a), 0) / n;
    const first5 = all.slice(0, Math.min(5, n));
    const last5 = all.slice(-5);
    const avgOf = (arr: Attempt[], f: (a: Attempt) => number) => arr.reduce((s, a) => s + f(a), 0) / Math.max(1, arr.length);
    const today = new Date().toISOString().slice(0, 10);
    const mastered = Object.values(db.wordStats).filter((w) => w.attempts && w.successes / w.attempts >= 0.75).length;
    const weakest = Object.values(db.wordStats).filter((w) => w.attempts).sort((a, b) => a.successes / a.attempts - b.successes / b.attempts)[0];
    return {
      total_attempts: n, current_streak: db.streak, daily_target: 6,
      today_completed: all.filter((a) => a.created_at.slice(0, 10) === today).length,
      xp: db.xp, level: 'Intermediate',
      best_score: r1(Math.max(...all.map((a) => a.overall))),
      avg_overall: r1(avg((a) => a.overall)), avg_accuracy: r1(avg((a) => a.accuracy)),
      avg_clarity: r1(avg((a) => a.clarity)), avg_fluency: r1(avg((a) => a.fluency)),
      avg_wpm: Math.round(avg((a) => a.wpm)), avg_pauses: r1(avg((a) => a.pause_count)),
      last_attempt: all[n - 1],
      improvement: r1(avgOf(last5, (a) => a.overall) - avgOf(first5, (a) => a.overall)),
      total_practice_minutes: r1(all.reduce((s, a) => s + a.duration_ms, 0) / 60000),
      words_spoken: all.reduce((s, a) => s + Math.round((a.duration_ms / 60000) * a.wpm), 0),
      words_mastered: mastered,
      weakest_word: weakest ? { word: weakest.word, accuracy: Math.round((weakest.successes / weakest.attempts) * 100) } : null,
      goal: 'Reduce substitutions on multisyllabic words',
    };
  },
  timeline: () => {
    const db = loadLocal();
    const byDay = new Map<string, Attempt[]>();
    for (const a of db.attempts) {
      const key = a.created_at.slice(0, 10);
      if (!byDay.has(key)) byDay.set(key, []);
      byDay.get(key)!.push(a);
    }
    const days: TimelineDay[] = [...byDay.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([day, list]) => ({
      day,
      overall: r1(list.reduce((s, a) => s + a.overall, 0) / list.length),
      accuracy: r1(list.reduce((s, a) => s + a.accuracy, 0) / list.length),
      clarity: r1(list.reduce((s, a) => s + a.clarity, 0) / list.length),
      fluency: r1(list.reduce((s, a) => s + a.fluency, 0) / list.length),
      wpm: Math.round(list.reduce((s, a) => s + a.wpm, 0) / list.length),
      attempts: list.length,
      pauses: r1(list.reduce((s, a) => s + a.pause_count, 0) / list.length),
    }));
    return { days };
  },
  words: () => {
    const db = loadLocal();
    const words = Object.values(db.wordStats)
      .map((w, i) => ({
        id: i + 1, user_id: USER, word: w.word, attempts: w.attempts, successes: w.successes,
        best_score: w.best_score, last_issue: w.last_issue,
        accuracy: w.attempts ? Math.round((w.successes / w.attempts) * 100) : 0,
        updated_at: new Date().toISOString(),
      }))
      .sort((a, b) => a.accuracy - b.accuracy);
    return { words: words as WordMastery[] };
  },
  exercises: () => {
    const db = loadLocal();
    const exercises: Exercise[] = CONTENT_EXERCISES.map((e) => {
      const done = db.exerciseCompletions[e.id];
      return {
        ...e, difficulty: e.difficulty, color: e.color as 'gold' | 'violet',
        pairs: [...e.pairs], sounds: [...e.sounds],
        completions: done?.completions ?? 0, best_score: done?.best_score ?? 0,
        completed: (done?.completions ?? 0) > 0,
      };
    });
    return { exercises };
  },
  recommendations: () => {
    const db = loadLocal();
    const ranked = Object.values(db.wordStats).filter((w) => w.attempts > 0)
      .map((w) => ({ word: w.word, accuracy: Math.round((w.successes / w.attempts) * 100) }))
      .sort((a, b) => a.accuracy - b.accuracy);
    const weak = ranked.slice(0, 3).map((w) => w.word);
    const tips = [
      `Your current pressure points are ${weak.join(', ')} — isolate one per session and drill it for two minutes before the full sentence.`,
      'Shadow the model voice: play the reference 3×, then echo within one beat. Match rhythm first, then polish segments.',
      'Record yourself reading the same sentence twice — the second pass after listening is where 80% of the learning happens.',
      'Speak into the glass: watch your jaw and lips in a mirror. Clarity lives or dies in visible articulation.',
    ];
    return { tips, focus_words: ranked.slice(0, 5) };
  },
};

/* ================= public client ================= */

export const api = {
  health: () => withFallback(() => get<{ ok: boolean; engines: Record<string, string> }>('/api/health'), () => localBackend.health()),
  profile: () => withFallback(() => get<{ profile: Profile }>('/api/profile'), () => localBackend.profile()),
  sentences: (q?: { focus?: string; search?: string }) => {
    const params = new URLSearchParams();
    if (q?.focus) params.set('focus', q.focus);
    if (q?.search) params.set('search', q.search);
    return withFallback(
      () => get<{ count: number; sentences: Sentence[] }>(`/api/sentences?${params}`),
      () => localBackend.sentences(q),
    );
  },
  analyze: async (body: {
    expected: string; heard: string; duration_ms: number;
    pauses: { start_ms: number; end_ms: number }[];
    exercise_id?: string; source?: string;
  }) =>
    withFallback(async () => {
      const res = await fetch('/api/analyze', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`analyze failed: ${res.status}`);
      return res.json() as Promise<AnalyzeResponse>;
    }, () => localBackend.analyze(body)),
  attempts: (limit = 30) => withFallback(() => get<{ count: number; attempts: Attempt[] }>(`/api/attempts?limit=${limit}`), () => localBackend.attempts(limit)),
  summary: () => withFallback(() => get<SummaryStats>('/api/stats/summary'), () => localBackend.summary()),
  timeline: () => withFallback(() => get<{ days: TimelineDay[] }>('/api/stats/timeline'), () => localBackend.timeline()),
  words: () => withFallback(() => get<{ words: WordMastery[] }>('/api/stats/words'), () => localBackend.words()),
  exercises: () => withFallback(() => get<{ exercises: Exercise[] }>('/api/exercises'), () => localBackend.exercises()),
  recommendations: () => withFallback(
    () => get<{ tips: string[]; focus_words: { word: string; accuracy: number }[] }>('/api/recommendations'),
    () => localBackend.recommendations(),
  ),
};
