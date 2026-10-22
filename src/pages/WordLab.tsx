import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ScanText, Play, Pause, Repeat, Volume2, Mic2, Square, ChevronDown, CheckCircle2,
  AlertTriangle, XCircle, ArrowRight, RotateCcw, Headphones, Target, Trophy, Loader2, Wand2,
} from 'lucide-react';
import { api } from '../lib/api';
import { useSpeech } from '../lib/speech';
import { speakReference, saveRecording, loadRecordingUrl } from '../lib/audio';
import type { Attempt, WordMastery, WordResult } from '../lib/types';

const statusColor: Record<string, string> = {
  perfect: 'border-mint/40 bg-mint/10 text-mint',
  good: 'border-mint/25 bg-mint/5 text-[#a8f0c6]',
  shaky: 'border-amber/45 bg-amber/10 text-amber',
  missed: 'border-rose/45 bg-rose/10 text-rose',
  extra: 'border-violet-400/35 bg-violet-500/10 text-violet-300',
};
const StatusIcon = ({ s, size = 16 }: { s: string; size?: number }) =>
  s === 'perfect' || s === 'good' ? <CheckCircle2 size={size} /> : s === 'shaky' ? <AlertTriangle size={size} /> : <XCircle size={size} />;

function fmtTime(s: number) { const m = Math.floor(s / 60), r = s % 60; return `${m}:${r.toFixed(1).padStart(4, '0')}`; }

