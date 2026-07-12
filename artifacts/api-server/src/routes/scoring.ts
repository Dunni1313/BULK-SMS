import { Router, type IRouter } from "express";
import {
  GetRavishScoreResponse,
  GetScoringLeaderboardResponse,
} from "@workspace/api-zod";
import {
  UNIVERSE_SYMBOLS,
  getSnapshot,
  buildIronCondor,
  buildIronFly,
  buildCalendar,
  buildEarnings,
  ravishScore,
  type StrategyQuote,
  type Snapshot,
} from "../lib/optionsMath.js";

const router: IRouter = Router();

function scoreQuote(snap: Snapshot, q: StrategyQuote) {
  const comp = ravishScore({
    strategy: q.strategy,
    pop: q.pop,
    ev: q.ev,
    maxProfit: q.maxProfit,
    maxLoss: q.maxLoss,
    dailyTheta: q.theta,
    dte: q.daysToExpiry,
    liquidityScore: q.liquidityScore,
    ivRank: q.ivRank,
  });
  const label = q.strategy.replace(/_/g, " ");
  const recommendation =
    comp.tier === "elite"
      ? `${snap.symbol} ${label} is an Elite opportunity — execute with full conviction`
      : comp.tier === "high_conviction"
        ? `${snap.symbol} ${label} scores well — consider executing`
        : comp.tier === "good"
          ? `${snap.symbol} ${label} is a decent setup but not top priority`
          : `${snap.symbol} ${label} does not meet minimum criteria — skip`;
  return {
    symbol: snap.symbol,
    strategy: q.strategy,
    totalScore: comp.total,
    tier: comp.tier,
    popScore: comp.popScore,
    evScore: comp.evScore,
    thetaScore: comp.thetaScore,
    winRateScore: comp.winRateScore,
    liquidityScore: comp.liquidityScore,
    ivRankScore: comp.ivRankScore,
    pop: q.pop,
    ev: q.ev,
    theta: q.theta,
    ivRank: q.ivRank,
    recommendation,
  };
}

function quotesFor(snap: Snapshot): StrategyQuote[] {
  const list: (StrategyQuote | null)[] = [
    buildIronCondor(snap),
    buildIronFly(snap),
    buildCalendar(snap),
    buildEarnings(snap),
  ];
  return list.filter((q): q is StrategyQuote => q !== null && !q.rejected);
}

router.get("/scoring/leaderboard", async (_req, res): Promise<void> => {
  const scores = [];
  for (const symbol of UNIVERSE_SYMBOLS) {
    const snap = getSnapshot(symbol);
    if (!snap) continue;
    for (const q of quotesFor(snap)) {
      scores.push(scoreQuote(snap, q));
    }
  }

  const sorted = scores
    .filter((s) => s.tier !== "ignore")
    .sort((a, b) => b.totalScore - a.totalScore)
    .slice(0, 20);

  res.json(GetScoringLeaderboardResponse.parse(sorted));
});

router.get("/scoring/:symbol", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.symbol) ? req.params.symbol[0] : req.params.symbol;
  const symbol = raw.toUpperCase();
  const snap = getSnapshot(symbol);

  if (!snap) {
    res.status(404).json({ error: "Symbol not in universe" });
    return;
  }

  const quotes = quotesFor(snap);
  const best = quotes.sort((a, b) => b.ravishScore - a.ravishScore)[0] ?? buildIronCondor(snap);
  res.json(GetRavishScoreResponse.parse(scoreQuote(snap, best)));
});

export default router;
