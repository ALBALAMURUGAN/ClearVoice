/**
 * ClearVoice AI — SQLite persistence layer (node:sqlite)
 * Tables: attempts, word_stats, exercise_completions, profile
 * Ships with a rich 21-day seeded history so every chart is alive on first run.
 */
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';

const DATA_DIR = path.join(process.cwd(), 'data');
const DB_PATH = process.env.CLEARVOICE_DB || path.join(DATA_DIR, 'clearvoice.db');
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

export const db = new DatabaseSync(DB_PATH);
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');

db.exec(`
CREATE TABLE IF NOT EXISTS attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL DEFAULT 'demo-user',
  exercise_id TEXT NOT NULL DEFAULT 'freeform',
  sentence TEXT NOT NULL,
  heard TEXT NOT NULL DEFAULT '',
  overall REAL NOT NULL,
  accuracy REAL NOT NULL,
  clarity REAL NOT NULL,
  fluency REAL NOT NULL,
  wpm REAL NOT NULL,
  duration_ms INTEGER NOT NULL DEFAULT 0,
  pause_count INTEGER NOT NULL DEFAULT 0,
  longest_pause_ms INTEGER NOT NULL DEFAULT 0,
  strong_words INTEGER NOT NULL DEFAULT 0,
  substitutions INTEGER NOT NULL DEFAULT 0,
  deletions INTEGER NOT NULL DEFAULT 0,
  weak_words TEXT NOT NULL DEFAULT '[]',
  word_results TEXT NOT NULL DEFAULT '[]',
  timings TEXT NOT NULL DEFAULT '[]',
  tips TEXT NOT NULL DEFAULT '[]',
  source TEXT NOT NULL DEFAULT 'live',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_attempts_user_date ON attempts(user_id, created_at);

CREATE TABLE IF NOT EXISTS word_stats (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL DEFAULT 'demo-user',
  word TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  successes INTEGER NOT NULL DEFAULT 0,
  best_score REAL NOT NULL DEFAULT 0,
  last_issue TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id, word)
);

CREATE TABLE IF NOT EXISTS exercise_completions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL DEFAULT 'demo-user',
  exercise_id TEXT NOT NULL,
  best_score REAL NOT NULL DEFAULT 0,
  completions INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id, exercise_id)
);

CREATE TABLE IF NOT EXISTS profile (
  user_id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL DEFAULT 'Alex Rivera',
  level TEXT NOT NULL DEFAULT 'Intermediate',
  goal TEXT NOT NULL DEFAULT 'Reduce substitutions on multisyllabic words',
  daily_target INTEGER NOT NULL DEFAULT 6,
  streak INTEGER NOT NULL DEFAULT 12,
  xp INTEGER NOT NULL DEFAULT 2840,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`);

/* ----------------------------------------------------------- seed data */

function mulberry32(seed) {
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
  'Three free throws before the final buzzer seals the team\'s victory',
  'Comfortable silence teaches more discipline than comfortable chatter',
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

function isoDay(daysAgo, hour = 19, rand = Math.random) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(hour, Math.floor(rand() * 59), 0, 0);
  return d.toISOString().slice(0, 19).replace('T', ' ');
}

