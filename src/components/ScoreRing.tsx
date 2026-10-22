import { useEffect, useId, useState } from 'react';

interface Props {
  value: number; // 0-100
  size?: number;
  stroke?: number;
  label?: string;
  sublabel?: string;
  tone?: 'gold' | 'violet' | 'auto';
  delay?: number;
}

export function ScoreRing({ value, size = 128, stroke = 11, label, sublabel, tone = 'auto', delay = 0 }: Props) {
  const [display, setDisplay] = useState(0);
  const id = useId().replace(/:/g, '');
  useEffect(() => {
    const start = performance.now() + delay;
    let raf: number;
    const tick = (now: number) => {
      const t = Math.min(1, Math.max(0, (now - start) / 1100));
      const eased = 1 - Math.pow(2, -9 * t);
      setDisplay(t >= 1 ? value : value * eased);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, delay]);

  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, display)) / 100;
  const startAngle = 135;

  const goldA = tone === 'violet' ? '#a78bfa' : '#ffe066';
  const goldB = tone === 'violet' ? '#7c3aed' : '#f5b301';
  const track = '#2e1e47';

  const grade = value >= 90 ? 'Excellent' : value >= 80 ? 'Strong' : value >= 70 ? 'Solid' : value >= 55 ? 'Developing' : 'Needs focus';

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`Score ${Math.round(value)} percent`}>
          <circle cx={size / 2} cy={size / 2} r={r} stroke={track} strokeWidth={stroke} fill="none"
            strokeLinecap="round" strokeDasharray={`${c * 0.75} ${c}`} transform={`rotate(${startAngle} ${size / 2} ${size / 2})`} />
          <circle cx={size / 2} cy={size / 2} r={r} stroke={`url(#grad-${id})`} strokeWidth={stroke} fill="none"
            strokeLinecap="round"
            strokeDasharray={`${Math.max(0.001, c * 0.75 * pct)} ${c}`}
            transform={`rotate(${startAngle} ${size / 2} ${size / 2})`}
            style={{ filter: 'drop-shadow(0 0 10px rgba(245,179,1,0.35))', transition: 'stroke-dasharray .12s linear' }} />
          <defs>
            <linearGradient id={`grad-${id}`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor={goldA} />
              <stop offset="55%" stopColor={goldB} />
              <stop offset="100%" stopColor={tone === 'violet' ? '#5b21b6' : '#c47b04'} />
            </linearGradient>
          </defs>
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-display font-black leading-none text-gold-grad" style={{ fontSize: size * 0.235 }}>{Math.round(display)}</span>
          <span className="font-mono text-[0.55rem] tracking-[0.18em] text-muted uppercase mt-0.5">%</span>
        </div>
      </div>
      {label && <div className="text-center">
        <p className="text-[0.8rem] font-semibold text-cream">{label}</p>
        {sublabel && <p className="text-[0.62rem] font-mono tracking-widest uppercase text-faint mt-0.5">{sublabel}</p>}
        {!sublabel && <p className="text-[0.62rem] font-mono tracking-widest uppercase text-faint mt-0.5">{grade}</p>}
      </div>}
    </div>
  );
}
