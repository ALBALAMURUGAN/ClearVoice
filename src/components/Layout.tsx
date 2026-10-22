import { Link, Outlet, useLocation } from 'react-router-dom';
import { Menu, X, Flame, Sparkles, Home, Mic2, Dumbbell, BarChart3, ScanText } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Logo } from './Logo';
import { api } from '../lib/api';

const NAV = [
  { to: '/', label: 'Home', icon: Home },
  { to: '/practice', label: 'Studio', icon: Mic2 },
  { to: '/exercises', label: 'Exercises', icon: Dumbbell },
  { to: '/word-lab', label: 'Word Lab', icon: ScanText },
  { to: '/progress', label: 'Progress', icon: BarChart3 },
];

export default function Layout() {
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [streak, setStreak] = useState<number | null>(null);
  const [xp, setXp] = useState<number | null>(null);

  useEffect(() => {
    api.summary().then((s) => { setStreak(s.current_streak); setXp(s.xp); }).catch(() => undefined);
  }, [location.pathname]);

  useEffect(() => { setOpen(false); window.scrollTo({ top: 0 }); }, [location.pathname]);

  return (
    <div className="min-h-screen flex flex-col relative">
      {/* ambient background */}
      <div className="aurora-field" aria-hidden="true">
        <div className="aurora-orb violet" style={{ width: 560, height: 560, top: '-8%', right: '-12%' }} />
        <div className="aurora-orb gold" style={{ width: 420, height: 420, top: '38%', left: '-14%' }} />
        <div className="aurora-orb deep" style={{ width: 640, height: 640, bottom: '-18%', right: '28%' }} />
      </div>
      <div className="grain" aria-hidden="true" />

      {/* announcement ribbon */}
      <div className="relative z-20 bg-gradient-to-r from-gold-600/95 via-gold-500 to-gold-600/95 text-[#2a1a02]">
        <div className="max-w-7xl mx-auto px-4 h-8 flex items-center justify-center gap-2 text-[0.68rem] font-bold tracking-wide whitespace-nowrap overflow-hidden">
          <Sparkles size={12} strokeWidth={2.5} className="shrink-0" />
          <span className="truncate">Intermediate track · Word-level replay engine v1.4 · 38% average clarity lift in 21 days</span>
        </div>
      </div>

      {/* navigation */}
      <header className="sticky top-0 z-30 border-b border-white/5 bg-[#150b22]/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <Logo />
          <nav className="hidden md:flex items-center gap-1 rounded-full border border-white/8 bg-white/[0.03] p-1">
            {NAV.map(({ to, label }) => {
              const active = location.pathname === to;
              return (
                <Link key={to} to={to}
                  className={`relative px-4 py-1.5 rounded-full text-[0.8rem] font-semibold transition-colors ${active ? 'text-[#241203]' : 'text-muted hover:text-cream'}`}>
                  {active && <span className="absolute inset-0 rounded-full bg-gradient-to-br from-gold-300 via-gold-500 to-gold-600 shadow-[0_2px_14px_rgba(245,179,1,.4)]" />}
                  <span className="relative">{label}</span>
                </Link>
              );
            })}
          </nav>
          <div className="flex items-center gap-2">
            {streak !== null && (
              <div className="hidden sm:flex items-center gap-1.5 chip chip-gold !py-1.5" title="Day streak">
                <Flame size={13} strokeWidth={2.5} /> <span className="font-mono">{streak}</span>
              </div>
            )}
            {xp !== null && (
              <div className="hidden sm:flex items-center gap-1.5 chip !py-1.5" title="Total experience points">
                <span className="font-mono text-violet-300">XP</span><span className="font-mono">{xp.toLocaleString()}</span>
              </div>
            )}
            <button className="md:hidden p-2 text-cream" onClick={() => setOpen((v) => !v)} aria-label="Toggle menu">
              {open ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </div>
        {/* mobile menu */}
        {open && (
          <div className="md:hidden border-t border-white/8 bg-[#150b22]/95 backdrop-blur-xl px-4 py-3">
            {NAV.map(({ to, label, icon: Icon }) => (
              <Link key={to} to={to} className="flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-white/5 text-cream font-medium">
                <Icon size={18} className="text-gold-400" /> {label}
              </Link>
            ))}
            <Link to="/practice" className="btn-gold w-full justify-center mt-2 mb-1">Start today’s practice</Link>
          </div>
        )}
      </header>

      <main className="flex-1 relative z-10">
        <Outlet />
      </main>

      {/* footer */}
      <footer className="relative z-10 border-t border-white/6 bg-[#120a1e]/90 backdrop-blur-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10 grid gap-8 md:grid-cols-4 text-[0.78rem] text-muted">
          <div className="md:col-span-1">
            <Logo compact />
            <p className="mt-3 leading-relaxed">The AI speech clarity studio for intermediate English learners — word-level alignment, real pronunciation analytics, and deliberate practice.</p>
          </div>
          <div>
            <p className="panel-title mb-2.5">Studio</p>
            <ul className="space-y-1.5">
              <li><Link to="/practice" className="hover:text-cream transition-colors">Practice Studio</Link></li>
              <li><Link to="/word-lab" className="hover:text-cream transition-colors">Word Lab — word-level replay</Link></li>
              <li><Link to="/exercises" className="hover:text-cream transition-colors">Pronunciation exercises</Link></li>
              <li><Link to="/progress" className="hover:text-cream transition-colors">Progress & insights</Link></li>
            </ul>
          </div>
          <div>
            <p className="panel-title mb-2.5">Engine</p>
            <ul className="space-y-1.5">
              <li>Phonetic alignment (Python)</li>
              <li>Levenshtein word backtrace</li>
              <li>WPM + pause prosody model</li>
              <li>Difficulty: Intermediate B1–B2</li>
            </ul>
          </div>
          <div>
            <p className="panel-title mb-2.5">Stack</p>
            <ul className="space-y-1.5 font-mono text-[0.72rem]">
              <li>JavaScript · Express API</li>
              <li>SQLite persistence (WAL)</li>
              <li>Python analysis engine</li>
              <li>Web Speech + MediaRecorder</li>
            </ul>
            <p className="mt-4 text-[0.68rem] text-faint">© 2026 ClearVoice AI. Crafted with precision.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
