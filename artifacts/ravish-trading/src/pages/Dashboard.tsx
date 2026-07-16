import { useGetPortfolioSummary, useGetTopOpportunities, useGetScannerResults, useGetRiskStatus, useGetThetaIncome, useGetMarketDataHealth, useGetEarningsScan } from "@workspace/api-client-react";
import { useLocation } from "wouter";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { EventRiskBadge } from "@/components/ui/event-risk-badge";
import { useEffect, useRef, useState } from "react";
import {
  AreaChart, Area, ResponsiveContainer, Tooltip, XAxis, YAxis, Cell, RadialBarChart, RadialBar
} from "recharts";
import { TrendingUp, TrendingDown, Zap, Activity, Target, DollarSign, Clock, Database, ShieldCheck, ShieldAlert } from "lucide-react";

const SYMBOLS = ["SPY", "QQQ", "IWM", "NVDA", "META", "AAPL", "AMZN", "MSFT", "GOOGL", "TSLA"];

function useFakeSparkline(seed: number, length = 20) {
  return Array.from({ length }, (_, i) => {
    const noise = Math.sin(i * 0.8 + seed) * 8 + Math.cos(i * 1.2 + seed * 2) * 5;
    return { v: 100 + noise + i * 0.3 };
  });
}

function useFakeTicker() {
  const [prices, setPrices] = useState<Record<string, { price: number; change: number }>>(() => {
    const baseMap: Record<string, number> = {
      SPY: 512, QQQ: 441, IWM: 198, NVDA: 875, META: 503,
      AAPL: 189, AMZN: 188, MSFT: 420, GOOGL: 172, TSLA: 178,
    };
    return Object.fromEntries(
      SYMBOLS.map((s) => [s, { price: baseMap[s], change: (Math.random() - 0.45) * 3 }])
    );
  });

  useEffect(() => {
    const id = setInterval(() => {
      setPrices((prev) =>
        Object.fromEntries(
          SYMBOLS.map((s) => {
            const delta = (Math.random() - 0.5) * 1.2;
            const newPrice = +(prev[s].price + delta).toFixed(2);
            return [s, { price: newPrice, change: delta }];
          })
        )
      );
    }, 1800);
    return () => clearInterval(id);
  }, []);

  return prices;
}

