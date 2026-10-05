export function scoreColor(score: number): string {
  if (score >= 75) return 'text-emerald-600';
  if (score >= 50) return 'text-amber-500';
  return 'text-rose-600';
}

export function scoreBarColor(score: number): string {
  if (score >= 75) return 'bg-emerald-500';
  if (score >= 50) return 'bg-amber-400';
  return 'bg-rose-500';
}

export default function ScoreRing({ score, label, size = 120 }: { score: number; label: string; size?: number }) {
  const stroke = 10;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - score / 100);

  return (
    <div className="flex flex-col items-center gap-2">
      <div className={`relative ${scoreColor(score)}`} style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
          <circle cx={size / 2} cy={size / 2} r={radius} fill="none" strokeWidth={stroke} className="stroke-slate-200" />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            strokeWidth={stroke}
            strokeLinecap="round"
            stroke="currentColor"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className="transition-[stroke-dashoffset] duration-700"
          />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-3xl font-bold" aria-label={`${label}: ${score} out of 100`}>
          {score}
        </span>
      </div>
      <span className="text-sm font-medium text-slate-600">{label}</span>
    </div>
  );
}
