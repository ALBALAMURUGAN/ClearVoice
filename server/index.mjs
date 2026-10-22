/**
 * ClearVoice AI — Backend API (JavaScript / Express)
 * ---------------------------------------------------
 * REST surface:
 *   GET  /api/health                 service + engine status
 *   GET  /api/profile                learner profile & goals
 *   GET  /api/sentences              intermediate sentence bank (filterable)
 *   POST /api/analyze                analyze one reading attempt (shells out to Python)
 *   GET  /api/attempts               attempt history
 *   GET  /api/stats/summary          headline stats, streak, deltas
 *   GET  /api/stats/timeline         per-day series for charts
 *   GET  /api/stats/words            word mastery table
 *   GET  /api/exercises              exercise catalog + completion state
 *   POST /api/exercises/:id/complete mark an exercise best-score completed
 *   GET  /api/recommendations        weak-word driven coaching plan
 *   POST /api/seed                   reseed demo history
 */
import express from 'express';
import cors from 'cors';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { db, seedIfEmpty, saveAttempt } from './db.mjs';
import { SENTENCES, EXERCISES, recommendationPool } from './content.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const PORT = process.env.PORT || 8787;
const PYTHON = process.env.PYTHON_BIN || (process.platform === 'win32' ? 'python' : 'python3');

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));

seedIfEmpty();

const USER = 'demo-user';
const asyncRoute = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const parseRow = (r) => ({
  ...r,
  weak_words: JSON.parse(r.weak_words || '[]'),
  word_results: JSON.parse(r.word_results || '[]'),
  timings: JSON.parse(r.timings || '[]'),
  tips: JSON.parse(r.tips || '[]'),
});

/* ------------------------------------------------------------ health */
app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    service: 'ClearVoice AI API',
    version: '1.4.2',
    engines: {
      javascript: `node ${process.version} · express ${express.version ?? '4.x'}`,
      python: `clearvoice-python · ${PYTHON}`,
      database: 'SQLite (node:sqlite, WAL)',
    },
    time: new Date().toISOString(),
  });
});

/* ----------------------------------------------------------- profile */
app.get('/api/profile', (req, res) => {
  const p = db.prepare('SELECT * FROM profile WHERE user_id = ?').get(USER);
  res.json({ profile: p });
});

/* ---------------------------------------------------------- sentence bank */
app.get('/api/sentences', (req, res) => {
  const { focus, search } = req.query;
  let list = SENTENCES;
  if (focus) list = list.filter((s) => s.focus === focus);
  if (search) {
    const q = String(search).toLowerCase();
    list = list.filter((s) => s.text.toLowerCase().includes(q) || s.focus.includes(q));
  }
  res.json({ count: list.length, sentences: list });
});

/* ------------------------------------------------------- analyze (Python) */
function runPython(payload) {
  return new Promise((resolve, reject) => {
    const script = path.join(ROOT, 'analysis', 'analyze.py');
    const proc = spawn(PYTHON, [script], { cwd: ROOT });
    let out = '', err = '';
    proc.stdout.on('data', (d) => (out += d));
    proc.stderr.on('data', (d) => (err += d));
    proc.on('error', reject);
    const timer = setTimeout(() => { proc.kill(); reject(new Error('python engine timeout')); }, 15000);
    proc.on('close', (code) => {
      clearTimeout(timer);
      if (code !== 0 && !out) return reject(new Error(err || `python exited ${code}`));
      try { resolve(JSON.parse(out)); } catch (e) { reject(new Error('bad engine output')); }
    });
    proc.stdin.write(JSON.stringify(payload));
    proc.stdin.end();
  });
}