export function seedIfEmpty() {
  const row = db.prepare('SELECT COUNT(*) AS c FROM attempts').get();
  if (row.c > 0) return { seeded: false, attempts: row.c };

  const rand = mulberry32(20261022);
  const insert = db.prepare(`
    INSERT INTO attempts (user_id, exercise_id, sentence, heard, overall, accuracy, clarity, fluency, wpm,
      duration_ms, pause_count, longest_pause_ms, strong_words, substitutions, deletions,
      weak_words, word_results, timings, tips, source, created_at)
    VALUES ('demo-user', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'seed', ?)
  `);

  // 21-day learning curve: 62 -> 91 with realistic noise and plateaus
  const base = [64, 66, 63, 70, 72, 75, 71, 78, 80, 79, 84, 82, 86, 85, 88, 87, 90, 89, 91, 90, 92];
  let xp = 0, strongTotal = 0;
  const weakFreq = {};
  for (let i = 0; i < base.length; i++) {
    const daysAgo = base.length - i;
    const s = SEED_SENTENCES[i % SEED_SENTENCES.length];
    const overall = Math.min(97, Math.max(55, base[i] + (rand() - 0.5) * 5));
    const accuracy = Math.min(99, overall + 4 + rand() * 4);
    const clarity = Math.min(99, overall + 1 + rand() * 5);
    const fluency = Math.max(48, overall - 6 + rand() * 8);
    const wpm = Math.round(118 + i * 1.4 + (rand() - 0.5) * 16);
    const words = s.split(' ').length;
    const durationMs = Math.round((words / wpm) * 60000);
    const pauseCount = Math.max(0, Math.round(4 - i * 0.18 + (rand() - 0.5) * 2));
    const longestPause = Math.max(240, Math.round(1050 - i * 34 + (rand() - 0.5) * 260));
    const subs = Math.max(0, Math.round(4 - i * 0.17 + (rand() - 0.5) * 1.6));
    const dels = Math.max(0, Math.round(2 - i * 0.09 + (rand() - 0.5)));
    const strong = words - subs - dels;
    // emulate weak words trending down over time
    const pool = ['extraordinary', 'thoroughly', 'pronunciation', 'comfortable', 'versatility', 'entrepreneur', 'particularly', 'rhythm'];
    const weak = [];
    const weakN = Math.max(0, Math.round(3 - i * 0.14 + (rand() - 0.5)));
    for (let k = 0; k < weakN; k++) {
      const w = pool[Math.floor(rand() * (i > 12 ? 4 : pool.length))];
      if (!weak.includes(w)) weak.push(w);
      weakFreq[w] = (weakFreq[w] || 0) + 1;
    }
    const tips = [
      'Release final consonants fully — let /t/, /d/, /s/ land with a light audible tap.',
      'Aim for the 120–160 WPM band and cluster pauses at thought boundaries only.',
    ];
    xp += Math.round(overall * 1.6);
    strongTotal += strong;
    insert.run(
      `seed-${i}`, s, s.toLowerCase(),
      round1(overall), round1(accuracy), round1(clarity), round1(fluency), wpm,
      durationMs, pauseCount, longestPause, strong, subs, dels,
      JSON.stringify(weak),
      JSON.stringify(synthWordResults(s, subs, dels, weak)),
      JSON.stringify(synthTimings(s, durationMs)),
      JSON.stringify(tips),
      isoDay(daysAgo, 18 + (i % 3), rand)
    );
  }

  // aggregate word mastery table
  const wsInsert = db.prepare(`
    INSERT INTO word_stats (user_id, word, attempts, successes, best_score, last_issue, updated_at)
    VALUES ('demo-user', ?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(user_id, word) DO UPDATE SET
      attempts = attempts + excluded.attempts,
      successes = successes + excluded.successes
  `);
  const tricky = [
    ['extraordinary', 9, 3, 0.58, 'word-shape'],
    ['thoroughly', 8, 3, 0.61, 'th-sound'],
    ['pronunciation', 7, 4, 0.66, 'vowel-quality'],
    ['comfortable', 6, 4, 0.71, 'stress-rhythm'],
    ['specifically', 6, 5, 0.74, 'stress-rhythm'],
    ['versatility', 5, 2, 0.55, 'vowel-quality'],
    ['entrepreneur', 5, 2, 0.52, 'word-shape'],
    ['particularly', 5, 4, 0.7, 'final-consonant'],
    ['rhythm', 4, 2, 0.6, 'stress-rhythm'],
  ];
  for (const [w, att, succ, best, issue] of tricky) {
    wsInsert.run(w, att, succ, best, issue);
  }
  // merge live weak-word frequency from seeded attempts
  for (const [w, n] of Object.entries(weakFreq)) {
    const existing = db.prepare('SELECT attempts, successes FROM word_stats WHERE user_id=? AND word=?').get('demo-user', w);
    if (existing) {
      db.prepare('UPDATE word_stats SET attempts = attempts + ?, successes = successes + ? WHERE user_id=? AND word=?')
        .run(n, Math.max(0, n - Math.ceil(n / 3)), 'demo-user', w);
    } else {
      wsInsert.run(w, n, Math.max(0, n - Math.ceil(n / 3)), 0.6, 'vowel-quality');
    }
  }

  // exercise completion board
  const ecInsert = db.prepare(`
    INSERT INTO exercise_completions (user_id, exercise_id, best_score, completions, updated_at)
    VALUES ('demo-user', ?, ?, ?, datetime('now'))
    ON CONFLICT(user_id, exercise_id) DO UPDATE SET
      completions = completions + excluded.completions,
      best_score = MAX(best_score, excluded.best_score)
  `);
  const ex = [
    ['minimal-pair-th-s', 88, 7], ['minimal-pair-r-l', 82, 5], ['endings-clusters', 91, 9],
    ['vowel-reduction-schwa', 74, 4], ['stress-multisyllabic', 79, 6], ['phrase-chunking', 85, 5],
    ['tongue-twister-flow', 69, 3], ['thought-groups', 83, 4], ['intonation-clauses', 76, 2],
  ];
  for (const [id, best, n] of ex) ecInsert.run(id, best, n);

  db.prepare(`
    INSERT INTO profile (user_id, display_name, level, goal, daily_target, streak, xp)
    VALUES ('demo-user', 'Alex Rivera', 'Intermediate', 'Reduce substitutions on multisyllabic words', 6, 12, 2840)
    ON CONFLICT(user_id) DO NOTHING
  `).run();

  return { seeded: true, attempts: base.length };
}

