/**
 * useSpeech — microphone capture, live waveform analysis, pause detection,
 * Web Speech API transcription, and (deterministic) simulated latency when
 * speech recognition is unavailable.
 */
import { useCallback, useEffect, useRef, useState } from 'react';

export type SpeechPhase = 'idle' | 'listening' | 'processing' | 'done' | 'error';

export interface PauseMark { start_ms: number; end_ms: number; }

interface Options {
  onResult: (heard: string, durationMs: number, pauses: PauseMark[]) => void;
}

const SPEECH_RECOGNITION =
  typeof window !== 'undefined' ? (window.SpeechRecognition ?? window.webkitSpeechRecognition) : undefined;

export function useSpeech({ onResult }: Options) {
  const [phase, setPhase] = useState<SpeechPhase>('idle');
  const [levels, setLevels] = useState<number[]>(() => new Array(48).fill(0.04));
  const [elapsedMs, setElapsedMs] = useState(0);
  const [supported] = useState<boolean>(!!SPEECH_RECOGNITION);
  const [interim, setInterim] = useState('');
  const [error, setError] = useState<string | null>(null);

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number>(0);
  const startedAtRef = useRef<number>(0);
  const heardRef = useRef('');
  const interimRef = useRef('');
  const pausesRef = useRef<PauseMark[]>([]);
  const silenceStartRef = useRef<number | null>(null);
  const doneRef = useRef(false);
  const timerRef = useRef<number>(0);

  const cleanup = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    window.clearInterval(timerRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    audioCtxRef.current?.close().catch(() => undefined);
    audioCtxRef.current = null;
    analyserRef.current = null;
    if (recognitionRef.current) {
      recognitionRef.current.onend = null;
      try { recognitionRef.current.abort(); } catch { /* already stopped */ }
      recognitionRef.current = null;
    }
  }, []);

  useEffect(() => cleanup, [cleanup]);

  const start = useCallback(async () => {
    setError(null);
    heardRef.current = '';
    interimRef.current = '';
    pausesRef.current = [];
    silenceStartRef.current = null;
    doneRef.current = false;
    setInterim('');
    setElapsedMs(0);

    // 1) Microphone + analyser for the live waveform & pause detection
    let analyser: AnalyserNode | null = null;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const ctx = new AudioContext();
      const source = ctx.createMediaStreamSource(stream);
      analyser = ctx.createAnalyser();
      analyser.fftSize = 128;
      analyser.smoothingTimeConstant = 0.78;
      source.connect(analyser);
      audioCtxRef.current = ctx;
      analyserRef.current = analyser;
    } catch {
      setPhase('error');
      setError('Microphone access was denied. Allow the mic in your browser, or run a Simulation read.');
      return;
    }

    // 2) Waveform render + silence/pause tracking
    const data = new Uint8Array(analyser.frequencyBinCount);
    const startedAt = performance.now();
    startedAtRef.current = startedAt;
    const tick = () => {
      if (!analyserRef.current) return;
      analyserRef.current.getByteFrequencyData(data);
      // bucket into 48 bars
      const bars: number[] = [];
      const step = data.length / 48;
      for (let i = 0; i < 48; i++) {
        let sum = 0;
        for (let j = Math.floor(i * step); j < Math.floor((i + 1) * step); j++) sum += data[j];
        const v = sum / (step * 255);
        // gentle lift on quiet rooms so bars breathe
        bars.push(Math.min(1, Math.max(0.045, v * 1.35 + (v > 0.02 ? 0.05 : 0))));
      }
      setLevels(bars);

      // overall level for pause detection
      const avg = data.reduce((s, v) => s + v, 0) / data.length / 255;
      const now = performance.now() - startedAt;
      if (avg < 0.055) {
        if (silenceStartRef.current == null) silenceStartRef.current = now;
        else if (now - silenceStartRef.current > 520 && !pausesRef.current.some((p) => p.start_ms === Math.round(silenceStartRef.current!))) {
          // record pause once it crosses 520 ms; finalize on sound resumption/stop
          const s = silenceStartRef.current;
          if (!pausesRef.current.find((p) => p.start_ms === Math.round(s))) {
            pausesRef.current.push({ start_ms: Math.round(s), end_ms: Math.round(now) });
          }
        }
      } else {
        if (silenceStartRef.current != null) {
          const s = silenceStartRef.current;
          const last = pausesRef.current[pausesRef.current.length - 1];
          if (last && Math.abs(last.start_ms - Math.round(s)) < 60) {
            last.end_ms = Math.round(now);
          } else if (now - s > 240) {
            pausesRef.current.push({ start_ms: Math.round(s), end_ms: Math.round(now) });
          }
          silenceStartRef.current = null;
        }
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    tick();

    timerRef.current = window.setInterval(() => {
      setElapsedMs(performance.now() - startedAt);
    }, 100);

    // 3) Speech recognition
    if (SPEECH_RECOGNITION) {
      const rec = new SPEECH_RECOGNITION();
      rec.lang = 'en-US';
      rec.continuous = true;
      rec.interimResults = true;
      rec.maxAlternatives = 3;
      rec.onresult = (event: SpeechRecognitionEvent) => {
        let finalChunk = '';
        let interimChunk = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const res = event.results[i];
          const alt = res[0];
          if (res.isFinal) finalChunk += alt.transcript + ' ';
          else interimChunk += alt.transcript;
        }
        if (finalChunk) heardRef.current += finalChunk;
        interimRef.current = interimChunk;
        setInterim((heardRef.current + interimChunk).trim());
      };
      rec.onerror = () => { /* fall through — finalize with whatever we have */ };
      rec.onend = () => {
        if (doneRef.current) return;
        doneRef.current = true;
        finish();
      };
      recognitionRef.current = rec;
      try { rec.start(); } catch { /* already started */ }
    }

    setPhase('listening');
    // auto-stop after 14s so sessions never hang
    window.setTimeout(() => { if (recognitionRef.current) stop(); }, 14000);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const finish = useCallback(() => {
    cleanup();
    setLevels(new Array(48).fill(0.04));
    const heard = (heardRef.current + ' ' + interimRef.current).trim();
    const duration = Math.round(performance.now() - startedAtRef.current);
    // close any trailing silence pause
    if (silenceStartRef.current != null) {
      pausesRef.current.push({ start_ms: Math.round(silenceStartRef.current), end_ms: duration });
    }
    const pauses = pausesRef.current.filter((p) => p.end_ms - p.start_ms >= 240);
    setPhase('processing');
    setInterim('');
    onResult(heard, duration, pauses);
  }, [cleanup, onResult]);

  const stop = useCallback(() => {
    if (doneRef.current) return;
    doneRef.current = true;
    setPhase('processing');
    cleanup();
    setLevels(new Array(48).fill(0.04));
    const heard = (heardRef.current + ' ' + interimRef.current).trim();
    const duration = Math.round(performance.now() - startedAtRef.current);
    if (silenceStartRef.current != null) {
      pausesRef.current.push({ start_ms: Math.round(silenceStartRef.current), end_ms: duration });
    }
    const pauses = pausesRef.current.filter((p) => p.end_ms - p.start_ms >= 240);
    setElapsedMs(duration);
    onResult(heard, duration, pauses);
  }, [cleanup, onResult]);

  const reset = useCallback(() => {
    cleanup();
    setPhase('idle');
    setLevels(new Array(48).fill(0.04));
    setElapsedMs(0);
    setInterim('');
    setError(null);
  }, [cleanup]);

  return { phase, setPhase, levels, elapsedMs, interim, error, supported, start, stop, reset };
}
