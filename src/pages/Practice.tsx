import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Mic2, Square, Volume2, ChevronRight, ChevronLeft, RotateCcw, Sparkles, Loader2,
  CheckCircle2, AlertTriangle, XCircle, Circle, Wand2, Pause, ArrowRight, ScanText, ListFilter, X,
} from 'lucide-react';
import { api } from '../lib/api';
import { useSpeech, type PauseMark } from '../lib/speech';
import { speakReference, saveRecording } from '../lib/audio';
import { ScoreRing } from '../components/ScoreRing';
import type { AnalysisResult, AnalyzeResponse, Sentence, WordResult } from '../lib/types';

const FOCUS_LABEL: Record<string, string> = {
  'th-sound': 'Th sounds', 'r-l': 'R vs L', endings: 'Endings', schwa: 'Schwa', stress: 'Word stress', flow: 'Flow', prosody: 'Prosody',
};

/** Deterministic pseudo-analysis used when the mic or recognizer is unavailable (demo mode). */
function simulatedRead(expected: string) {
  let h = 2166136261;
  for (let i = 0; i < expected.length; i++) { h ^= expected.charCodeAt(i); h = Math.imul(h, 16777619); }
  let rand = () => { h = Math.imul(h ^ (h >>> 13), 0x5bd1e995); h ^= h >>> 15; return (h >>> 0) / 4294967296; };
  const words = expected.trim().split(/\s+/);
  const out: string[] = [];
  for (const w of words) {
    const r = rand();
    if (r < 0.10) { // mangle vowel-ish letters
      const vowels = 'aeiou';
      const chars = w.split('');
      const vi = chars.findIndex((c) => vowels.includes(c.toLowerCase()));
      if (vi > 0) chars[vi] = vowels[Math.floor(rand() * 5)];
      out.push(chars.join(''));
    } else if (r < 0.16) {
      out.push(w); // duplicate
      out.push(w);
    } else {
      out.push(w);
    }
  }
  const duration = Math.round((words.length / 2.35) * 1000 * (0.9 + rand() * 0.3));
  const pauses: PauseMark[] = [];
  const nPauses = rand() < 0.6 ? 1 : rand() < 0.85 ? 2 : 3;
  for (let i = 0; i < nPauses; i++) {
    const start = Math.round(duration * (0.25 + rand() * 0.55));
    pauses.push({ start_ms: start, end_ms: start + Math.round(420 + rand() * 750) });
  }
  return { heard: out.join(' '), duration, pauses };
}

type Status = WordResult['status'];
const statusStyle: Record<Status, string> = {
  perfect: 'text-mint border-mint/35 bg-mint/10',
  good: 'text-[#a8f0c6] border-mint/20 bg-mint/5',
  shaky: 'text-amber border-amber/40 bg-amber/10',
  missed: 'text-rose border-rose/40 bg-rose/10 line-through decoration-rose/60',
  extra: 'text-violet-300 border-violet-400/30 bg-violet-500/10 italic',
};
const statusIcon: Record<Status, typeof CheckCircle2> = {
  perfect: CheckCircle2, good: CheckCircle2, shaky: AlertTriangle, missed: XCircle, extra: Circle,
};