function round1(n) { return Math.round(n * 10) / 10; }

function synthTimings(sentence, durationMs) {
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

function synthWordResults(sentence, subs, dels, weak) {
  const words = sentence.trim().split(/\s+/).map((w) => w.toLowerCase().replace(/[^a-z']/g, ''));
  const results = [];
  let budget = subs + dels;
  const weakSet = new Set(weak);
  for (const w of words) {
    const isWeak = weakSet.has(w) || (budget > 0 && w.length > 6 && results.length % 3 === 0);
    if (isWeak && budget > 0) {
      budget--;
      results.push({ expected: w, heard: w.slice(0, Math.max(3, w.length - 2)), status: 'shaky', score: 0.58 + Math.random() * 0.14, issue: 'vowel-quality' });
    } else {
      results.push({ expected: w, heard: w, status: 'perfect', score: 0.95 + Math.random() * 0.05, issue: null });
    }
  }
  return results;
}

/* ------------------------------------------------------------ write path */

export function saveAttempt(a) {
  const info = db.prepare(`
    INSERT INTO attempts (user_id, exercise_id, sentence, heard, overall, accuracy, clarity, fluency, wpm,
      duration_ms, pause_count, longest_pause_ms, strong_words, substitutions, deletions,
      weak_words, word_results, timings, tips, source)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `).run(
    a.userId ?? 'demo-user', a.exerciseId ?? 'freeform', a.sentence, a.heard ?? '',
    a.overall, a.accuracy, a.clarity, a.fluency, a.wpm,
    a.durationMs ?? 0, a.pauseCount ?? 0, a.longestPauseMs ?? 0,
    a.strongWords ?? 0, a.substitutions ?? 0, a.deletions ?? 0,
    JSON.stringify(a.weakWords ?? []), JSON.stringify(a.wordResults ?? []),
    JSON.stringify(a.timings ?? []), JSON.stringify(a.tips ?? []), a.source ?? 'live'
  );
  const id = Number(info.lastInsertRowid);

  // upsert word mastery
  const upsert = db.prepare(`
    INSERT INTO word_stats (user_id, word, attempts, successes, best_score, last_issue, updated_at)
    VALUES (?,?,1,?,?,?,datetime('now'))
    ON CONFLICT(user_id, word) DO UPDATE SET
      attempts = attempts + 1,
      successes = successes + excluded.successes,
      best_score = MAX(best_score, excluded.best_score),
      last_issue = excluded.last_issue,
      updated_at = datetime('now')
  `);
  for (const w of a.wordResults ?? []) {
    if (!w.expected) continue;
    const ok = w.status === 'perfect' || w.status === 'good';
    upsert.run(a.userId ?? 'demo-user', w.expected, ok ? 1 : 0, w.score ?? 0, w.issue ?? null);
  }

  // exercise completion
  if (a.exerciseId && a.exerciseId !== 'freeform') {
    db.prepare(`
      INSERT INTO exercise_completions (user_id, exercise_id, best_score, completions)
      VALUES (?,?,?,1)
      ON CONFLICT(user_id, exercise_id) DO UPDATE SET
        completions = completions + 1,
        best_score = MAX(best_score, excluded.best_score),
        updated_at = datetime('now')
    `).run(a.userId ?? 'demo-user', a.exerciseId, a.overall);
  }

  // profile xp + streak heartbeat
  db.prepare(`UPDATE profile SET xp = xp + ?, updated_at = datetime('now') WHERE user_id = ?`)
    .run(Math.round(a.overall * 1.6), a.userId ?? 'demo-user');

  return db.prepare('SELECT * FROM attempts WHERE id = ?').get(id);
}
