// v1.5.0, Sprint 11 — Platform Integration. Shared gauge/ring component,
// extracted from two independently-implemented copies of the same visual
// technique (pages/Dashboard.tsx's own ScoreRing, and
// pages/PortfolioDashboard.tsx's own HealthGauge — whose header comment
// already disclosed "mirrors pages/Dashboard.tsx's own established
// ScoreRing gauge pattern... the same visual technique, not a new
// charting approach"). No visual behaviour changed: same RadialBarChart/
// RadialBar/Cell shape at each of the two pre-existing sizes. Color
// resolution is deliberately left to the caller (Dashboard.tsx's own
// tier-based palette and PortfolioDashboard.tsx's own ratingCode-based
// palette are genuinely different vocabularies) — this component only
// ever renders whatever color string it's given, never computes one.
import { RadialBarChart, RadialBar, Cell } from "recharts";

export type ScoreRingSize = "sm" | "lg";

const SIZE_CONFIG: Record<
  ScoreRingSize,
  { box: number; cx: number; cy: number; innerRadius: number; outerRadius: number; barSize: number; cornerRadius: number; fontClass: string }
> = {
  // Matches pages/Dashboard.tsx's own pre-existing ScoreRing exactly
  // (cornerRadius happens to equal barSize at this size, preserved as its
  // own field rather than assumed, since the lg size below does not).
  sm: { box: 56, cx: 28, cy: 28, innerRadius: 18, outerRadius: 26, barSize: 6, cornerRadius: 6, fontClass: "text-xs" },
  // Matches pages/PortfolioDashboard.tsx's own pre-existing HealthGauge
  // exactly — cornerRadius (8) is deliberately NOT equal to barSize (10).
  lg: { box: 96, cx: 48, cy: 48, innerRadius: 32, outerRadius: 44, barSize: 10, cornerRadius: 8, fontClass: "text-xl" },
};

export function ScoreRing({
  score,
  color,
  size = "sm",
  testId,
}: {
  score: number;
  color: string;
  size?: ScoreRingSize;
  testId?: string;
}) {
  const rounded = Math.round(score);
  const cfg = SIZE_CONFIG[size];
  const data = [{ value: rounded }, { value: 100 - rounded }];
  return (
    <div className="relative" style={{ width: cfg.box, height: cfg.box }} data-testid={testId}>
      <RadialBarChart
        width={cfg.box}
        height={cfg.box}
        cx={cfg.cx}
        cy={cfg.cy}
        innerRadius={cfg.innerRadius}
        outerRadius={cfg.outerRadius}
        startAngle={90}
        endAngle={-270}
        data={data}
        barSize={cfg.barSize}
      >
        <RadialBar dataKey="value" cornerRadius={cfg.cornerRadius} isAnimationActive={false}>
          <Cell fill={color} />
          <Cell fill="transparent" />
        </RadialBar>
      </RadialBarChart>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className={`${cfg.fontClass} font-mono font-bold`} style={{ color }}>
          {rounded}
        </span>
      </div>
    </div>
  );
}