function GlowCard({
  label, value, sub, icon: Icon, color, sparkSeed, isLoading,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: typeof DollarSign;
  color: string;
  sparkSeed: number;
  isLoading?: boolean;
}) {
  const spark = useFakeSparkline(sparkSeed);
  return (
    <div
      className="relative rounded-xl overflow-hidden p-[1px]"
      style={{ background: `linear-gradient(135deg, ${color}44, transparent 60%)` }}
    >
      <div
        className="rounded-xl bg-[hsl(220,20%,5%)] p-5 h-full"
        style={{ boxShadow: `0 0 30px ${color}18 inset` }}
      >
        <div className="flex justify-between items-start mb-3">
          <div>
            <p className="text-xs uppercase tracking-widest" style={{ color: `${color}cc` }}>
              {label}
            </p>
            {isLoading ? (
              <Skeleton className="h-8 w-28 mt-1" />
            ) : (
              <p className="text-3xl font-mono font-bold mt-1 text-white">{value}</p>
            )}
            {sub && <p className="text-xs mt-1" style={{ color }}>{sub}</p>}
          </div>
          <div
            className="rounded-lg p-2"
            style={{ background: `${color}22`, color }}
          >
            <Icon className="h-5 w-5" />
          </div>
        </div>
        <div className="h-12 -mx-1">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={spark}>
              <defs>
                <linearGradient id={`spark-${sparkSeed}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={color} stopOpacity={0.4} />
                  <stop offset="95%" stopColor={color} stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area
                type="monotone"
                dataKey="v"
                stroke={color}
                strokeWidth={1.5}
                fill={`url(#spark-${sparkSeed})`}
                dot={false}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

function ScoreRing({ score, tier }: { score: number; tier: string }) {
  score = Math.round(score);
  const color =
    tier === "elite" ? "#f59e0b" :
    tier === "high_conviction" ? "#818cf8" :
    tier === "good" ? "#22c55e" : "#6b7280";
  const data = [{ value: score }, { value: 100 - score }];
  return (
    <div className="relative w-14 h-14">
      <RadialBarChart
        width={56} height={56}
        cx={28} cy={28}
        innerRadius={18} outerRadius={26}
        startAngle={90} endAngle={-270}
        data={data}
        barSize={6}
      >
        <RadialBar dataKey="value" cornerRadius={6} isAnimationActive={false}>
          <Cell fill={color} />
          <Cell fill="transparent" />
        </RadialBar>
      </RadialBarChart>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-xs font-mono font-bold" style={{ color }}>{score}</span>
      </div>
    </div>
  );
}

function TickerTape() {
  const prices = useFakeTicker();
  const tickerRef = useRef<HTMLDivElement>(null);

  return (
    <div className="overflow-hidden relative border border-[hsl(220,15%,13%)] rounded-lg bg-[hsl(220,20%,4%)]">
      <div
        ref={tickerRef}
        className="flex gap-6 px-4 py-2 animate-[ticker_30s_linear_infinite]"
        style={{ width: "max-content" }}
      >
        {[...SYMBOLS, ...SYMBOLS].map((sym, i) => {
          const d = prices[sym];
          if (!d) return null;
          const up = d.change >= 0;
          return (
            <div key={i} className="flex items-center gap-2 shrink-0">
              <span className="text-xs font-bold text-white tracking-wider">{sym}</span>
              <span className="text-xs font-mono text-white">${d.price.toFixed(2)}</span>
              <span
                className="text-xs font-mono flex items-center gap-0.5"
                style={{ color: up ? "#22c55e" : "#ef4444" }}
              >
                {up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                {up ? "+" : ""}{d.change.toFixed(2)}
              </span>
              <span className="text-[hsl(220,15%,25%)]">•</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function HeatCell({ symbol, score, tier }: { symbol: string; score: number; tier: string }) {
  score = Math.round(score);
  const bg =
    tier === "elite" ? "rgba(245,158,11,0.15)" :
    tier === "high_conviction" ? "rgba(129,140,248,0.15)" :
    tier === "good" ? "rgba(34,197,94,0.12)" : "rgba(107,114,128,0.08)";
  const border =
    tier === "elite" ? "#f59e0b44" :
    tier === "high_conviction" ? "#818cf844" :
    tier === "good" ? "#22c55e44" : "#6b728022";
  const text =
    tier === "elite" ? "#f59e0b" :
    tier === "high_conviction" ? "#818cf8" :
    tier === "good" ? "#22c55e" : "#6b7280";

  return (
    <div
      className="rounded-lg p-3 flex flex-col gap-1 transition-all duration-300 hover:scale-105 cursor-pointer"
      style={{ background: bg, border: `1px solid ${border}` }}
    >
      <span className="text-xs font-bold text-white">{symbol}</span>
      <span className="text-lg font-mono font-bold" style={{ color: text }}>{score}</span>
      <span className="text-[10px] uppercase tracking-wider" style={{ color: text }}>
        {tier === "high_conviction" ? "high conv." : tier}
      </span>
    </div>
  );
}

const TIER_COLOR: Record<string, string> = {
  elite: "#f59e0b",
  high_conviction: "#818cf8",
  good: "#22c55e",
  ignore: "#6b7280",
};
const TIER_GRADIENT: Record<string, string> = {
  elite: "linear-gradient(135deg, #f59e0b, #ef4444 50%, #818cf8)",
  high_conviction: "linear-gradient(135deg, #818cf8, #3b82f6 50%, #22c55e)",
  good: "linear-gradient(135deg, #22c55e, #3b82f6 50%, #818cf8)",
  ignore: "linear-gradient(135deg, #6b7280, #374151)",
};

function TopPickHero({ opp, onReview }: { opp: { id: number; symbol: string; ravishScore: number; ravishTier: string; ev: number; pop: number; theta: number; strategy: string }; onReview: (id: number) => void }) {
  const color = TIER_COLOR[opp.ravishTier] ?? "#f59e0b";
  return (
    <div
      className="rounded-xl p-[1px] col-span-full md:col-span-2"
      style={{ background: TIER_GRADIENT[opp.ravishTier] ?? TIER_GRADIENT.elite }}
    >
      <div className="rounded-xl bg-[hsl(220,20%,5%)] p-6 flex flex-col gap-4 h-full" style={{ boxShadow: `0 0 60px ${color}15 inset` }}>
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-yellow-500" />
          <span className="text-xs uppercase tracking-widest text-yellow-500 font-bold">Today's Top Pick</span>
        </div>
        <div className="flex items-center gap-6">
          <div>
            <p className="text-5xl font-mono font-black text-white leading-none">{opp.symbol}</p>
            <p className="text-sm text-muted-foreground mt-1 capitalize">{opp.strategy.replace("_", " ")}</p>
          </div>
          <ScoreRing score={opp.ravishScore} tier={opp.ravishTier} />
          <div className="ml-auto text-right">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Ravish Score</p>
            <p className="text-4xl font-mono font-black text-yellow-500">{Math.round(opp.ravishScore)}</p>
            <Badge
              className="mt-1 uppercase text-[10px] tracking-wider"
              style={{ borderColor: color, color }}
              variant="outline"
            >
              {opp.ravishTier.replace("_", " ")}
            </Badge>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3 mt-auto">
          {[
            { label: "POP", value: `${opp.pop.toFixed(1)}%`, color: "#22c55e" },
            { label: "EV", value: `$${opp.ev.toFixed(0)}`, color: "#3b82f6" },
            { label: "Theta/day", value: `$${(opp.theta || 0).toFixed(2)}`, color: "#818cf8" },
          ].map(({ label, value, color: c }) => (
            <div key={label} className="rounded-lg p-3 text-center" style={{ background: `${c}12`, border: `1px solid ${c}30` }}>
              <p className="text-xs text-muted-foreground uppercase">{label}</p>
              <p className="text-lg font-mono font-bold mt-0.5" style={{ color: c }}>{value}</p>
            </div>
          ))}
        </div>
        <button
          onClick={() => onReview(opp.id)}
          data-testid="button-review-top-pick"
          className="mt-1 w-full rounded-lg py-2.5 text-sm font-bold uppercase tracking-wider text-black transition-opacity hover:opacity-90"
          style={{ background: color }}
        >
          Review Trade
        </button>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [, setLocation] = useLocation();
  const { data: summary, isLoading: isLoadingSummary } = useGetPortfolioSummary();
  const { data: topOpps, isLoading: isLoadingOpps } = useGetTopOpportunities();
  const { data: scannerData } = useGetScannerResults();
  const { data: risk } = useGetRiskStatus();
  const { data: theta } = useGetThetaIncome();
  const { data: health } = useGetMarketDataHealth();
  const { data: earnings } = useGetEarningsScan();

  const topPick = topOpps?.ironCondors?.[0] ?? topOpps?.calendarSpreads?.[0];

  const symbolScores: Record<string, { score: number; tier: string }> = {};
  if (scannerData) {
    for (const r of scannerData) {
      const sym = r.symbol;
      if (!symbolScores[sym] || r.ravishScore > symbolScores[sym].score) {
        symbolScores[sym] = { score: r.ravishScore, tier: r.ravishTier ?? "ignore" };
      }
    }
  }

  const dayPnl = summary?.dayPnl ?? 0;
  const isUp = dayPnl >= 0;

  return (
    <div className="space-y-5">
      <style>{`
        @keyframes ticker {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        @keyframes pulse-glow {
          0%, 100% { box-shadow: 0 0 8px #22c55e44; }
          50% { box-shadow: 0 0 24px #22c55eaa; }
        }
      `}</style>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-white">
            <span className="text-primary">DK</span> DASHBOARD
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div
            className="h-2 w-2 rounded-full bg-emerald-500"
            style={{ animation: "pulse-glow 2s ease-in-out infinite" }}
          />
          <span className="text-xs text-emerald-500 font-mono">LIVE</span>
        </div>
      </div>

      <TickerTape />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <GlowCard
          label="Account Value"
          value={`$${(summary?.accountValue ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          icon={DollarSign}
          color="#3b82f6"
          sparkSeed={1}
          isLoading={isLoadingSummary}
        />
        <GlowCard
          label="Day P&L"
          value={`${isUp ? "+" : ""}$${Math.abs(dayPnl).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          sub={isUp ? "▲ Profitable day" : "▼ Down today"}
          icon={isUp ? TrendingUp : TrendingDown}
          color={isUp ? "#22c55e" : "#ef4444"}
          sparkSeed={2}
          isLoading={isLoadingSummary}
        />
        <GlowCard
          label="Buying Power"
          value={`$${(summary?.buyingPower ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          icon={Activity}
          color="#818cf8"
          sparkSeed={3}
          isLoading={isLoadingSummary}
        />
        <GlowCard
          label="Open Positions"
          value={String(summary?.openPositions ?? 0)}
          sub="Active trades"
          icon={Target}
          color="#f59e0b"
          sparkSeed={4}
          isLoading={isLoadingSummary}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {topPick && !isLoadingOpps ? (
          <TopPickHero opp={topPick as any} onReview={(id) => setLocation(`/ticket/${id}`)} />
        ) : (
          <div className="col-span-full md:col-span-2 rounded-xl border border-border bg-card p-6">
            <Skeleton className="h-48 w-full" />
          </div>
        )}

        <div className="col-span-full md:col-span-2 rounded-xl border border-[hsl(220,15%,13%)] bg-[hsl(220,18%,6%)] p-5">
          <div className="flex items-center gap-2 mb-4">
            <Zap className="h-4 w-4 text-primary" />
            <span className="text-xs uppercase tracking-widest font-bold text-primary">Symbol Heat Map</span>
          </div>
          <div className="grid grid-cols-5 gap-2">
            {SYMBOLS.map((sym) => {
              const d = symbolScores[sym];
              return d ? (
                <HeatCell key={sym} symbol={sym} score={d.score} tier={d.tier} />
              ) : (
                <div key={sym} className="rounded-lg p-3 bg-[hsl(220,15%,8%)] border border-[hsl(220,15%,13%)]">
                  <span className="text-xs text-muted-foreground">{sym}</span>
                  <Skeleton className="h-5 w-8 mt-1" />
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div
        className="rounded-xl p-[1px]"
        style={{ background: risk?.withinLimits === false ? "linear-gradient(135deg,#ef4444,#f59e0b)" : "linear-gradient(135deg,#22c55e44,transparent)" }}
      >
        <div className="rounded-xl bg-[hsl(220,20%,5%)] px-5 py-4 flex flex-wrap items-center gap-x-8 gap-y-3">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4" style={{ color: risk?.withinLimits === false ? "#ef4444" : "#22c55e" }} />
            <span className="text-xs uppercase tracking-widest font-bold" style={{ color: risk?.withinLimits === false ? "#ef4444" : "#22c55e" }}>
              {risk?.withinLimits === false ? "Risk Limit Breached" : "Risk Within Limits"}
            </span>
          </div>
          {[
            { label: "Portfolio Risk", value: risk ? `$${risk.portfolioRiskDollars.toLocaleString()}` : "—" },
            { label: "% of Account", value: risk ? `${risk.portfolioRiskUsedPct.toFixed(1)}% / ${risk.maxPortfolioRiskPct}%` : "—" },
            { label: "Open Trades", value: risk ? String(risk.openTrades) : "—" },
            { label: "Stop Loss", value: risk ? `${risk.stopLossMultiplier}× credit` : "—" },
            { label: "Profit Targets", value: risk ? risk.profitTargets.map((t) => `${t}%`).join(" / ") : "—" },
          ].map((s) => (
            <div key={s.label}>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{s.label}</p>
              <p className="text-sm font-mono font-bold text-white">{s.value}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 rounded-xl border border-[hsl(220,15%,13%)] bg-[hsl(220,18%,6%)] p-5">
          <div className="flex items-center gap-2 mb-4">
            <Clock className="h-4 w-4 text-emerald-400" />
            <span className="text-xs uppercase tracking-widest font-bold text-emerald-400">Theta Income Engine</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            {[
              { label: "Daily", value: theta?.daily },
              { label: "Weekly", value: theta?.weekly },
              { label: "Monthly", value: theta?.monthly },
              { label: "Annualized", value: theta?.annualized },
            ].map((s) => (
              <div key={s.label} className="rounded-lg bg-[hsl(220,15%,8%)] border border-[hsl(220,15%,13%)] p-3">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{s.label}</p>
                <p className="text-lg font-mono font-bold text-emerald-400">
                  {s.value === undefined ? "—" : `$${s.value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
                </p>
              </div>
            ))}
          </div>
          {theta && theta.byStrategy.length > 0 ? (
            <div className="space-y-2">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">By Strategy</p>
              {theta.byStrategy.map((b) => {
                const max = Math.max(...theta.byStrategy.map((x) => Math.abs(x.theta)), 1);
                return (
                  <div key={b.key} className="flex items-center gap-3">
                    <span className="w-32 text-xs text-white capitalize">{b.key.replace(/_/g, " ")}</span>
                    <div className="flex-1 h-2 rounded-full bg-[hsl(220,15%,12%)] overflow-hidden">
                      <div className="h-full bg-emerald-500/70" style={{ width: `${(Math.abs(b.theta) / max) * 100}%` }} />
                    </div>
                    <span className="w-16 text-right text-xs font-mono text-emerald-400">${b.theta.toFixed(0)}</span>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">No open positions generating theta yet.</p>
          )}
        </div>

        <div className="rounded-xl border border-[hsl(220,15%,13%)] bg-[hsl(220,18%,6%)] p-5">
          <div className="flex items-center gap-2 mb-4">
            <Database className="h-4 w-4 text-primary" />
            <span className="text-xs uppercase tracking-widest font-bold text-primary">Market Data Health</span>
          </div>
          <div className="flex items-center gap-2 mb-4">
            {health?.connected ? (
              <ShieldCheck className="h-5 w-5 text-emerald-400" />
            ) : (
              <ShieldAlert className="h-5 w-5 text-amber-400" />
            )}
            <div>
              <p className="text-sm font-bold text-white">
                {health ? `${health.provider.toUpperCase()} · ${health.mode.toUpperCase()}` : "—"}
              </p>
              <p className="text-[11px] text-muted-foreground">{health?.reason ?? "Awaiting first scan"}</p>
            </div>
          </div>
          {health && health.requestedProvider !== health.provider && (
            <div className="mb-3 rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-1.5">
              <p className="text-[11px] text-amber-400">
                Requested {health.requestedProvider.toUpperCase()} → fell back to {health.provider.toUpperCase()}
              </p>
            </div>
          )}
          <div className="space-y-1.5">
            {[
              { label: "Symbols Scanned", value: health?.symbolsScanned },
              { label: "Contracts Scanned", value: health?.contractsScanned },
              { label: "Rejected (Liquidity)", value: health?.rejectedByLiquidity },
              { label: "Rejected (Risk)", value: health?.rejectedByRisk },
              { label: "Positive EV Found", value: health?.positiveEvFound },
            ].map((s) => (
              <div key={s.label} className="flex items-center justify-between">
                <span className="text-[11px] text-muted-foreground">{s.label}</span>
                <span className="text-xs font-mono text-white">{s.value ?? "—"}</span>
              </div>
            ))}
          </div>
          {health?.lastScannedAt && (
            <p className="mt-3 text-[10px] text-muted-foreground">
              Last scan: {new Date(health.lastScannedAt).toLocaleTimeString()}
            </p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {[
          { title: "Top Iron Condors", key: "ironCondors", color: "#3b82f6" },
          { title: "Top Iron Flys", key: "ironFlys", color: "#818cf8" },
          { title: "Top Calendar Spreads", key: "calendarSpreads", color: "#22c55e" },
          { title: "Top Earnings Plays", key: "earnings", color: "#f59e0b" },
        ].map(({ title, key, color }) => {
          const items = (topOpps as any)?.[key]?.slice(0, 4) ?? [];
          return (
            <div
              key={key}
              className="rounded-xl border p-5"
              style={{ borderColor: `${color}22`, background: `${color}06` }}
            >
              <div className="flex items-center gap-2 mb-4">
                <div className="h-1.5 w-5 rounded-full" style={{ background: color }} />
                <span className="text-xs font-bold uppercase tracking-wider" style={{ color }}>{title}</span>
              </div>
              {isLoadingOpps ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => <Skeleton key={i} className="h-10 w-full" />)}
                </div>
              ) : (
                <div className="space-y-2">
                  {items.map((opp: any, i: number) => (
                    <div
                      key={opp.id}
                      className="flex items-center justify-between rounded-lg px-3 py-2 transition-colors hover:bg-white/5"
                      style={{ background: i === 0 ? `${color}10` : "transparent" }}
                    >
                      <div className="flex items-center gap-2">
                        {i === 0 && <span className="text-[10px] font-bold" style={{ color }}>#{i + 1}</span>}
                        {i > 0 && <span className="text-[10px] text-muted-foreground">#{i + 1}</span>}
                        <span className="font-bold text-sm text-white">{opp.symbol}</span>
                        <ScoreRing score={opp.ravishScore} tier={opp.ravishTier} />
                        {opp.eventRiskLevel && opp.eventRiskLevel !== "none" && (
                          <EventRiskBadge
                            level={opp.eventRiskLevel}
                            penalty={opp.eventRiskPenalty}
                            events={opp.eventRiskEvents}
                          />
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <p className="text-xs font-mono text-white">POP {opp.pop.toFixed(0)}%</p>
                          <p className="text-xs font-mono text-muted-foreground">EV ${opp.ev.toFixed(0)}</p>
                        </div>
                        <button
                          onClick={() => setLocation(`/ticket/${opp.id}`)}
                          data-testid={`button-review-${opp.id}`}
                          className="text-[10px] font-bold uppercase tracking-wider rounded-md px-2 py-1 transition-colors hover:bg-white/10"
                          style={{ color, border: `1px solid ${color}44` }}
                        >
                          Review
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="rounded-xl border border-[hsl(220,15%,13%)] bg-[hsl(220,18%,6%)] p-5">
        <div className="flex items-center gap-2 mb-4">
          <Target className="h-4 w-4 text-amber-400" />
          <span className="text-xs uppercase tracking-widest font-bold text-amber-400">Earnings Engine</span>
          <span className="text-[10px] text-muted-foreground">Elevated IV · expected move · IV-crush plays</span>
        </div>
        {!earnings ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-24 w-full" />)}
          </div>
        ) : earnings.length === 0 ? (
          <p className="text-xs text-muted-foreground">No near-term earnings events with tradeable IV.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {earnings.slice(0, 6).map((e) => (
              <div key={e.symbol} className="rounded-lg border border-[hsl(220,15%,13%)] bg-[hsl(220,15%,8%)] p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-white">{e.symbol}</span>
                    <span className="text-[10px] text-muted-foreground">{e.daysToEarnings}d to ER</span>
                  </div>
                  <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400">
                    {e.recommendedStrategy.replace(/_/g, " ")}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2 mb-2">
                  <div>
                    <p className="text-[9px] uppercase tracking-wider text-muted-foreground">Exp. Move</p>
                    <p className="text-xs font-mono text-white">±{e.expectedMovePct.toFixed(1)}%</p>
                  </div>
                  <div>
                    <p className="text-[9px] uppercase tracking-wider text-muted-foreground">IV Rank</p>
                    <p className="text-xs font-mono text-white">{e.ivRank.toFixed(0)}</p>
                  </div>
                  <div>
                    <p className="text-[9px] uppercase tracking-wider text-muted-foreground">IV Crush</p>
                    <p className="text-xs font-mono text-emerald-400">{e.ivCrushPotentialPct.toFixed(0)}%</p>
                  </div>
                </div>
                <p className="text-[11px] text-muted-foreground leading-snug">{e.rationale}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
