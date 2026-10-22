import { Link } from 'react-router-dom';

export function LogoMark({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" aria-hidden="true">
      <rect width="64" height="64" rx="17" fill="url(#cv-bg)" />
      <rect x="12.5" y="26" width="5" height="13" rx="2.5" fill="url(#cv-gold)" opacity="0.78" />
      <rect x="21" y="17" width="5" height="32" rx="2.5" fill="url(#cv-gold)" opacity="0.92" />
      <rect x="29.5" y="28.5" width="5" height="8" rx="2.5" fill="#a78bfa" />
      <rect x="38" y="11" width="5" height="43" rx="2.5" fill="url(#cv-gold)" />
      <rect x="46.5" y="23.5" width="5" height="18" rx="2.5" fill="#a78bfa" />
      <rect x="0.5" y="0.5" width="63" height="63" rx="16.5" stroke="url(#cv-ring)" strokeOpacity="0.55" />
      <defs>
        <linearGradient id="cv-bg" x1="0" y1="0" x2="64" y2="64">
          <stop stopColor="#33204c" /><stop offset="1" stopColor="#180c26" />
        </linearGradient>
        <linearGradient id="cv-gold" x1="24" y1="8" x2="24" y2="56">
          <stop stopColor="#ffe066" /><stop offset="1" stopColor="#e0a008" />
        </linearGradient>
        <linearGradient id="cv-ring" x1="0" y1="0" x2="64" y2="64">
          <stop stopColor="#ffd84d" /><stop offset="0.5" stopColor="#8b5cf6" stopOpacity="0" /><stop offset="1" stopColor="#a78bfa" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <Link to="/" className="flex items-center gap-3 group select-none" aria-label="ClearVoice AI home">
      <span className="transition-transform duration-300 group-hover:scale-105 group-hover:rotate-[-2deg]">
        <LogoMark size={compact ? 34 : 40} />
      </span>
      {!compact && (
        <span className="leading-none">
          <span className="block font-display text-[1.35rem] font-semibold tracking-tight text-cream">
            ClearVoice<span className="text-gold-grad font-black italic"> AI</span>
          </span>
          <span className="block mt-1 font-mono text-[0.6rem] tracking-[0.28em] uppercase text-muted">
            Speech Clarity Coach
          </span>
        </span>
      )}
    </Link>
  );
}
