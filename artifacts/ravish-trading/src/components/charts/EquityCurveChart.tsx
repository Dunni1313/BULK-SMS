// v1.5.0, Sprint 11 — Platform Integration. Shared equity-curve chart,
// extracted verbatim from three independently-copy-pasted implementations
// (pages/Backtest.tsx, pages/OptionsBacktest.tsx, pages/TradingBacktest.tsx
// — the latter two's own header comments already disclosed borrowing the
// pattern rather than sharing a component). No visual behaviour changed:
// same recharts LineChart/CartesianGrid/XAxis/YAxis/Tooltip/Line props,
// same CSS-variable-driven colors, same 300px height wrapper. The one real
// difference between the three call sites — Backtest.tsx formats X-axis
// ticks as "month 'year" (a multi-year options backtest window) while the
// other two format as "month day" (shorter walk-forward windows) — is
// preserved via the dateTickFormat prop rather than silently unified.
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

export interface EquityCurvePoint {
  date: string;
  value: number;
}

export type EquityCurveDateTickFormat = "month-year" | "month-day";

function formatTick(value: string, format: EquityCurveDateTickFormat): string {
  const d = new Date(value);
  return format === "month-year"
    ? d.toLocaleDateString(undefined, { month: "short", year: "2-digit" })
    : d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function EquityCurveChart({
  data,
  dateTickFormat = "month-day",
}: {
  data: EquityCurvePoint[];
  dateTickFormat?: EquityCurveDateTickFormat;
}) {
  return (
    <div className="h-[300px] w-full" data-testid="chart-equity-curve">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
          <XAxis
            dataKey="date"
            stroke="hsl(var(--muted-foreground))"
            fontSize={12}
            tickFormatter={(v) => formatTick(v, dateTickFormat)}
          />
          <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickFormatter={(v) => `$${v}`} domain={["auto", "auto"]} />
          <Tooltip
            contentStyle={{ backgroundColor: "hsl(var(--popover))", borderColor: "hsl(var(--border))", color: "hsl(var(--foreground))" }}
            itemStyle={{ color: "hsl(var(--primary))" }}
            labelStyle={{ color: "hsl(var(--muted-foreground))" }}
          />
          <Line type="monotone" dataKey="value" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
