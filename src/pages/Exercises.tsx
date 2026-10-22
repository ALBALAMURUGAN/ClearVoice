import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Dumbbell, Volume2, CheckCircle2, Lock, Sparkles, ChevronDown, ArrowRight, Mic2, Loader2, CircleCheckBig,
} from 'lucide-react';
import { api } from '../lib/api';
import { speakReference } from '../lib/audio';
import type { Exercise } from '../lib/types';

const CATEGORIES = ['All', 'Articulation', 'Vowels', 'Rhythm', 'Fluency'] as const;

const trend = [58, 61, 65, 71, 74, 79, 83];

export default function Exercises() {
  const navigate = useNavigate();
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>('All');
  const [openId, setOpenId] = useState<string | null>('minimal-pair-th-s');
  const [loading, setLoading] = useState(true);
  const [speakingPair, setSpeakingPair] = useState<string | null>(null);

  useEffect(() => {
    api.exercises().then((d) => setExercises(d.exercises)).catch(() => setExercises([])).finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(
    () => exercises.filter((e) => category === 'All' || e.category === category),
    [exercises, category],
  );

  const completedCount = exercises.filter((e) => e.completed).length;
  const totalXp = exercises.reduce((sum, e) => sum + (e.completed ? e.xp : 0), 0);

  const speakPair = async (pairId: string, text: string) => {
    setSpeakingPair(pairId);
    try { await speakReference(text); } finally { setSpeakingPair(null); }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 md:py-12">
      {/* header */}
      <div className="flex flex-wrap items-end justify-between gap-6 mb-8">
        <div className="max-w-xl">
          <p className="panel-title flex items-center gap-2"><Dumbbell size={12} className="text-gold-400" /> Precision Gymnasium · Intermediate</p>
          <h1 className="font-display text-3xl sm:text-4xl font-black text-cream mt-2">Pronunciation <span className="text-gold-grad">Exercises</span></h1>
          <p className="text-muted text-[0.9rem] mt-2 leading-relaxed">Ten surgical drills targeting the exact failure points intermediate speakers hit — minimal pairs, schwa reduction, stress placement, thought groups and connected speech.</p>
        </div>
        <div className="glass-panel px-6 py-4 flex items-center gap-6">
          <div className="text-center">
            <p className="font-display text-2xl font-black text-gold-grad leading-none">{completedCount}<span className="text-muted text-lg font-sans font-semibold">/{exercises.length || 10}</span></p>
            <p className="font-mono text-[0.55rem] uppercase tracking-[0.2em] text-muted mt-1.5">Mastered</p>
          </div>
          <div className="w-px h-10 bg-white/8" />
          <div className="text-center">
            <p className="font-display text-2xl font-black text-violet-grad leading-none">{totalXp}</p>
            <p className="font-mono text-[0.55rem] uppercase tracking-[0.2em] text-muted mt-1.5">XP earned</p>
          </div>
          <div className="w-px h-10 bg-white/8" />
          {/* mini mastery spark */}
          <svg width="110" height="40" viewBox="0 0 110 40" aria-hidden="true">
            <polyline points={trend.map((v, i) => `${(i / (trend.length - 1)) * 100 + 5},${37 - ((v - 50) / 45) * 32}`).join(' ')} fill="none" stroke="#a78bfa" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" opacity="0.95" />
            <circle cx="105" cy={37 - ((trend[trend.length - 1] - 50) / 45) * 32} r="3" fill="#ffd84d" />
          </svg>
        </div>
      </div>

      {/* category filter */}
      <div className="flex items-center gap-2 mb-6 flex-wrap">
        {CATEGORIES.map((c) => (
          <button key={c} onClick={() => setCategory(c)}
            className={`px-4 py-2 rounded-full text-[0.78rem] font-semibold border transition-all ${category === c ? 'bg-violet-600 text-[#efe6ff] border-violet-400/50 shadow-[0_4px_18px_rgba(124,58,237,.45)]' : 'text-muted border-white/10 hover:text-cream hover:border-violet-400/40'}`}>
            {c}
          </button>
        ))}
      </div>

      {/* exercise cards */}
      {loading ? (
        <div className="glass-panel p-16 flex items-center justify-center"><Loader2 className="animate-spin text-gold-400" size={30} /></div>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {filtered.map((ex) => {
            const open = openId === ex.id;
            const gold = ex.color === 'gold';
            return (
              <motion.article key={ex.id} layout className={`glass-panel overflow-hidden ${open ? 'ring-1 ring-gold-500/40' : ''}`}>
                <button className="w-full text-left p-5 flex items-start gap-4" onClick={() => setOpenId(open ? null : ex.id)} aria-expanded={open}>
                  <span className={`shrink-0 w-12 h-12 rounded-2xl flex items-center justify-center font-display font-black text-lg border ${gold ? 'bg-gold-500/15 border-gold-500/35 text-gold-400' : 'bg-violet-600/18 border-violet-500/35 text-violet-300'}`}>
                    {ex.completed ? <CircleCheckBig size={22} /> : ex.title.slice(0, 1)}
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-cream">{ex.title}</span>
                      {ex.completed && <span className="chip chip-green !py-0.5 !text-[0.6rem]"><CheckCircle2 size={11} /> {Math.round(ex.best_score)}% best</span>}
                    </span>
                    <span className="block text-[0.78rem] text-muted mt-1 leading-snug">{ex.description}</span>
                    <span className="flex items-center gap-2 mt-2.5">
                      <span className="chip !py-0.5 !text-[0.58rem]">{ex.category}</span>
                      <span className="chip !py-0.5 !text-[0.58rem] text-violet-300 border-violet-400/30"><Sparkles size={10} /> {ex.xp} XP</span>
                      <span className="chip !py-0.5 !text-[0.58rem]">{ex.difficulty}</span>
                    </span>
                  </span>
                  <ChevronDown size={18} className={`shrink-0 text-muted transition-transform duration-300 mt-1 ${open ? 'rotate-180' : ''}`} />
                </button>

                <AnimatePresence initial={false}>
                  {open && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.35 }}>
                      <div className="px-5 pb-5 pt-4 border-t border-white/6">
                        <p className="panel-title mb-2.5">Target sounds — tap to hear</p>
                        <div className="flex flex-wrap gap-2 mb-4">
                          {ex.pairs.map((pair, i) => {
                            const both = pair.right && pair.right !== '—';
                            const text = both ? `${pair.left}, … ${pair.right}` : pair.left;
                            const id = `${ex.id}-${i}`;
                            const speaking = speakingPair === id;
                            return (
                              <button key={i} onClick={() => speakPair(id, text)}
                                className={`group inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-[0.8rem] font-semibold transition-all ${speaking ? 'border-gold-500/60 bg-gold-500/15 text-gold-300' : 'border-white/12 bg-white/[0.03] text-cream/90 hover:border-violet-400/45 hover:text-cream'}`}>
                                <Volume2 size={13} className={speaking ? 'animate-pulse text-gold-400' : 'text-muted group-hover:text-violet-300'} />
                                {both ? <><span className="text-gold-300">{pair.left}</span><span className="text-faint font-normal">/</span><span className="text-violet-300">{pair.right}</span></> : pair.left}
                              </button>
                            );
                          })}
                        </div>
                        <p className="text-[0.8rem] text-violet-300/90 leading-snug border-l-2 border-violet-500/40 pl-3">{ex.tip}</p>
                        <button onClick={() => navigate(`/practice?exercise=${ex.id}`)} className="btn-gold !py-2.5 !px-5 text-[0.82rem] mt-4">
                          <Mic2 size={15} /> Practice this drill now <ArrowRight size={14} />
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.article>
            );
          })}
        </div>
      )}

      {/* lock note */}
      <p className="mt-6 flex items-center gap-2 text-[0.72rem] text-faint font-mono"><Lock size={12} /> Advanced & accent tracks unlock at 3,500 XP — you are at {2800 + totalXp}. Keep the streak alive.</p>
    </div>
  );
}
