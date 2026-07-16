import { Router, type IRouter } from "express";
import {
  GetOptionChainResponse,
  GetUniverseResponse,
  GetExpirationsResponse,
} from "@workspace/api-zod";
import {
  UNIVERSE,
  getSnapshot,
  bs,
  strikeStep,
  expirationFromDte,
  makeRng,
  todayStr,
} from "../lib/optionsMath.js";

const router: IRouter = Router();

router.get("/options/chain/:symbol", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.symbol) ? req.params.symbol[0] : req.params.symbol;
  const symbol = raw.toUpperCase();
  const snap = getSnapshot(symbol);

  if (!snap) {
    res.status(404).json({ error: "Symbol not in universe" });
    return;
  }

  const dte = 45;
  const T = dte / 365;
  const expiration = expirationFromDte(dte);
  const step = strikeStep(snap.price);
  const rng = makeRng(`${symbol}|chain|${todayStr()}`);

  const strikes: number[] = [];
  const atm = Math.round(snap.price / step) * step;
  for (let i = -10; i <= 10; i++) strikes.push(atm + i * step);

  const half = snap.spreadPct / 2;
  const build = (strike: number, type: "call" | "put") => {
    const g = bs(snap.price, strike, T, snap.iv, type);
    const mid = g.price;
    return {
      strike,
      type,
      expiration,
      bid: Math.max(0.01, Math.round(mid * (1 - half) * 100) / 100),
      ask: Math.round(mid * (1 + half) * 100) / 100,
      mid: Math.round(mid * 100) / 100,
      delta: Math.round(g.delta * 1000) / 1000,
      theta: Math.round(g.theta * 1000) / 1000,
      vega: Math.round(g.vega * 1000) / 1000,
      gamma: Math.round(g.gamma * 10000) / 10000,
      iv: snap.iv,
      openInterest: Math.round(snap.openInterest * (0.4 + rng() * 1.2)),
      volume: Math.round(snap.openInterest * (0.05 + rng() * 0.3)),
    };
  };

  res.json(
    GetOptionChainResponse.parse({
      symbol,
      underlyingPrice: snap.price,
      ivRank: snap.ivRank,
      iv30: snap.iv,
      earningsDate:
        snap.earningsInDays !== null ? expirationFromDte(snap.earningsInDays) : null,
      expiration,
      calls: strikes.map((s) => build(s, "call")),
      puts: strikes.map((s) => build(s, "put")),
    }),
  );
});

router.get("/options/universe", async (_req, res): Promise<void> => {
  const symbols = UNIVERSE.map((u) => {
    const snap = getSnapshot(u.symbol)!;
    return {
      symbol: snap.symbol,
      name: snap.name,
      price: snap.price,
      change: snap.change,
      changePercent: snap.changePercent,
      ivRank: snap.ivRank,
      iv30: snap.iv,
      earningsDate:
        snap.earningsInDays !== null ? expirationFromDte(snap.earningsInDays) : null,
      volume: snap.openInterest * 1000,
    };
  });

  res.json(GetUniverseResponse.parse(symbols));
});

router.get("/options/expirations/:symbol", async (_req, res): Promise<void> => {
  const expirations = [7, 14, 21, 28, 35, 45, 60, 90, 120, 180].map((days) => ({
    date: expirationFromDte(days),
    daysToExpiry: days,
  }));

  res.json(GetExpirationsResponse.parse(expirations));
});

export default router;