app.post('/api/analyze', asyncRoute(async (req, res) => {
  const { expected, heard = '', duration_ms = 4000, pauses = [], exercise_id, source } = req.body ?? {};
  if (!expected || typeof expected !== 'string') {
    return res.status(400).json({ error: 'expected sentence is required' });
  }
  const started = Date.now();
  const analysis = await runPython({ expected, heard, duration_ms, pauses });
  if (analysis.error) return res.status(500).json({ error: `Python engine: ${analysis.error}` });

  const saved = saveAttempt({
    userId: USER,
    exerciseId: exercise_id || 'freeform',
    sentence: expected,
    heard,
    overall: analysis.overall,
    accuracy: analysis.accuracy,
    clarity: analysis.clarity,
    fluency: analysis.fluency,
    wpm: analysis.wpm,
    durationMs: analysis.duration_ms,
    pauseCount: analysis.pause_count,
    longestPauseMs: analysis.longest_pause_ms,
    strongWords: analysis.strong_words,
    substitutions: analysis.substitutions,
    deletions: analysis.deletions,
    weakWords: analysis.weak_words,
    wordResults: analysis.word_results,
    timings: analysis.timings,
    tips: analysis.tips,
    source: source || 'live',
  });

  res.json({
    attempt: parseRow(saved),
    analysis,
    engine_ms: Date.now() - started,
  });
}));

/* ------------------------------------------------------------ attempts */
app.get('/api/attempts', (req, res) => {
  const limit = Math.min(100, parseInt(req.query.limit ?? '30', 10));
  const rows = db.prepare('SELECT * FROM attempts WHERE user_id = ? ORDER BY datetime(created_at) DESC, id DESC LIMIT ?')
    .all(USER, limit)
    .map(parseRow);
  res.json({ count: rows.length, attempts: rows });
});

app.get('/api/attempts/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM attempts WHERE id = ? AND user_id = ?').get(req.params.id, USER);
  if (!row) return res.status(404).json({ error: 'attempt not found' });
  res.json({ attempt: parseRow(row) });
});

/* --------------------------------------------------------------- stats */
app.get('/api/stats/summary', (req, res) => {
  const all = db.prepare('SELECT * FROM attempts WHERE user_id = ? ORDER BY datetime(created_at) ASC, id ASC').all(USER);
  const n = all.length;
  if (!n) return res.json({ total: 0 });
  const avg = (arr, f) => arr.reduce((s, r) => s + f(r), 0) / arr.length;
  const last = all[n - 1];
  const first5 = all.slice(0, Math.min(5, n));
  const last5 = all.slice(-5);
  const profile = db.prepare('SELECT * FROM profile WHERE user_id = ?').get(USER);
  const bestScore = Math.max(...all.map((r) => r.overall));
  const totalMinutes = all.reduce((s, r) => s + r.duration_ms, 0) / 60000;
  const wordsSpoken = all.reduce((s, r) => s + Math.round((r.duration_ms / 60000) * r.wpm), 0);
  const avgWpm = avg(all, (r) => r.wpm);
  const avgPauses = avg(all, (r) => r.pause_count);
  const improvement = avg(last5, (r) => r.overall) - avg(first5, (r) => r.overall);
  const today = new Date().toISOString().slice(0, 10);
  const todays = all.filter((r) => r.created_at.slice(0, 10) === today);
  const wordStats = db.prepare('SELECT * FROM word_stats WHERE user_id = ?').all(USER);
  const mastered = wordStats.filter((w) => w.attempts > 0 && w.successes / w.attempts >= 0.75).length;
  const weakest = [...wordStats]
    .filter((w) => w.attempts > 0)
    .sort((a, b) => (a.successes / a.attempts) - (b.successes / b.attempts))[0];

  res.json({
    total_attempts: n,
    current_streak: profile?.streak ?? 1,
    daily_target: profile?.daily_target ?? 6,
    today_completed: todays.length,
    xp: profile?.xp ?? 0,
    level: profile?.level ?? 'Intermediate',
    best_score: Math.round(bestScore * 10) / 10,
    avg_overall: Math.round(avg(all, (r) => r.overall) * 10) / 10,
    avg_accuracy: Math.round(avg(all, (r) => r.accuracy) * 10) / 10,
    avg_clarity: Math.round(avg(all, (r) => r.clarity) * 10) / 10,
    avg_fluency: Math.round(avg(all, (r) => r.fluency) * 10) / 10,
    avg_wpm: Math.round(avgWpm),
    avg_pauses: Math.round(avgPauses * 10) / 10,
    last_attempt: parseRow(last),
    improvement: Math.round(improvement * 10) / 10,
    total_practice_minutes: Math.round(totalMinutes * 10) / 10,
    words_spoken: wordsSpoken,
    words_mastered: mastered,
    weakest_word: weakest ? { word: weakest.word, accuracy: Math.round((weakest.successes / weakest.attempts) * 100) } : null,
    goal: profile?.goal,
  });
});

