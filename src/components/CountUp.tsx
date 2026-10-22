import { useEffect, useState } from 'react';

export function useCountUp(target: number, duration = 1300, delay = 0) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    const start = performance.now() + delay;
    let raf: number;
    const tick = (now: number) => {
      const t = Math.min(1, Math.max(0, (now - start) / duration));
      const eased = 1 - Math.pow(2, -10 * t);
      setValue(t >= 1 ? target : target * eased);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration, delay]);
  return value;
}

export function CountUp({ target, decimals = 0, suffix = '', prefix = '', duration = 1300, delay = 0, className = '' }: {
  target: number; decimals?: number; suffix?: string; prefix?: string; duration?: number; delay?: number; className?: string;
}) {
  const v = useCountUp(target, duration, delay);
  return <span className={className}>{prefix}{v.toFixed(decimals)}{suffix}</span>;
}
