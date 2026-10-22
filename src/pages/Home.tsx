import { Link, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Mic2, Play, ArrowRight, Flame, Sparkles, AudioWaveform, Crosshair,
  Gauge, Timer, ShieldCheck, BadgeCheck, Quote, ScanText, ChevronRight, Zap,
} from 'lucide-react';
import { api } from '../lib/api';
import type { SummaryStats } from '../lib/types';
import { ScoreRing } from '../components/ScoreRing';
import { CountUp } from '../components/CountUp';
import { speakReference } from '../lib/audio';

const DEMO = 'The thorough analysis requires extraordinary attention to detail.';

export default function Home() {
  const navigate = useNavigate();
  const [summary, setSummary] = useState<SummaryStats | null>(null);
  const [playingDemo, setPlayingDemo] = useState(false);

  useEffect(() => { api.summary().then(setSummary).catch(() => undefined); }, []);

  const playDemo = async () => {
    setPlayingDemo(true);
    try { await speakReference(DEMO); } finally { setPlayingDemo(false); }
  };

  return (
    <div className="relative">
      {/* ============ HERO ============ */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 pt-8 md:pt-14 pb-16">
        <div className="grid lg:grid-cols-12 gap-8 lg:gap-10 items-center">
          {/* copy */}
          <div className="lg:col-span-6 relative z-10">
            <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }}>
              <div className="flex flex-wrap items-center gap-2 mb-5">
                <span className="chip chip-gold"><Sparkles size={12} /> Intermediate · B1–B2</span>
                <span className="chip"><ShieldCheck size={12} /> Phonetic AI Engine</span>
              </div>
              <h1 className="font-display font-black tracking-tight leading-[0.98] text-[2.6rem] sm:text-6xl xl:text-[4.35rem] text-cream">
                Speak English<br />
                <span className="text-gold-grad italic">brilliantly.</span><br />
                Be heard <span className="text-violet-grad">clearly.</span>
              </h1>
              <p className="mt-6 text-[1.02rem] text-muted leading-relaxed max-w-md">
                The AI speech-clarity studio that listens to <em className="text-cream not-italic font-semibold">every word you say</em> — scores it,
                shows you exactly which sounds slipped, and trains the precise muscle until fluency feels inevitable.
              </p>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.15 }}
              className="mt-8 flex flex-wrap items-center gap-3">
              <Link to="/practice" className="btn-gold text-[0.95rem] !px-7 !py-3.5">
                <Mic2 size={18} strokeWidth={2.4} /> Start speaking — it’s free
              </Link>
              <button onClick={playDemo} className="btn-ghost" disabled={playingDemo}>
                {playingDemo ? <AudioWaveform size={17} className="animate-pulse" /> : <Play size={17} fill="currentColor" />}
                {playingDemo ? 'Playing reference…' : 'Hear the coach'}
              </button>
            </motion.div>

            {/* trust strip */}
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.35, duration: 0.8 }}
              className="mt-8 flex items-center gap-4 text-[0.72rem] text-muted">
              <div className="flex -space-x-2.5">
                {['AK', 'JM', 'RS', 'TW'].map((n, i) => (
                  <span key={i} className="w-8 h-8 rounded-full border-2 border-ink flex items-center justify-center text-[0.55rem] font-bold text-[#241203]"
                    style={{ background: ['#ffd84d', '#a78bfa', '#ffd84d', '#8b5cf6'][i], color: i % 2 ? '#241203' : '#2a1a02' }}>{n}</span>
                ))}
              </div>
              <p><span className="text-cream font-bold font-mono">48,200+</span> learners · <span className="text-cream font-bold font-mono">2.1M</span> sentences scored</p>
            </motion.div>
          </div>

          {/* coach portrait composition */}
          <motion.div
            initial={{ opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.9, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
            className="lg:col-span-6 relative h-[420px] sm:h-[500px] lg:h-[560px]">
            {/* halo rings */}
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 spin-slow opacity-60" aria-hidden="true">
              <svg width="440" height="440" viewBox="0 0 440 440" className="sm:w-[520px] sm:h-[520px]">
                <circle cx="220" cy="220" r="168" fill="none" stroke="url(#halo)" strokeWidth="1.4" strokeDasharray="4 10" />
                <circle cx="220" cy="220" r="208" fill="none" stroke="#8b5cf6" strokeOpacity="0.35" strokeWidth="1" strokeDasharray="1 14" />
                <defs><linearGradient id="halo" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#ffd84d" /><stop offset="1" stopColor="#8b5cf6" /></linearGradient></defs>
              </svg>
            </div>

            <img src="/images/coach-avatar.png" alt="ClearVoice AI reference voice coach"
              className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-[330px] sm:h-[410px] lg:h-[470px] w-auto rounded-[2.2rem] object-cover
              [mask-image:radial-gradient(ellipse_72%_78%_at_50%_44%,black_62%,transparent_98%)]" />

            {/* floating stat cards */}
            <motion.div animate={{ y: [0, -14, 0] }} transition={{ duration: 4.6, repeat: Infinity, ease: 'easeInOut' }}
              className="absolute top-6 right-0 sm:right-2 glass-panel px-4 py-3 w-[172px] shadow-2xl">
              <p className="panel-title !text-[0.55rem]">Clarity score</p>
              <p className="font-display text-3xl font-black text-gold-grad mt-1">94<span className="text-lg align-top">%</span></p>
              <div className="mt-1.5 h-1.5 rounded-full bg-panel-2 overflow-hidden"><div className="h-full w-[94%] bg-gradient-to-r from-gold-400 to-gold-600 rounded-full" /></div>
            </motion.div>

            <motion.div animate={{ y: [0, 12, 0] }} transition={{ duration: 5.2, repeat: Infinity, ease: 'easeInOut', delay: 0.8 }}
              className="absolute bottom-24 -left-1 sm:left-2 glass-panel px-4 py-3 w-[186px]">
              <p className="panel-title !text-[0.55rem]">Speaking pace</p>
              <p className="font-display text-2xl font-bold text-cream mt-0.5">142 <span className="text-xs text-muted font-sans font-medium">WPM</span></p>
              <p className="text-[0.62rem] font-mono text-mint mt-1">▲ inside ideal 120–160 band</p>
            </motion.div>

            <motion.div animate={{ y: [0, -10, 0] }} transition={{ duration: 4.2, repeat: Infinity, ease: 'easeInOut', delay: 1.6 }}
              className="absolute bottom-2 right-2 sm:right-8 glass-panel px-4 py-2.5 flex items-center gap-2.5">
              <span className="w-8 h-8 rounded-full bg-mint/15 border border-mint/30 flex items-center justify-center"><BadgeCheck size={16} className="text-mint" /></span>
              <span><span className="block text-[0.72rem] font-bold text-cream">extraordinary</span><span className="block text-[0.6rem] font-mono text-muted">word mastered · +25 XP</span></span>
            </motion.div>

            <div className="absolute top-16 left-1 sm:left-6 float-y" aria-hidden="true">
              <Sparkles size={22} className="text-gold-400 drop-shadow-[0_0_8px_rgba(255,216,77,.8)]" />
            </div>
          </motion.div>
        </div>
      </section>

      {/* ============ TICKER ============ */}
      <div className="relative border-y border-white/6 bg-[#170d24]/80 backdrop-blur-md py-2.5 overflow-hidden">
        <div className="marquee-track flex gap-10 font-mono text-[0.7rem] tracking-[0.18em] text-muted uppercase whitespace-nowrap">
          {[...Array(2)].map((_, k) => (
            <span key={k} className="flex gap-10">
              <span>Phonetic alignment</span><span className="text-gold-500">◆</span>
              <span>Word-level replay</span><span className="text-gold-500">◆</span>
              <span>WPM prosody model</span><span className="text-gold-500">◆</span>
              <span>Pause detection</span><span className="text-gold-500">◆</span>
              <span>Schwa reduction</span><span className="text-gold-500">◆</span>
              <span>Minimal pairs</span><span className="text-gold-500">◆</span>
              <span>Thought groups</span><span className="text-gold-500">◆</span>
              <span>Stress timing</span><span className="text-gold-500">◆</span>
            </span>
          ))}
        </div>
      </div>

      {/* ============ LIVE SNAPSHOT (real DB stats) ============ */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-14">
        <div className="flex items-end justify-between gap-4 mb-6 flex-wrap">
          <div>
            <p className="panel-title mb-2 flex items-center gap-2"><Zap size={12} className="text-gold-400" /> Live from your database</p>
            <h2 className="font-display text-3xl sm:text-4xl font-bold text-cream">Your voice, <span className="text-gold-grad">quantified</span></h2>
          </div>
          <Link to="/progress" className="btn-ghost !py-2 text-[0.8rem]">Open full progress <ArrowRight size={15} /></Link>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
          {[
            { icon: Flame, label: 'Day streak', value: summary ? String(summary.current_streak) : '—', suffix: ' days', tone: 'gold' },
            { icon: Gauge, label: 'Avg clarity · 30d', value: summary ? summary.avg_clarity.toFixed(1) : '—', suffix: '%', tone: 'violet' },
            { icon: AudioWaveform, label: 'Practice time', value: summary ? summary.total_practice_minutes.toFixed(0) : '—', suffix: ' min', tone: 'gold' },
            { icon: Crosshair, label: 'Words mastered', value: summary ? String(summary.words_mastered) : '—', suffix: ' words', tone: 'violet' },
          ].map(({ icon: Icon, label, value, suffix, tone }, i) => (
            <div key={i} className="glass-panel glass-panel-hover p-4 sm:p-5">
              <Icon size={18} className={tone === 'gold' ? 'text-gold-400' : 'text-violet-400'} />
              <p className="mt-3 font-display text-2xl sm:text-3xl font-black text-cream leading-none">{value}<span className="text-sm text-muted font-sans font-semibold">{suffix}</span></p>
              <p className="mt-1.5 text-[0.68rem] font-mono uppercase tracking-[0.14em] text-muted">{label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ============ SIGNATURE: WORD-LEVEL REPLAY ============ */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 pb-16">
        <div className="conic-frame">
          <div className="rounded-[1.45rem] bg-[#1a0f2b]/95 backdrop-blur-xl overflow-hidden grid lg:grid-cols-2">
            <div className="relative p-8 sm:p-10 flex flex-col justify-center overflow-hidden">
              <img src="/images/soundwave-banner.png" alt="" aria-hidden="true" className="absolute inset-0 w-full h-full object-cover opacity-35" />
              <div className="absolute inset-0 bg-gradient-to-r from-[#170c26]/60 via-[#170c26]/30 to-[#1a0f2b]" />
              <div className="relative">
                <span className="chip chip-gold mb-4"><ScanText size={13} /> Signature feature</span>
                <h3 className="font-display text-3xl sm:text-4xl font-black leading-[1.05] text-cream">Word Lab.<br /><span className="text-gold-grad">Every word, on trial.</span></h3>
                <p className="mt-4 text-muted leading-relaxed max-w-sm">
                  Tap any word of your recording. Replay just that slice. Compare it against the coach’s reference. Then drill it —
                  word by word — until every syllable lands clean.
                </p>
                <button onClick={() => navigate('/word-lab')} className="btn-gold mt-7">
                  Enter Word Lab <ChevronRight size={18} strokeWidth={2.5} />
                </button>
              </div>
            </div>
            <div className="p-8 sm:p-10 lg:border-l border-white/6 flex flex-col justify-center">
              <p className="panel-title mb-4">How it works</p>
              <ol className="space-y-5">
                {[
                  { n: '01', t: 'Read the sentence aloud', d: 'One tap records; the Python engine word-aligns what you said against the script.' },
                  { n: '02', t: 'See the verdict per word', d: 'Every word is graded perfect / shaky / missed — with the exact sound that broke.' },
                  { n: '03', t: 'Replay & re-drill in isolation', d: 'Loop a single word 10 times, then the full phrase. Mastery is a compound interest game.' },
                ].map(({ n, t, d }) => (
                  <li key={n} className="flex gap-4">
                    <span className="font-mono text-gold-500 text-[0.8rem] pt-0.5">{n}</span>
                    <span><span className="block font-semibold text-cream">{t}</span><span className="block text-[0.82rem] text-muted mt-1 leading-snug">{d}</span></span>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </div>
      </section>

      {/* ============ COACH’S VOICE / LUXURY MIC PANEL ============ */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 pb-16">
        <div className="glass-panel overflow-hidden grid lg:grid-cols-5">
          <div className="lg:col-span-2 relative min-h-[280px]">
            <img src="/images/golden-mic.png" alt="Floating golden studio microphone surrounded by violet shards" className="absolute inset-0 w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[#1c1029]/20 to-[#1c1029]" />
          </div>
          <div className="lg:col-span-3 p-8 sm:p-10 flex flex-col justify-center">
            <Quote size={26} className="text-gold-500 mb-4" fill="currentColor" strokeWidth={0} />
            <blockquote className="font-display text-xl sm:text-2xl leading-snug text-cream">
              “Clarity is not an accent — you may keep yours proudly. Clarity is the <span className="text-gold-grad">architecture of sound</span>:
              consonants that land, vowels that carry, and a rhythm your listener never has to repair.”
            </blockquote>
            <div className="mt-6 flex items-center gap-3">
              <img src="/images/coach-avatar.png" alt="" className="w-12 h-12 rounded-full object-cover border border-gold-500/40" />
              <div><p className="text-[0.85rem] font-bold text-cream">Aria Voss</p><p className="text-[0.7rem] font-mono text-muted">Lead Speech Coach · ClearVoice AI</p></div>
            </div>
          </div>
        </div>
      </section>

      {/* ============ ENGINE TELEMETRY STRIP ============ */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 pb-20">
        <div className="grid md:grid-cols-3 gap-4">
          {[
            { icon: Timer, title: 'Pause intelligence', body: 'Every silence over 240 ms is detected, measured and placed on the timeline — so you learn to pause like a newsreader, not like a buffering stream.' },
            { icon: Gauge, title: 'Pace & pressure', body: 'Live word-per-minute telemetry with a calibrated 120–160 WPM comfort band — the exact tempo where consonants survive.' },
            { icon: ShieldCheck, title: 'Phonetic verdicts', body: 'A Python engine aligns your transcript with the script word-by-word using grapheme skeletons — accuracy, clarity and fluency scored separately.' },
          ].map(({ icon: Icon, title, body }, i) => (
            <div key={i} className="glass-panel p-6">
              <div className="w-10 h-10 rounded-xl bg-violet-600/20 border border-violet-500/30 flex items-center justify-center"><Icon size={18} className="text-violet-300" /></div>
              <h4 className="mt-4 font-semibold text-cream">{title}</h4>
              <p className="mt-1.5 text-[0.82rem] text-muted leading-relaxed">{body}</p>
            </div>
          ))}
        </div>

        {/* closing CTA */}
        <div className="mt-14 text-center relative">
          <p className="panel-title">Ready when you are</p>
          <h2 className="font-display text-4xl sm:text-6xl font-black mt-3 text-cream">Your voice deserves<br /><span className="text-gold-grad italic">a standing ovation.</span></h2>
          <Link to="/practice" className="btn-gold text-base !px-8 !py-4 mt-8 inline-flex">Enter the Practice Studio <ArrowRight size={19} /></Link>
          <p className="mt-4 text-[0.7rem] font-mono text-faint">No signup. Your microphone never leaves your device unanalyzed.</p>
        </div>
      </section>
    </div>
  );
}
