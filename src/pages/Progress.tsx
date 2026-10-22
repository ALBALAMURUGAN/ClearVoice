import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  BarChart3, Flame, Trophy, Clock3, AudioWaveform, Target, TrendingUp, TrendingDown,
  Music2, Snowflake, ArrowRight, CalendarDays, Wand2, ChevronRight, Loader2,
} from 'lucide-react';
import { api } from '../lib/api';
import { CountUp } from '../components/CountUp';
import { AreaLineChart, DonutChart, HBarList, Sparkline } from '../components/charts';
import type { Attempt, SummaryStats, TimelineDay, WordMastery } from '../lib/types';

const ISSUE_LABEL: Record<string, string> = {
  'word-shape': 'Word shape drift', 'th-sound': 'Th sound', 'vowel-quality': 'Vowel quality',
  'final-consonant': 'Final consonants', 'stress-rhythm': 'Stress & rhythm', pace: 'Pace band', pauses: 'Pause placement',
};

export default function Progress() {
  const [summary, setSummary] = useState<SummaryStats | null>(null);
  const [timeline, setTimeline] = useState<TimelineDay[]>([]);
  const [words, setWords] = useState<WordMastery[]>([]);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [recs, setRecs] = useState<{ tips: string[]; focus_words: { word: string; accuracy: number }[] }>({ tips: [], focus_words: [] });
  const [metric, setMetric] = useState<'overall' | 'clarity' | 'fluency'>('overall');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.summary(), api.timeline(), api.words(), api.attempts(8), api.recommendations()])
      .then(([s, t, w, a, r]) => { setSummary(s); setTimeline(t.days); setWords(w.words); setAttempts(a.attempts); setRecs(r); })
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, []);

  const chartData = useMemo(() => timeline.map((d) => ({
    label: new Date(d.day + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    value: metric === 'overall' ? d.overall : metric === 'clarity' ? d.clarity : d.fluency,
  })), [timeline, metric]);

  const overallSeries = timeline.map((d) => d.overall);
  const accuracySeries = timeline.map((d) => d.accuracy);
  const fluencySeries = timeline.map((d) => d.fluency);

  const weakest = useMemo(() => [...words].filter((w) => w.attempts > 0).sort((a, b) => a.accuracy - b.accuracy).slice(0, 5), [words]);
  const strongest = useMemo(() => [...words].filter((w) => w.attempts > 1).sort((a, b) => b.accuracy - a.accuracy).slice(0, 5), [words]);

  // GitHub-style calendar heatmap of the last 15 weeks from real attempts
  const { heatCells, months } = useMemo(() => {
    const map = new Map<string, number>();
    attempts.forEach((a) => { const key = a.created_at.slice(0, 10); map.set(key, (map.get(key) ?? 0) + 1); });
    timeline.forEach((d) => { map.set(d.day, Math.max(map.get(d.day) ?? 0, d.attempts)); });
    const today = new Date('2026-10-22T00:00:00');
    const weeks: { date: Date; count: number }[][] = [];
    const start = new Date(today);
    start.setDate(start.getDate() - 6 * 7 - today.getDay());
    let cur = new Date(start);
    for (let w = 0; w < 15; w++) {
      const week: { date: Date; count: number }[] = [];
      for (let d = 0; d < 7; d++) {
        if (cur <= today) {
          const key = cur.toISOString().slice(0, 10);
          week.push({ date: new Date(cur), count: map.get(key) ?? 0 });
        }
        cur = new Date(cur); cur.setDate(cur.getDate() + 1);
      }
      weeks.push(week);
    }
    const monthLabels: { label: string; col: number }[] = [];
    let lastMonth = -1;
    weeks.forEach((week, i) => {
      const m = week[0]?.date.getMonth();
      if (m != null && m !== lastMonth) { monthLabels.push({ label: week[0].date.toLocaleDateString('en-US', { month: 'short' }), col: i }); lastMonth = m; }
    });
    return { heatCells: weeks, months: monthLabels };
  }, [attempts, timeline]);

  if (loading) {
    return <div className="max-w-7xl mx-auto px-6 py-28 flex flex-col items-center"><Loader2 className="animate-spin text-gold-400" size={32} /><p className="text-muted mt-4">Crunching your practice history…</p></div>;
  }

  const s = summary;
  const improvement = s?.improvement ?? 0;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 md:py-12">
      {/* header */}
      <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
        <div>
          <p className="panel-title flex items-center gap-2"><BarChart3 size={12} className="text-gold-400" /> Performance Telemetry · Last 21 days</p>
          <h1 className="font-display text-3xl sm:text-4xl font-black text-cream mt-2">Your Progress, <span className="text-violet-grad">Measured.</span></h1>
        </div>
        <Link to="/practice" className="btn-gold !py-2.5">Add today’s reading <ArrowRight size={16} /></Link>
      </div>

      {/* ======= KPI band ======= */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
        {[
          { icon: Flame, tint: 'text-gold-400 border-gold-500/30 bg-gold-500/8', label: 'Current streak', value: <><CountUp target={s?.current_streak ?? 0} /><span className="text-base text-muted font-sans font-semibold"> days</span></>, sub: 'personal best: 19 days' },
          { icon: Trophy, tint: 'text-violet-300 border-violet-500/30 bg-violet-600/10', label: 'Best score ever', value: <><CountUp target={s?.best_score ?? 0} decimals={1} /><span className="text-base text-muted">%</span></>, sub: `avg ${s?.avg_overall.toFixed(1)}% overall` },
          { icon: Clock3, tint: 'text-gold-400 border-gold-500/30 bg-gold-500/8', label: 'Time in the studio', value: <><CountUp target={s?.total_practice_minutes ?? 0} decimals={1} /><span className="text-base text-muted font-sans font-semibold"> min</span></>, sub: `${s?.words_spoken.toLocaleString()} words spoken` },
          { icon: improvement >= 0 ? TrendingUp : TrendingDown, tint: improvement >= 0 ? 'text-mint border-mint/30 bg-mint/8' : 'text-rose border-rose/30 bg-rose/8', label: 'First-5 → last-5 lift', value: <><CountUp target={Math.abs(improvement)} decimals={1} prefix={improvement >= 0 ? '+' : '−'} /><span className="text-base text-muted font-sans font-semibold"> pts</span></>, sub: 'accuracy-adjusted overall' },
        ].map(({ icon: Icon, tint, label, value, sub }, i) => (
          <div key={i} className="glass-panel glass-panel-hover p-4 sm:p-5">
            <span className={`inline-flex w-9 h-9 rounded-xl border items-center justify-center ${tint}`}><Icon size={17} /></span>
            <p className="mt-3 font-display text-2xl sm:text-[1.75rem] font-black text-cream leading-none">{value}</p>
            <p className="mt-1.5 font-mono text-[0.58rem] uppercase tracking-[0.18em] text-muted">{label}</p>
            <p className="text-[0.62rem] text-faint mt-0.5">{sub}</p>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-5 gap-5">
        {/* ======= main chart: trend ======= */}
        <div className="lg:col-span-3 glass-panel p-6">
          <div className="flex items-center justify-between flex-wrap gap-3 mb-1">
            <p className="panel-title">Score trajectory</p>
            <div className="flex gap-1.5">
              {([['overall', 'Overall'], ['clarity', 'Clarity'], ['fluency', 'Fluency']] as const).map(([k, label]) => (
                <button key={k} onClick={() => setMetric(k)} className={`px-3 py-1.5 rounded-full text-[0.7rem] font-semibold border transition-all ${metric === k ? 'bg-gold-500 text-[#241203] border-gold-500' : 'text-muted border-white/10 hover:text-cream'}`}>{label}</button>
              ))}
            </div>
          </div>
          <AreaLineChart data={chartData} height={225} />
          <div className="grid grid-cols-3 gap-3 mt-4 pt-4 border-t border-white/6">
            {[['Accuracy', accuracySeries, '#ffd84d'], ['Clarity', timeline.map((d) => d.clarity), '#a78bfa'], ['Fluency', fluencySeries, '#34d399']].map(([label, series, color]) => (
              <div key={label as string} className="flex items-center justify-between gap-2">
                <div><p className="font-mono text-[0.55rem] uppercase tracking-[0.18em] text-muted">{label as string}</p><p className="font-display text-lg font-bold text-cream">{(series as number[]).at(-1)?.toFixed(1)}%</p></div>
                <Sparkline values={series as number[]} stroke={color as string} width={74} height={30} />
              </div>
            ))}
          </div>
        </div>

        {/* ======= donut: where the points live ======= */}
        <div className="lg:col-span-2 glass-panel p-6 flex flex-col">
          <p className="panel-title mb-4">Average scoring mix</p>
          <DonutChart size={148} stroke={20} centerValue={`${Math.round(s?.avg_overall ?? 0)}%`} centerLabel="OVERALL"
            segments={[
              { label: 'Accuracy', value: s?.avg_accuracy ?? 0, color: '#ffd84d' },
              { label: 'Clarity', value: s?.avg_clarity ?? 0, color: '#a78bfa' },
              { label: 'Fluency', value: s?.avg_fluency ?? 0, color: '#7c3aed' },
            ]} />
          <div className="mt-auto pt-5">
            <div className="rounded-2xl border border-violet-500/25 bg-violet-600/10 p-4">
              <p className="font-mono text-[0.58rem] uppercase tracking-[0.2em] text-violet-300">Goal · {s?.level}</p>
              <p className="text-[0.85rem] text-cream mt-1.5 leading-snug">{s?.goal}</p>
              <p className="text-[0.66rem] font-mono text-muted mt-2">weakest word: <span className="text-gold-300">{s?.weakest_word?.word} ({s?.weakest_word?.accuracy}%)</span> — see Word Lab</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-5 gap-5 mt-5">
        {/* ======= heatmap calendar ======= */}
        <div className="lg:col-span-3 glass-panel p-6">
          <div className="flex items-center justify-between mb-4">
            <p className="panel-title flex items-center gap-2"><CalendarDays size={12} className="text-gold-400" /> Consistency — last 15 weeks</p>
            <div className="flex items-center gap-1.5 text-[0.6rem] font-mono text-muted">less{[0, 1, 2, 3].map((n) => <span key={n} className="w-3 h-3 rounded-[4px]" style={{ background: n === 0 ? '#2a1a40' : n === 1 ? '#6d4a10' : n === 2 ? '#b57e08' : '#ffd84d' }} />)}more</div>
          </div>
          <div className="overflow-x-auto pb-1">
            <div className="relative" style={{ minWidth: 15 * 16 + 30 }}>
              <div className="flex gap-[3px] text-[0.58rem] font-mono text-faint mb-1 pl-6 h-4">
                {months.map((m) => <span key={m.col} style={{ position: 'absolute', left: 24 + m.col * 15.2 }}>{m.label}</span>)}
              </div>
              <div className="flex gap-[3px]">
                <div className="flex flex-col gap-[3px] text-[0.52rem] font-mono text-faint justify-around">{['Mon', '', 'Wed', '', 'Fri', '', ''].map((d, i) => <span key={i} className="h-3 leading-3">{d}</span>)}</div>
                {heatCells.map((week, wi) => (
                  <div key={wi} className="flex flex-col gap-[3px]">
                    {week.map((cell, di) => {
                      const lvl = cell.count === 0 ? 0 : cell.count === 1 ? 1 : cell.count === 2 ? 2 : 3;
                      const bg = ['#2a1a40', '#6d4a10', '#b57e08', '#ffd84d'][lvl];
                      return <span key={di} title={`${cell.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} — ${cell.count} attempt${cell.count === 1 ? '' : 's'}`} className="w-3 h-3 rounded-[4px] transition-transform hover:scale-125" style={{ background: bg }} />;
                    })}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ======= pronunciation fitness score ======= */}
        <div className="lg:col-span-2 glass-panel p-6 flex flex-col items-center justify-center text-center relative overflow-hidden">
          <Snowflake size={90} className="absolute -right-4 -bottom-4 text-violet-600/12" strokeWidth={1} />
          <p className="panel-title">Pronunciation fitness</p>
          <p className="font-display font-black text-6xl text-gold-grad mt-3 leading-none"><CountUp target={s?.words_mastered ?? 0} /></p>
          <p className="text-[0.72rem] font-mono uppercase tracking-[0.2em] text-muted mt-2">words at 75%+ mastery</p>
          <div className="flex items-center gap-4 mt-5 text-[0.72rem] text-muted">
            <span className="flex items-center gap-1.5"><Music2 size={13} className="text-violet-300" /> avg pace <b className="text-cream">{Math.round(s?.avg_wpm ?? 0)} WPM</b></span>
            <span className="flex items-center gap-1.5"><Target size={13} className="text-gold-400" /> avg pauses <b className="text-cream">{s?.avg_pauses.toFixed(1)}</b></span>
          </div>
        </div>
      </div>

      {/* ======= weak / strong words ======= */}
      <div className="grid lg:grid-cols-2 gap-5 mt-5">
        <div className="glass-panel p-6">
          <p className="panel-title mb-4 flex items-center gap-2"><TrendingDown size={12} className="text-amber" /> Pressure points — rehearse these first</p>
          <HBarList items={weakest.map((w) => ({ label: w.word, value: w.accuracy, color: 'linear-gradient(90deg,#fbbf24,#f59e0b)', hint: `${w.attempts}× tried${w.last_issue ? ` · ${ISSUE_LABEL[w.last_issue] ?? w.last_issue}` : ''}` }))} />
          <Link to="/word-lab" className="inline-flex items-center gap-1.5 mt-4 text-[0.75rem] font-semibold text-gold-300 hover:text-gold-200">Attack them in Word Lab <ChevronRight size={13} /></Link>
        </div>
        <div className="glass-panel p-6">
          <p className="panel-title mb-4 flex items-center gap-2"><Trophy size={12} className="text-mint" /> Words you own</p>
          <HBarList items={strongest.map((w) => ({ label: w.word, value: w.accuracy, color: 'linear-gradient(90deg,#34d399,#10b981)', hint: `${w.successes}/${w.attempts} clean` }))} />
        </div>
      </div>

      {/* ======= recommendations ======= */}
      <div className="glass-panel p-6 mt-5">
        <p className="panel-title flex items-center gap-2 mb-4"><Wand2 size={12} className="text-gold-400" /> Coach’s notes, written from your data</p>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-3">
          {recs.tips.slice(0, 4).map((tip, i) => (
            <div key={i} className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
              <span className="font-mono text-[0.65rem] text-gold-500">0{i + 1}</span>
              <p className="text-[0.78rem] text-cream/85 leading-snug mt-1.5">{tip}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ======= recent attempts ledger ======= */}
      <div className="glass-panel p-6 mt-5">
        <p className="panel-title mb-4">Recent attempts — stored in SQLite</p>
        <div className="overflow-x-auto -mx-2">
          <table className="w-full text-[0.78rem] min-w-[720px]">
            <thead>
              <tr className="text-left font-mono text-[0.58rem] uppercase tracking-[0.18em] text-faint">
                <th className="px-2 py-2">#</th><th className="px-2 py-2">When</th><th className="px-2 py-2">Sentence</th><th className="px-2 py-2 text-right">Overall</th><th className="px-2 py-2 text-right">Acc</th><th className="px-2 py-2 text-right">Clar</th><th className="px-2 py-2 text-right">Flu</th><th className="px-2 py-2 text-right">WPM</th><th className="px-2 py-2 text-right">Pauses</th><th className="px-2 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {attempts.map((a) => (
                <tr key={a.id} className="border-t border-white/6 hover:bg-white/[0.03] transition-colors">
                  <td className="px-2 py-2.5 font-mono text-muted">{a.id}</td>
                  <td className="px-2 py-2.5 text-muted">{new Date(a.created_at.replace(' ', 'T') + 'Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</td>
                  <td className="px-2 py-2.5 text-cream/85 max-w-[220px] truncate">{a.sentence}</td>
                  <td className="px-2 py-2.5 text-right font-mono font-semibold text-gold-300">{Math.round(a.overall)}</td>
                  <td className="px-2 py-2.5 text-right font-mono text-muted">{Math.round(a.accuracy)}</td>
                  <td className="px-2 py-2.5 text-right font-mono text-muted">{Math.round(a.clarity)}</td>
                  <td className="px-2 py-2.5 text-right font-mono text-muted">{Math.round(a.fluency)}</td>
                  <td className="px-2 py-2.5 text-right font-mono text-muted">{Math.round(a.wpm)}</td>
                  <td className="px-2 py-2.5 text-right font-mono text-muted">{a.pause_count}</td>
                  <td className="px-2 py-2.5 text-right"><Link to={`/word-lab?attempt=${a.id}`} className="text-violet-300 hover:text-violet-200 font-semibold text-[0.72rem] inline-flex items-center gap-1"><AudioWaveform size={12} /> replay</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
