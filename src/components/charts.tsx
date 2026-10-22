/** Hand-rolled SVG charts — gradient area/line, donut, horizontal bars, sparkline. */
import { useId } from 'react';

export function AreaLineChart({ data, height = 210, showAxis = true }: {
  data: { label: string; value: number }[]; height?: number; showAxis?: boolean;
}) {
  const id = useId().replace(/:/g, '');
  const W = 720, H = height, padL = 34, padR = 10, padT = 14, padB = 26;
  const innerW = W - padL - padR, innerH = H - padT - padB;
  const max = 100, min = 0;
  const x = (i: number) => padL + (i / Math.max(1, data.length - 1)) * innerW;
  const y = (v: number) => padT + innerH - ((v - min) / (max - min)) * innerH;
  const pts = data.map((d, i) => [x(i), y(d.value)] as const);
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
  const area = `${line} L${x(data.length - 1).toFixed(1)},${padT + innerH} L${x(0).toFixed(1)},${padT + innerH} Z`;
  const gridVals = [25, 50, 75, 100];
  const labelIdx = (i: number) => i === 0 || i === data.length - 1 || i === Math.floor((data.length - 1) / 2);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Score trend over time">
      <defs>
        <linearGradient id={`area-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#f5b301" stopOpacity="0.42" />
          <stop offset="60%" stopColor="#8b5cf6" stopOpacity="0.14" />
          <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0.02" />
        </linearGradient>
        <linearGradient id={`line-${id}`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#ffd84d" /><stop offset="55%" stopColor="#f5b301" /><stop offset="100%" stopColor="#a78bfa" />
        </linearGradient>
      </defs>
      {gridVals.map((g) => (
        <g key={g}>
          <line x1={padL} x2={W - padR} y1={y(g)} y2={y(g)} stroke="#3a2653" strokeWidth="1" strokeDasharray="3 5" />
          {showAxis && <text x={padL - 6} y={y(g) + 3.5} textAnchor="end" fontSize="9.5" fill="#7c6b97" fontFamily="IBM Plex Mono, monospace">{g}</text>}
        </g>
      ))}
      <path d={area} fill={`url(#area-${id})`} />
      <path d={line} fill="none" stroke={`url(#line-${id})`} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
      {pts.map((p, i) => (i === pts.length - 1 ? (
        <g key={i}>
          <circle cx={p[0]} cy={p[1]} r="4.6" fill="#ffd84d" stroke="#1c1029" strokeWidth="2" />
          <circle cx={p[0]} cy={p[1]} r="9" fill="none" stroke="#ffd84d" strokeOpacity="0.4" />
        </g>
      ) : (
        <circle key={i} cx={p[0]} cy={p[1]} r="1.6" fill="#cbb9ec" fillOpacity="0.65" />
      )))}
      {showAxis && data.map((d, i) => labelIdx(i) && (
        <text key={i} x={x(i)} y={H - 8} textAnchor="middle" fontSize="9" fill="#7c6b97" fontFamily="IBM Plex Mono, monospace">{d.label}</text>
      ))}
    </svg>
  );
}

export function DonutChart({ segments, size = 150, stroke = 22, centerLabel, centerValue }: {
  segments: { label: string; value: number; color: string }[];
  size?: number; stroke?: number; centerLabel?: string; centerValue?: string;
}) {
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  let acc = 0;
  const GAP = total > 0 ? 0.012 : 0;
  return (
    <div className="flex items-center gap-5">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label="Score composition">
        <circle cx={size / 2} cy={size / 2} r={r} stroke="#2a1a40" strokeWidth={stroke} fill="none" />
        {segments.filter(s => s.value > 0).map((s, i) => {
          const frac = s.value / total;
          const dash = Math.max(0, frac - GAP) * c;
          const offset = c * (0.25 - acc);
          acc += frac;
          return (
            <circle key={i} cx={size / 2} cy={size / 2} r={r} stroke={s.color} strokeWidth={stroke} fill="none"
              strokeDasharray={`${dash} ${c - dash}`} strokeDashoffset={offset} strokeLinecap="round"
              style={{ transition: 'stroke-dasharray .9s cubic-bezier(.22,1,.36,1)', filter: s.color !== '#3a2653' ? `drop-shadow(0 0 6px ${s.color}55)` : undefined }} />
          );
        })}
        <text x="50%" y="47%" textAnchor="middle" dominantBaseline="middle" fontSize={size * 0.19} fontWeight={800} fill="#ffd84d" fontFamily="Fraunces, serif">{centerValue}</text>
        <text x="50%" y="64%" textAnchor="middle" dominantBaseline="middle" fontSize={size * 0.072} fill="#a695c0" fontFamily="IBM Plex Mono, monospace" letterSpacing="2">{centerLabel}</text>
      </svg>
      <div className="space-y-2">
        {segments.map((s) => (
          <div key={s.label} className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-[4px]" style={{ background: s.color }} />
            <span className="text-[0.72rem] text-muted w-24">{s.label}</span>
            <span className="text-[0.72rem] font-mono text-cream">{Math.round((s.value / total) * 100)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function HBarList({ items, maxValue, valueSuffix = '%' }: {
  items: { label: string; value: number; color: string; hint?: string }[];
  maxValue?: number; valueSuffix?: string;
}) {
  const max = maxValue ?? Math.max(...items.map((i) => i.value), 1);
  return (
    <div className="space-y-3">
      {items.map((item) => (
        <div key={item.label} className="group">
          <div className="flex items-baseline justify-between mb-1.5 gap-3">
            <span className="text-[0.8rem] font-medium text-cream/90 truncate">{item.label}</span>
            <span className="font-mono text-[0.72rem] text-gold-400 shrink-0">{item.value}{valueSuffix}{item.hint ? <span className="text-faint"> · {item.hint}</span> : null}</span>
          </div>
          <div className="h-2 rounded-full bg-panel-2 overflow-hidden">
            <div className="h-full rounded-full transition-[width] duration-1000 ease-out"
              style={{ width: `${Math.min(100, (item.value / max) * 100)}%`, background: item.color, boxShadow: `0 0 12px ${item.color}66` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

export function Sparkline({ values, width = 118, height = 34, stroke = '#ffd84d' }: {
  values: number[]; width?: number; height?: number; stroke?: string;
}) {
  const id = useId().replace(/:/g, '');
  if (values.length < 2) return null;
  const max = Math.max(...values), min = Math.min(...values);
  const range = Math.max(1, max - min);
  const pts = values.map((v, i) => `${((i / (values.length - 1)) * (width - 4) + 2).toFixed(1)},${(height - 3 - ((v - min) / range) * (height - 6)).toFixed(1)}`);
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <defs>
        <linearGradient id={`sp-${id}`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor={stroke} stopOpacity="0.35" />
          <stop offset="100%" stopColor={stroke} />
        </linearGradient>
      </defs>
      <polyline points={pts.join(' ')} fill="none" stroke={`url(#sp-${id})`} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={pts[pts.length - 1].split(',')[0]} cy={pts[pts.length - 1].split(',')[1]} r="2.6" fill={stroke} />
    </svg>
  );
}