export default function WordLab() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [attemptId, setAttemptId] = useState<number | null>(null);
  const [selected, setSelected] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [currentMs, setCurrentMs] = useState(0);
  const [durationMs, setDurationMs] = useState(1);
  const [speed, setSpeed] = useState(1);
  const [loopCount, setLoopCount] = useState<1 | 3 | 10>(3);
  const [recordingUrl, setRecordingUrl] = useState<string | null>(null);
  const [hasAudio, setHasAudio] = useState(false);
  const [wordStats, setWordStats] = useState<WordMastery[]>([]);
  const [drillResult, setDrillResult] = useState<number | null>(null);
  const [drilling, setDrilling] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const sliceEndRef = useRef<number | null>(null);
  const loopRemainingRef = useRef(0);
  const chunksRef = useRef<Blob[]>([]);
  const drillRecorderRef = useRef<MediaRecorder | null>(null);
  const speedRef = useRef(speed);
  speedRef.current = speed;
  const simState = useRef<{ raf: number } | null>(null);

  /* simulated playback engine for attempts without a stored recording blob */
  const stopSim = useCallback(() => {
    if (simState.current) cancelAnimationFrame(simState.current.raf);
    simState.current = null;
  }, []);
  const runSim = useCallback((fromMs: number, toMs: number, loopsLeft: number) => {
    stopSim();
    const state = { raf: 0 };
    simState.current = state;
    const start = performance.now();
    const step = () => {
      if (simState.current !== state) return;
      const elapsed = performance.now() - start;
      const dur = Math.max(80, (toMs - fromMs) / speedRef.current);
      if (elapsed < dur) {
        setCurrentMs(fromMs + elapsed * speedRef.current);
        state.raf = requestAnimationFrame(step);
      } else if (loopsLeft > 1) {
        runSim(fromMs, toMs, loopsLeft - 1);
      } else {
        setCurrentMs(toMs);
        setPlaying(false);
        simState.current = null;
      }
    };
    state.raf = requestAnimationFrame(step);
    setPlaying(true);
  }, [stopSim]);
  useEffect(() => stopSim, [stopSim]);

  /* ---------- data loading ---------- */
  useEffect(() => {
    api.attempts(40).then((d) => {
      const usable = d.attempts.filter((a) => a.timings.length > 0);
      setAttempts(usable);
      const fromUrl = Number(searchParams.get('attempt'));
      const pick = usable.find((a) => a.id === fromUrl) ?? usable[0];
      if (pick) setAttemptId(pick.id);
    }).catch(() => undefined);
    api.words().then((d) => setWordStats(d.words)).catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const attempt = attempts.find((a) => a.id === attemptId) ?? null;
  const words: WordResult[] = useMemo(() => attempt?.word_results.filter((w) => w.expected) ?? [], [attempt]);
  const timings = attempt?.timings ?? [];
  const selectedResult = words[selected];
  const selectedTiming = timings[selected] ?? null;

  useEffect(() => { setSelected(0); setDrillResult(null); }, [attemptId]);

  /* ---------- audio element ---------- */
  useEffect(() => {
    let revoked: string | null = null;
    setHasAudio(false);
    setRecordingUrl(null);
    if (!attempt) return;
    loadRecordingUrl(`attempt-${attempt.id}`).then((url) => {
      if (url) {
        revoked = url;
        setRecordingUrl(url);
        setHasAudio(true);
      } else {
        setDurationMs(attempt.duration_ms);
      }
    });
    return () => { if (revoked) URL.revokeObjectURL(revoked); };
  }, [attempt]);

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    const onMeta = () => setDurationMs((el.duration || attempt?.duration_ms || 1) * 1000);
    const onTime = () => {
      setCurrentMs(el.currentTime * 1000);
      const end = sliceEndRef.current;
      if (end != null && el.currentTime >= end) {
        el.pause();
        if (loopRemainingRef.current > 1) {
          loopRemainingRef.current -= 1;
          const start = selectedTiming ? selectedTiming.start_ms / 1000 : 0;
          el.currentTime = start;
          el.play().catch(() => undefined);
        } else {
          sliceEndRef.current = null;
          setPlaying(false);
        }
      }
    };
    const onEnd = () => setPlaying(false);
    el.addEventListener('loadedmetadata', onMeta);
    el.addEventListener('timeupdate', onTime);
    el.addEventListener('ended', onEnd);
    return () => {
      el.removeEventListener('loadedmetadata', onMeta);
      el.removeEventListener('timeupdate', onTime);
      el.removeEventListener('ended', onEnd);
    };
  }, [recordingUrl, attempt, selectedTiming]);

  /* ---------- transport controls ---------- */
  const togglePlayAll = () => {
    const el = audioRef.current;
    if (!el) {
      if (playing) { stopSim(); setPlaying(false); return; }
      if (selectedTiming) runSim(selectedTiming.start_ms, selectedTiming.end_ms, 1);
      else if (timings.length) { runSim(0, timings[timings.length - 1].end_ms, 1); speakReference(attempt?.sentence ?? ''); }
      return;
    }
    if (el.paused) { sliceEndRef.current = null; el.playbackRate = speed; el.play().catch(() => undefined); setPlaying(true); }
    else { el.pause(); setPlaying(false); }
  };

  const replaySelection = useCallback((count = 1) => {
    const el = audioRef.current;
    if (!el) {
      // no stored blob: sweep the timing cursor + speak the word with the reference voice
      if (selectedTiming) runSim(selectedTiming.start_ms, selectedTiming.end_ms, count);
      if (selectedResult?.expected) {
        setSpeaking(true);
        const speakN = Math.min(count, 3);
        (async () => {
          const word = selectedResult?.expected;
          if (word) for (let i = 0; i < speakN; i++) await speakReference(word);
          setSpeaking(false);
        })();
      }
      return;
    }
    if (!selectedTiming) return;
    sliceEndRef.current = selectedTiming.end_ms / 1000;
    loopRemainingRef.current = count;
    el.pause();
    el.playbackRate = speedRef.current;
    el.currentTime = selectedTiming.start_ms / 1000;
    el.play().catch(() => undefined);
    setPlaying(true);
  }, [selectedTiming, selectedResult, runSim]);

  const seek = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = audioRef.current;
    const rect = e.currentTarget.getBoundingClientRect();
    const frac = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    const targetMs = durationMs * frac;
    if (el) { el.currentTime = targetMs / 1000; setCurrentMs(targetMs); }
    else setCurrentMs(targetMs);
  };

  const hearReferenceWord = async () => {
    if (!selectedResult?.expected) return;
    setSpeaking(true);
    try { await speakReference(selectedResult.expected); } finally { setSpeaking(false); }
  };

  /* ---------- word-level drill (record → analyze) ---------- */
  const { phase: drillPhase, levels, start: startDrill, stop: stopDrill, reset: resetDrill, supported } = useSpeech({
    onResult: useCallback(async (heard: string, durationMs: number) => {
      if (!attempt || !selectedResult?.expected) return;
      setDrilling(true);
      try {
        const res = await api.analyze({
          expected: selectedResult.expected,
          heard: heard.trim() || selectedResult.expected,
          duration_ms: Math.max(300, Math.round(durationMs)),
          pauses: [],
          exercise_id: 'wordlab',
          source: 'wordlab',
        });
        setDrillResult(res.analysis.accuracy);
        api.words().then((d) => setWordStats(d.words)).catch(() => undefined);
        // persist drill audio and play it back immediately
        if (chunksRef.current.length) {
          const blob = new Blob(chunksRef.current, { type: chunksRef.current[0]?.type || 'audio/webm' });
          if (blob.size > 200) {
            const url = URL.createObjectURL(blob);
            const a = new Audio(url);
            a.play().catch(() => undefined);
          }
          chunksRef.current = [];
        }
      } finally { setDrilling(false); }
    }, [attempt, selectedResult]),
  });

  const drillActive = drillPhase === 'listening';
  const beginDrill = async () => {
    setDrillResult(null);
    chunksRef.current = [];
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      mr.ondataavailable = (e) => { if (e.data.size) chunksRef.current.push(e.data); };
      mr.start(200);
      drillRecorderRef.current = mr;
    } catch { drillRecorderRef.current = null; }
    startDrill();
  };
  const endDrill = () => {
    try { drillRecorderRef.current?.stop(); drillRecorderRef.current?.stream.getTracks().forEach((t) => t.stop()); } catch { /* noop */ }
    stopDrill();
  };

  /* ---------- keyboard shortcuts ---------- */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT') return;
      if (e.key === 'ArrowRight') setSelected((s) => Math.min(words.length - 1, s + 1));
      else if (e.key === 'ArrowLeft') setSelected((s) => Math.max(0, s - 1));
      else if (e.key === 'r' || e.key === 'R') replaySelection(1);
      else if (e.key === 'l' || e.key === 'L') replaySelection(loopCount);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [words.length, replaySelection, loopCount]);

  const mastery = wordStats.find((w) => w.word === selectedResult?.expected);
  const selectedScore = selectedResult ? Math.round(selectedResult.score * 100) : 0;
  const delta = drillResult != null && selectedResult ? Math.round(drillResult - selectedResult.score * 100) : null;

  /* ================= render ================= */
  if (!attempts.length) {
    return (
      <div className="max-w-3xl mx-auto px-6 py-24 text-center">
        <Loader2 className="animate-spin text-gold-400 mx-auto" size={30} />
        <p className="text-muted mt-4">Loading your recordings from the database…</p>
        <Link to="/practice" className="btn-gold mt-6 inline-flex">Go make your first attempt <ArrowRight size={16} /></Link>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 md:py-12">
      {/* ======= header + attempt selector ======= */}
      <div className="flex flex-wrap items-end justify-between gap-5 mb-6">
        <div>
          <p className="panel-title flex items-center gap-2"><ScanText size={12} className="text-gold-400" /> Signature · Word-level replay</p>
          <h1 className="font-display text-3xl sm:text-4xl font-black text-cream mt-2">The <span className="text-gold-grad">Word Lab</span></h1>
          <p className="text-muted text-[0.88rem] mt-2 max-w-md leading-relaxed">Tap any word, replay just its slice of your voice, compare against the reference — then drill it in isolation until it’s muscle memory.</p>
        </div>
        <div className="relative">
          <label className="panel-title mb-1.5 block" htmlFor="attempt-select">Attempt recording</label>
          <div className="relative">
            <select id="attempt-select" value={attemptId ?? ''} onChange={(e) => { const id = Number(e.target.value); setAttemptId(id); setSearchParams({ attempt: String(id) }, { replace: true }); }}
              className="appearance-none bg-panel border border-white/12 rounded-xl pl-4 pr-10 py-2.5 text-[0.82rem] text-cream max-w-[320px] truncate focus:border-gold-500/50 outline-none cursor-pointer">
              {attempts.map((a) => (
                <option key={a.id} value={a.id}>#{a.id} · {a.overall.toFixed(0)}% · {new Date(a.created_at.replace(' ', 'T') + 'Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} — {a.sentence.slice(0, 42)}…</option>
              ))}
            </select>
            <ChevronDown size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
          </div>
        </div>
      </div>

      {attempt && (
        <div className="grid lg:grid-cols-5 gap-6">
          {/* ======= LEFT: sentence dissected ======= */}
          <div className="lg:col-span-3 flex flex-col gap-4">
            <div className="glass-panel p-6 sm:p-7">
              <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                <p className="panel-title">Tap a word · ← → keys navigate · R replays</p>
                <span className={`chip ${attempt.overall >= 85 ? 'chip-green' : 'chip-gold'}`}><Trophy size={11} /> Attempt #{attempt.id} · {Math.round(attempt.overall)}%</span>
              </div>

              {/* word chips */}
              <div className="flex flex-wrap gap-x-1.5 gap-y-3">
                {words.map((w, i) => {
                  const active = i === selected;
                  const score = Math.round(w.score * 100);
                  return (
                    <button key={i} onClick={() => { setSelected(i); setDrillResult(null); }}
                      className={`relative rounded-xl border px-3 pt-1.5 pb-2 transition-all duration-200 ${statusColor[w.status]} ${active ? 'ring-2 ring-gold-400 ring-offset-2 ring-offset-[#221334] scale-[1.07] shadow-[0_6px_24px_rgba(245,179,1,.25)] z-10' : 'hover:scale-[1.04]'}`}
                      aria-pressed={active}>
                      <span className="font-semibold text-[0.95rem] sm:text-base">{w.expected}</span>
                      <span className="block font-mono text-[0.55rem] opacity-85">{score}{w.heard && w.heard.toLowerCase() !== w.expected?.toLowerCase() ? ` · “${w.heard.toLowerCase()}”` : ''}</span>
                    </button>
                  );
                })}
              </div>

              {/* legend */}
              <div className="flex flex-wrap gap-3 mt-5 text-[0.62rem] font-mono text-muted">
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-mint/70" /> squeaky clean</span>
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-amber/80" /> shaky — worth a drill</span>
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-rose/80" /> missed or substituted</span>
              </div>

              {/* ======= audio transport ======= */}
              <div className="mt-6 pt-5 border-t border-white/6">
                {hasAudio && <audio ref={audioRef} src={recordingUrl ?? undefined} preload="auto" className="hidden" />}
                {!hasAudio && <p className="text-[0.7rem] text-amber/90 font-mono mb-3">No microphone blob was stored for this attempt (seeded or simulated) — word replay will use the reference voice and syllable-weighted timing.</p>}
                <div className="flex items-center gap-4">
                  <button onClick={togglePlayAll} className="w-12 h-12 rounded-full btn-ghost !p-0 flex items-center justify-center shrink-0" aria-label={playing ? 'Pause' : 'Play full attempt'}>
                    {playing ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" className="ml-0.5" />}
                  </button>
                  {/* seek bar with word boundary ticks */}
                  <div className="flex-1">
                    <div className="relative h-9 cursor-pointer group" onClick={seek} role="slider" aria-label="Seek within recording" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round((currentMs / durationMs) * 100)} tabIndex={0}>
                      <div className="absolute top-1/2 -translate-y-1/2 h-2 w-full rounded-full bg-panel-3 overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-gold-400 via-gold-500 to-violet-500 rounded-full" style={{ width: `${(currentMs / durationMs) * 100}%` }} />
                      </div>
                      {timings.map((t, i) => (
                        <span key={i} className={`absolute top-1/2 -translate-y-1/2 w-px h-4 ${i === selected ? 'bg-gold-300' : 'bg-white/15'}`} style={{ left: `${(t.start_ms / durationMs) * 100}%` }} />
                      ))}
                      <span className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3.5 h-3.5 rounded-full bg-gold-300 border-2 border-[#241203] shadow-[0_0_8px_rgba(255,216,77,.7)]" style={{ left: `${(currentMs / durationMs) * 100}%` }} />
                    </div>
                    <div className="flex justify-between font-mono text-[0.6rem] text-faint mt-0.5">
                      <span>{fmtTime(currentMs / 1000)}</span>
                      <span>speed {speed.toFixed(2)}×</span>
                      <span>{fmtTime(durationMs / 1000)}</span>
                    </div>
                  </div>
                  {/* speed control */}
                  <input type="range" min={0.6} max={1.4} step={0.1} value={speed} onChange={(e) => {
                    const v = Number(e.target.value); setSpeed(v);
                    if (audioRef.current) audioRef.current.playbackRate = v;
                    e.target.style.setProperty('--fill', `${((v - 0.6) / 0.8) * 100}%`);
                  }} className="cv-range w-20 sm:w-24 shrink-0" aria-label="Playback speed" style={{ ['--fill' as string]: `${((speed - 0.6) / 0.8) * 100}%` }} />
                </div>
              </div>
            </div>

            {/* ======= replay controls for the selected word ======= */}
            <div className="glass-panel p-5 flex flex-wrap items-center gap-3">
              <button onClick={() => replaySelection(1)} className="btn-gold !py-2.5"><Play size={15} fill="currentColor" /> Replay “{selectedResult?.expected}”</button>
              <button onClick={() => replaySelection(loopCount)} className="btn-ghost !py-2.5"><Repeat size={15} /> Loop ×{loopCount}</button>
              <div className="flex items-center gap-1.5 text-[0.7rem] font-mono text-muted">
                loop:{[1, 3, 10].map((n) => (
                  <button key={n} onClick={() => setLoopCount(n as 1 | 3 | 10)} className={`w-8 h-7 rounded-md border ${loopCount === n ? 'border-gold-500/60 text-gold-300 bg-gold-500/12' : 'border-white/10 text-faint'}`}>{n}</button>
                ))}
              </div>
              <button onClick={hearReferenceWord} className="btn-violet !py-2.5 ml-auto">{speaking ? <Loader2 size={15} className="animate-spin" /> : <Volume2 size={15} />} Reference</button>
            </div>
          </div>

          {/* ======= RIGHT: the verdict + drill dock ======= */}
          <div className="lg:col-span-2 flex flex-col gap-4">
            {/* verdict card */}
            <div className="glass-panel p-6">
              <p className="panel-title mb-3">Verdict · word {selected + 1} of {words.length}</p>
              <div className="flex items-center gap-5">
                {/* mini score dial */}
                <div className="relative w-24 h-24 shrink-0">
                  <svg viewBox="0 0 96 96" className="w-24 h-24 -rotate-90">
                    <circle cx="48" cy="48" r="40" stroke="#2e1e47" strokeWidth="10" fill="none" />
                    <circle cx="48" cy="48" r="40" stroke={selectedScore >= 74 ? '#34d399' : selectedScore >= 45 ? '#fbbf24' : '#fb7185'} strokeWidth="10" fill="none" strokeLinecap="round"
                      strokeDasharray={`${(selectedScore / 100) * 251.3} 251.3`} style={{ transition: 'stroke-dasharray .8s cubic-bezier(.22,1,.36,1)', filter: 'drop-shadow(0 0 6px rgba(52,211,153,.35))' }} />
                  </svg>
                  <span className="absolute inset-0 flex flex-col items-center justify-center"><span className="font-display text-xl font-black text-cream">{selectedScore}</span><span className="font-mono text-[0.5rem] text-muted">/ 100</span></span>
                </div>
                <div className="min-w-0">
                  <p className="font-display text-2xl font-bold text-cream truncate">{selectedResult?.expected}</p>
                  <p className={`inline-flex items-center gap-1.5 mt-1.5 text-[0.75rem] font-bold uppercase tracking-wider ${selectedScore >= 74 ? 'text-mint' : selectedScore >= 45 ? 'text-amber' : 'text-rose'}`}>
                    <StatusIcon s={selectedResult?.status ?? 'missed'} size={13} /> {selectedResult?.status === 'perfect' ? 'Flawless' : selectedResult?.status}
                  </p>
                  {selectedResult?.heard && selectedResult.heard.toLowerCase() !== selectedResult.expected?.toLowerCase() && (
                    <p className="text-[0.72rem] text-muted mt-1.5">you said <span className="text-amber font-mono">“{selectedResult.heard}”</span></p>
                  )}
                  {selectedResult?.issue && <p className="text-[0.68rem] font-mono text-faint mt-1">issue class: {selectedResult.issue}</p>}
                </div>
              </div>

              {mastery && (
                <div className="mt-4 pt-4 border-t border-white/6 flex items-center justify-between gap-3">
                  <div>
                    <p className="font-mono text-[0.55rem] uppercase tracking-[0.2em] text-muted">Lifetime mastery of “{mastery.word}”</p>
                    <p className="text-[0.8rem] text-cream mt-1"><span className="font-bold">{mastery.accuracy}%</span> across {mastery.attempts} attempt{mastery.attempts === 1 ? '' : 's'}</p>
                  </div>
                  <div className="w-28 h-2 rounded-full bg-panel-2 overflow-hidden"><div className="h-full bg-gradient-to-r from-violet-400 to-gold-400 rounded-full" style={{ width: `${mastery.accuracy}%` }} /></div>
                </div>
              )}
            </div>

            {/* drill dock */}
            <div className="glass-panel p-6 relative overflow-hidden">
              <div className="absolute -top-16 -right-16 w-48 h-48 rounded-full bg-gold-500/8 blur-3xl" aria-hidden="true" />
              <p className="panel-title flex items-center gap-2 mb-1"><Target size={12} className="text-gold-400" /> Micro-drill · say it once, clean</p>
              <p className="text-[0.8rem] text-muted mb-4">Isolate <span className="text-cream font-semibold">“{selectedResult?.expected}”</span>. Exaggerate the stressed syllable, then find natural speed.</p>

              {/* drill waveform */}
              <div className="h-14 flex items-center gap-[3px] mb-3" aria-hidden="true">
                {levels.map((v, i) => (
                  <div key={i} className="eq-bar flex-1 min-w-[3px] rounded-full" style={{ height: `${Math.max(5, v * 100)}%`, background: drillActive ? 'linear-gradient(180deg,#ffd84d,#f5b301 60%,#8b5cf6)' : 'linear-gradient(180deg,#3a2653,#33204c)', animationDelay: `${(i % 10) * 0.08}s`, animationPlayState: drillActive ? 'running' : 'paused' }} />
                ))}
              </div>

              <div className="flex items-center gap-3">
                <button onClick={drillActive ? endDrill : beginDrill} disabled={drilling || !supported}
                  className={`w-14 h-14 rounded-full shrink-0 flex items-center justify-center transition-all ${drillActive ? 'record-live bg-gradient-to-br from-rose to-[#be123d]' : 'btn-gold !rounded-full !p-0'}`}
                  aria-label={drillActive ? 'Stop drill' : 'Record drill'}>
                  {drilling ? <Loader2 size={20} className="animate-spin" /> : drillActive ? <Square size={18} fill="#fff" className="text-white" /> : <Mic2 size={21} />}
                </button>
                <div className="flex-1">
                  {drillResult != null ? (
                    <motion.div initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }}>
                      <p className="font-display text-lg font-bold text-cream">Drill score: <span className={drillResult >= 74 ? 'text-mint' : drillResult >= 45 ? 'text-amber' : 'text-rose'}>{Math.round(drillResult)}%</span>
                        {delta != null && <span className={`ml-2 text-sm font-sans font-bold ${delta >= 0 ? 'text-mint' : 'text-rose'}`}>{delta >= 0 ? '▲' : '▼'} {Math.abs(delta)} pts vs read</span>}
                      </p>
                      <button onClick={() => { setDrillResult(null); resetDrill(); }} className="text-[0.7rem] font-mono text-violet-300 hover:text-violet-200 mt-0.5 inline-flex items-center gap-1"><RotateCcw size={11} /> drill once more</button>
                    </motion.div>
                  ) : (
                    <p className="text-[0.75rem] text-muted">{supported ? (drillActive ? 'Listening… say the word one time, clearly.' : 'One clean repetition. That is the whole drill.') : 'Microphone required — enable it to run drills.'}</p>
                  )}
                </div>
              </div>
            </div>

            {/* weak-word queue */}
            <div className="glass-panel p-5">
              <p className="panel-title flex items-center gap-2 mb-3"><Wand2 size={12} className="text-gold-400" /> Words queuing for mastery</p>
              <div className="flex flex-wrap gap-1.5">
                {wordStats.filter((w) => w.attempts > 0).sort((a, b) => a.accuracy - b.accuracy).slice(0, 6).map((w) => (
                  <button key={w.id} onClick={() => {
                    const idx = words.findIndex((x) => x.expected === w.word);
                    if (idx >= 0) setSelected(idx);
                  }} className="inline-flex items-center gap-1.5 rounded-lg border border-amber/25 bg-amber/8 px-2.5 py-1.5 text-[0.72rem] font-semibold text-amber hover:bg-amber/15 transition-colors" title="Jump to this word in the reading">
                    {w.word} <span className="font-mono text-[0.6rem] opacity-80">{w.accuracy}%</span>
                  </button>
                ))}
                {wordStats.filter((w) => w.attempts > 0).length === 0 && <p className="text-[0.75rem] text-muted">No weak words detected yet — gorgeous.</p>}
              </div>
              <Link to="/progress" className="mt-4 inline-flex items-center gap-1.5 text-[0.72rem] font-semibold text-violet-300 hover:text-violet-200">View full mastery dashboard <ArrowRight size={12} /></Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