app.get('/api/stats/timeline', (req, res) => {
  const rows = db.prepare(`
    SELECT substr(created_at, 1, 10) AS day,
           AVG(overall) AS overall, AVG(accuracy) AS accuracy, AVG(clarity) AS clarity,
           AVG(fluency) AS fluency, AVG(wpm) AS wpm, COUNT(*) AS attempts,
           AVG(pause_count) AS pauses
    FROM attempts WHERE user_id = ?
    GROUP BY day ORDER BY day ASC
  `).all(USER);
  res.json({
    days: rows.map((r) => ({
      day: r.day,
      overall: Math.round(r.overall * 10) / 10,
      accuracy: Math.round(r.accuracy * 10) / 10,
      clarity: Math.round(r.clarity * 10) / 10,
      fluency: Math.round(r.fluency * 10) / 10,
      wpm: Math.round(r.wpm),
      attempts: r.attempts,
      pauses: Math.round(r.pauses * 10) / 10,
    })),
  });
});

app.get('/api/stats/words', (req, res) => {
  const rows = db.prepare('SELECT * FROM word_stats WHERE user_id = ? ORDER BY (CAST(successes AS REAL) / MAX(attempts,1)) ASC, attempts DESC').all(USER);
  res.json({
    words: rows.map((w) => ({
      ...w,
      accuracy: w.attempts ? Math.round((w.successes / w.attempts) * 100) : 0,
    })),
  });
});

/* ---------------------------------------------------------- exercises */
app.get('/api/exercises', (req, res) => {
  const completions = db.prepare('SELECT exercise_id, best_score, completions FROM exercise_completions WHERE user_id = ?').all(USER);
  const map = Object.fromEntries(completions.map((c) => [c.exercise_id, c]));
  res.json({
    exercises: EXERCISES.map((e) => ({
      ...e,
      completions: map[e.id]?.completions ?? 0,
      best_score: map[e.id]?.best_score ?? 0,
      completed: (map[e.id]?.completions ?? 0) > 0,
    })),
  });
});

/* ----------------------------------------------------- recommendations */
app.get('/api/recommendations', (req, res) => {
  const weak = db.prepare('SELECT word, successes, attempts FROM word_stats WHERE user_id = ? AND attempts > 0 ORDER BY (CAST(successes AS REAL)/attempts) ASC').all(USER);
  const tips = recommendationPool(weak.slice(0, 3).map((w) => w.word));
  res.json({ tips, focus_words: weak.slice(0, 5).map((w) => ({ word: w.word, accuracy: Math.round((w.successes / w.attempts) * 100) })) });
});

/* ---------------------------------------------------------------- seed */
app.post('/api/seed', (req, res) => {
  db.exec('DELETE FROM attempts; DELETE FROM word_stats; DELETE FROM exercise_completions; DELETE FROM profile;');
  const result = seedIfEmpty();
  res.json({ ok: true, ...result });
});

/* -------------------------------------------------------------- errors */
app.use((err, req, res, next) => {
  console.error('[clearvoice]', err);
  res.status(500).json({ error: err.message ?? 'internal error' });
});

app.listen(PORT, () => {
  console.log(`\n  ✦ ClearVoice AI API listening on http://localhost:${PORT}`);
  console.log(`    engines: express · node:sqlite · Python phonetic-analysis\n`);
});