export default function Practice() {
  const [searchParams] = useSearchParams();
  const exerciseId = searchParams.get('exercise') ?? 'freeform';
  const [sentences, setSentences] = useState<Sentence[]>([]);
  const [index, setIndex] = useState(0);
  const [focusFilter, setFocusFilter] = useState<string>('all');
  const [phase, setPhase] = useState<'ready' | 'result'>('ready');
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<AnalyzeResponse | null>(null);
  const [heardText, setHeardText] = useState('');
  const [playingVoice, setPlayingVoice] = useState(false);
  const [engineMs, setEngineMs] = useState<number | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    api.sentences().then((d) => setSentences(d.sentences)).catch(() => setSentences([]));
  }, []);

  const filtered = useMemo(
    () => (focusFilter === 'all' ? sentences : sentences.filter((s) => s.focus === focusFilter)),
    [sentences, focusFilter],
  );
  const sentence = filtered[Math.min(index, Math.max(0, filtered.length - 1))];

  useEffect(() => { setIndex(0); }, [focusFilter]);

  const runAnalysis = useCallback(async (heard: string, durationMs: number, pauses: PauseMark[], source: 'live' | 'simulated') => {
    if (!sentence) return;
    setAnalyzing(true);
    try {
      const res = await api.analyze({
        expected: sentence.text,
        heard,
        duration_ms: Math.max(600, Math.round(durationMs)),
        pauses,
        exercise_id: exerciseId,
        source,
      });
      setResult(res);
      setEngineMs(res.engine_ms);
      setPhase('result');
      // attach recording blob for word-level replay in Word Lab
      if (chunksRef.current.length) {
        const blob = new Blob(chunksRef.current, { type: chunksRef.current[0]?.type || 'audio/webm' });
        if (blob.size > 1000) saveRecording(`attempt-${res.attempt.id}`, blob).catch(() => undefined);
        chunksRef.current = [];
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e) {
      console.error(e);
    } finally {
      setAnalyzing(false);
    }
  }, [sentence, exerciseId]);

  const { phase: speechPhase, levels, elapsedMs, interim, error, supported, start, stop, reset } = useSpeech({
    onResult: useCallback((heard: string, durationMs: number, pauses: PauseMark[]) => {
      if (heard.trim().length > 2) {
        setHeardText(heard);
        runAnalysis(heard, durationMs, pauses, 'live');
      } else {
        // recognizer heard nothing — fall back to an elegant simulation, clearly labeled
        const sim = simulatedRead(sentence?.text ?? '');
        setHeardText(sim.heard);
        runAnalysis(sim.heard, sim.duration, sim.pauses, 'simulated');
      }
    }, [runAnalysis, sentence]),
  });

  const beginCapture = useCallback(async () => {
    chunksRef.current = [];
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      mr.ondataavailable = (e) => { if (e.data.size) chunksRef.current.push(e.data); };
      mr.start(250);
      mediaRecorderRef.current = mr;
    } catch {
      mediaRecorderRef.current = null; // waveform hook handles the error path
    }
    start();
  }, [start]);

  const endCapture = useCallback(() => {
    try { mediaRecorderRef.current?.stop(); mediaRecorderRef.current?.stream.getTracks().forEach((t) => t.stop()); } catch { /* noop */ }
    stop();
  }, [stop]);

  const hearReference = async () => {
    if (!sentence) return;
    setPlayingVoice(true);
    try { await speakReference(sentence.text); } finally { setPlayingVoice(false); }
  };

  const nextSentence = () => setIndex((i) => (i + 1) % Math.max(1, filtered.length));
  const prevSentence = () => setIndex((i) => (i - 1 + Math.max(1, filtered.length)) % Math.max(1, filtered.length));

  const tryAgain = () => {
    setResult(null); setHeardText(''); setPhase('ready'); reset();
  };

  const listening = speechPhase === 'listening';
  const processing = analyzing || speechPhase === 'processing';

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 md:py-12">
      {/* ======== header ======== */}
      <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
        <div>
          <p className="panel-title flex items-center gap-2"><Mic2 size={12} className="text-gold-400" /> Practice Studio · Intermediate</p>
          <h1 className="font-display text-3xl sm:text-4xl font-black text-cream mt-2">The Reading <span className="text-gold-grad">Studio</span></h1>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="chip"><ListFilter size={12} /> Focus</span>
          <div className="flex flex-wrap gap-1.5">
            {['all', 'th-sound', 'r-l', 'endings', 'schwa', 'stress', 'flow', 'prosody'].map((f) => (
              <button key={f} onClick={() => setFocusFilter(f)}
                className={`px-3 py-1.5 rounded-full text-[0.7rem] font-semibold border transition-all ${focusFilter === f ? 'bg-gold-500 text-[#241203] border-gold-500 shadow-[0_2px_12px_rgba(245,179,1,.4)]' : 'text-muted border-white/10 hover:text-cream hover:border-white/25'}`}>
                {f === 'all' ? 'All' : FOCUS_LABEL[f]}
              </button>
            ))}
          </div>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {phase === 'ready' ? (
          /* ================= READING PHASE ================= */
          <motion.div key="ready" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.45 }}
            className="grid lg:grid-cols-5 gap-6">
            {/* left: sentence card */}
            <div className="lg:col-span-3 glass-panel p-6 sm:p-9 relative overflow-hidden flex flex-col">
              <div className="absolute -top-24 -right-24 w-72 h-72 rounded-full bg-violet-600/14 blur-3xl" aria-hidden="true" />
              <div className="flex items-center justify-between relative">
                <div className="flex items-center gap-2">
                  <span className="chip chip-gold">{sentence ? FOCUS_LABEL[sentence.focus] ?? sentence.focus : 'Sentence'}</span>
                  <span className="chip">Difficulty {sentence?.difficulty ?? 3}/5</span>
                </div>
                <div className="flex items-center gap-1">
                  <button className="p-2 rounded-lg text-muted hover:text-cream hover:bg-white/5" onClick={prevSentence} aria-label="Previous sentence"><ChevronLeft size={18} /></button>
                  <span className="font-mono text-[0.7rem] text-muted w-14 text-center">{sentence ? `${filtered.indexOf(sentence) + 1} / ${filtered.length}` : '—'}</span>
                  <button className="p-2 rounded-lg text-muted hover:text-cream hover:bg-white/5" onClick={nextSentence} aria-label="Next sentence"><ChevronRight size={18} /></button>
                </div>
              </div>

              <div className="relative flex-1 flex flex-col justify-center py-8">
                <p className="font-mono text-[0.62rem] tracking-[0.3em] text-faint uppercase mb-4">Read aloud, naturally</p>
                <p className="font-display font-semibold text-cream leading-[1.28] text-2xl sm:text-[2.15rem]">
                  {sentence?.text ?? 'Loading sentences…'}
                </p>
                <button onClick={hearReference} className="mt-6 inline-flex items-center gap-2 text-[0.82rem] font-semibold text-violet-300 hover:text-violet-200 transition-colors group w-max">
                  <span className="w-8 h-8 rounded-full border border-violet-400/40 bg-violet-500/10 flex items-center justify-center group-hover:bg-violet-500/20 transition-colors">
                    {playingVoice ? <Pause size={13} fill="currentColor" /> : <Volume2 size={14} />}
                  </span>
                  {playingVoice ? 'Coach is speaking…' : 'Hear the reference voice'}
                </button>
              </div>

              {/* live transcript while listening */}
              <AnimatePresence>
                {listening && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                    className="relative border border-gold-500/25 bg-gold-500/6 rounded-2xl px-5 py-4 mb-4">
                    <p className="font-mono text-[0.6rem] uppercase tracking-[0.25em] text-gold-400 mb-1.5 flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-rose animate-pulse" /> Live transcript</p>
                    <p className="text-cream/90 text-[0.95rem] leading-snug min-h-[1.5rem]">{interim || 'Listening…'}</p>
                  </motion.div>
                )}
              </AnimatePresence>
              {error && <p className="relative text-[0.78rem] text-rose/90 bg-rose/8 border border-rose/25 rounded-xl px-4 py-2.5 mb-4">{error}</p>}

              {/* ======= transport row: waveform + record button ======= */}
              <div className="relative flex items-center gap-4 sm:gap-6 pt-2 border-t border-white/6">
                <button onClick={listening ? endCapture : beginCapture} disabled={processing}
                  className={`relative shrink-0 w-20 h-20 sm:w-24 sm:h-24 rounded-full flex flex-col items-center justify-center transition-all disabled:opacity-60 ${listening ? 'record-live bg-gradient-to-br from-rose to-[#be123d]' : 'record-idle btn-gold !rounded-full !p-0'}`}
                  aria-label={listening ? 'Stop and score' : 'Start recording'}>
                  {listening ? <Square size={22} fill="#fff" className="text-white" /> : <Mic2 size={26} strokeWidth={2.2} />}
                  <span className={`font-mono text-[0.55rem] mt-1 ${listening ? 'text-white/90' : 'text-[#2a1a02] font-bold'}`}>
                    {listening ? `${Math.floor(elapsedMs / 1000)}s` : 'REC'}
                  </span>
                </button>

                {/* waveform */}
                <div className="flex-1 h-20 sm:h-24 flex items-center gap-[3px] sm:gap-1 overflow-hidden" aria-hidden="true">
                  {levels.map((v, i) => (
                    <div key={i} className="eq-bar flex-1 min-w-[3px]" style={{
                      height: `${Math.max(6, v * 100)}%`,
                      background: listening ? `linear-gradient(180deg, #ffd84d, #f5b301 55%, #8b5cf6)` : 'linear-gradient(180deg,#3a2653,#33204c)',
                      animationDelay: `${(i % 12) * 0.09}s`,
                      animationPlayState: listening ? 'running' : 'paused',
                      opacity: listening ? 1 : 0.75,
                      boxShadow: listening && v > 0.4 ? '0 0 8px rgba(245,179,1,.45)' : 'none',
                    }} />
                  ))}
                </div>
              </div>
            </div>

            {/* right: mic hero + tips */}
            <div className="lg:col-span-2 flex flex-col gap-4">
              <div className="glass-panel relative overflow-hidden flex-1 min-h-[220px]">
                <img src="/images/golden-mic.png" alt="Golden microphone floating above a holographic sound ring" className="absolute inset-0 w-full h-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-[#1c1029]/95 via-[#1c1029]/25 to-transparent" />
                <div className="absolute bottom-4 left-5 right-5">
                  <p className="font-mono text-[0.58rem] uppercase tracking-[0.28em] text-gold-300">Coach Aria · Reference</p>
                  <p className="text-cream font-semibold text-[0.9rem] mt-1">“Read like the microphone can taste your consonants.”</p>
                </div>
              </div>
              <div className="glass-panel p-5">
                <p className="panel-title mb-2.5">Before you begin</p>
                <ul className="text-[0.8rem] text-muted space-y-1.5 leading-snug">
                  <li>① Sit tall — the diaphragm powers the consonants.</li>
                  <li>② Land every word ending: <span className="text-cream">texts, masked, sixth</span>.</li>
                  <li>③ Pause at commas, not at nerves.</li>
                </ul>
                {!supported && <p className="mt-3 text-[0.68rem] text-amber/90 font-mono">Speech recognition unavailable in this browser — reads will run in labeled simulation mode.</p>}
              </div>
            </div>
          </motion.div>
        ) : (
          /* ================= RESULTS PHASE ================= */
          <motion.div key="result" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.5 }}>
            {analyzing ? (
              <div className="glass-panel p-16 flex flex-col items-center justify-center text-center">
                <Loader2 className="animate-spin text-gold-400" size={38} />
                <p className="font-display text-xl text-cream mt-5">The Python engine is aligning your words…</p>
                <p className="font-mono text-[0.68rem] text-muted mt-2">grapheme skeletons · Levenshtein backtrace · prosody model</p>
              </div>
            ) : result && (
              <div className="grid lg:grid-cols-5 gap-6">
                {/* ---- left rail: scores ---- */}
                <div className="lg:col-span-2 flex flex-col gap-4">
                  <div className="glass-panel p-6 sm:p-7 flex flex-col items-center">
                    <p className="panel-title mb-4">Attempt #{result.attempt.id} · overall</p>
                    <ScoreRing value={result.analysis.overall} size={168} stroke={14} />
                    <p className="mt-3 font-mono text-[0.65rem] text-faint">engine: {result.analysis.engine} · {engineMs}ms round-trip</p>
                    <div className="grid grid-cols-3 gap-3 mt-5 w-full">
                      {([['Accuracy', result.analysis.accuracy], ['Clarity', result.analysis.clarity], ['Fluency', result.analysis.fluency]] as const).map(([label, v], i) => (
                        <div key={label} className="rounded-2xl border border-white/8 bg-white/[0.03] py-3 flex flex-col items-center">
                          <span className="font-display text-xl font-bold text-cream">{v.toFixed(0)}<span className="text-xs text-muted">%</span></span>
                          <span className="font-mono text-[0.55rem] uppercase tracking-[0.18em] text-faint mt-1">{label}</span>
                        </div>
                      ))}
                    </div>
                    {result.attempt.source === 'simulated' && (
                      <p className="mt-4 text-[0.65rem] font-mono text-amber/90 border border-amber/25 bg-amber/8 rounded-lg px-3 py-1.5">SIMULATED READ — microphone signal was empty or blocked.</p>
                    )}
                  </div>

                  <div className="glass-panel p-5 grid grid-cols-2 gap-4">
                    {[
                      { label: 'Pace', value: `${Math.round(result.analysis.wpm)}`, unit: 'WPM', note: result.analysis.wpm >= 120 && result.analysis.wpm <= 160 ? 'ideal band' : result.analysis.wpm > 160 ? 'too fast' : 'too slow' },
                      { label: 'Pauses', value: `${result.analysis.pause_count}`, unit: 'detected', note: `longest ${(result.analysis.longest_pause_ms / 1000).toFixed(2)}s` },
                      { label: 'Strong words', value: `${result.analysis.strong_words}`, unit: `of ${result.analysis.word_count}`, note: `${result.analysis.substitutions} substitutions` },
                      { label: 'Duration', value: `${(result.analysis.duration_ms / 1000).toFixed(1)}`, unit: 'seconds', note: `${result.analysis.deletions} missed words` },
                    ].map((s, i) => (
                      <div key={i} className="rounded-2xl border border-white/8 bg-gradient-to-br from-white/[0.04] to-transparent p-3.5">
                        <p className="font-mono text-[0.58rem] uppercase tracking-[0.2em] text-muted">{s.label}</p>
                        <p className="font-display text-[1.55rem] leading-none font-bold text-gold-grad mt-1.5">{s.value}<span className="text-[0.62rem] text-muted font-sans font-semibold ml-1">{s.unit}</span></p>
                        <p className="text-[0.62rem] text-faint mt-1">{s.note}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* ---- right: word table + tips ---- */}
                <div className="lg:col-span-3 flex flex-col gap-4">
                  <div className="glass-panel p-6">
                    <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                      <p className="panel-title">Word-by-word verdict</p>
                      <Link to={`/word-lab?attempt=${result.attempt.id}`} className="chip chip-gold hover:!bg-gold-500/20 transition-colors"><ScanText size={12} /> Replay & re-drill in Word Lab <ArrowRight size={11} /></Link>
                    </div>
                    <p className="text-[0.72rem] text-faint mb-4 font-mono">heard: “{heardText || result.attempt.heard || '—'}”</p>
                    <div className="flex flex-wrap gap-2">
                      {result.analysis.word_results.map((w, i) => {
                        const Icon = statusIcon[w.status];
                        const word = w.expected ?? w.heard ?? '';
                        return (
                          <span key={i} title={w.expected ? `score ${(w.score * 100).toFixed(0)}%${w.issue ? ' · issue: ' + w.issue : ''}${w.heard && w.heard !== w.expected ? ` · heard “${w.heard}”` : ''}` : `extra word “${w.heard}”`}
                            className={`inline-flex items-center gap-1.5 pl-2.5 pr-2 py-1.5 rounded-xl border text-[0.82rem] font-semibold cursor-default ${statusStyle[w.status]}`}>
                            <Icon size={13} />
                            {word}
                            {w.score < 0.74 && <span className="font-mono text-[0.6rem] opacity-80">{Math.round(w.score * 100)}</span>}
                          </span>
                        );
                      })}
                    </div>
                  </div>

                  <div className="glass-panel p-6">
                    <p className="panel-title mb-3 flex items-center gap-2"><Wand2 size={12} className="text-gold-400" /> Coach’s prescription</p>
                    <ul className="space-y-3">
                      {result.analysis.tips.map((tip, i) => (
                        <li key={i} className="flex gap-3 text-[0.83rem] leading-snug text-cream/85">
                          <span className="font-mono text-[0.68rem] text-gold-500 pt-0.5">0{i + 1}</span>{tip}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <button onClick={tryAgain} className="btn-gold"><RotateCcw size={17} /> Try this line again</button>
                    <Link to="/exercises" className="btn-violet">Target your weak sounds <ArrowRight size={16} /></Link>
                    <button onClick={nextSentence} className="btn-ghost">Next sentence <ChevronRight size={16} /></button>
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
