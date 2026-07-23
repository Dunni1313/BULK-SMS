# Portfolio Risk Framework

**Phase 13 — Institutional Portfolio Manager.** This document describes the full portfolio-level risk framework: the 3 dimensions that already existed (`lib/investingRisk.ts`, Phase 2 Sprint 29, unchanged) and the 5 new extended dimensions this phase added in `lib/portfolioIntelligence.ts`. Every dimension explains its score, label, and detail sentence honestly — a dimension is `null` only when there is genuinely insufficient data, never a fabricated reading.

## 1. Already-existing dimensions (`lib/investingRisk.ts`, unmodified)

| Dimension | What it measures | Cap / threshold |
|---|---|---|
| **Overall** | A weighted blend of the 3 below, with a hard-cap override (capped at 60 if either cap is breached, regardless of the blend) | — |
| **Concentration** | The largest single holding's share of total market value | 25% (`SINGLE_SYMBOL_CONCENTRATION_CAP_PCT`) |
| **Sector Exposure** | The largest single sector's share of total market value, with a full per-sector breakdown | 40% (`SECTOR_CONCENTRATION_CAP_PCT`) |
| **Cyclicality** (internally `betaEstimate`) | A market-value-weighted portfolio beta, renormalized over only holdings with a known beta | Banded Low/Moderate/Elevated/High |

`band()` and `gradeLabel()` (the banding helper and the 5-tier Excellent/Strong/Moderate/Elevated/Poor vocabulary) were exported this phase — a behavior-preserving change confirmed by this module's own pre-existing tests — so every new dimension below reuses the exact same convention instead of a second, subtly different classifier.

## 2. New extended dimensions (`lib/portfolioIntelligence.ts`)

### 2.1 Cash Risk
Derived from **Cash Allocation** (`100% - Σ(target weights)`, clamped at 0) — the share of a portfolio's own stated target weights left unassigned to any holding. **Honestly defined, never a claim about an actual brokerage cash balance**, which this platform does not observe. Banded: ≤10% scores 90 (within normal range), ≤20% scores 70, ≤35% scores 45, else 20 (meaningfully under-invested relative to the portfolio's own targets).

### 2.2 Dividend Dependence
Derived from the market-value-weighted dividend yield (see `docs/Portfolio-Scoring.md` §5). Banded: ≤2% scores 85 (modest income dependence), ≤4% scores 65, ≤6% scores 45, else 30 (a meaningful share of expected return depends on continued dividend payments — a sensitivity flag, not a claim dividends are bad).

### 2.3 Leverage Exposure
Derived from the market-value-weighted debt-to-equity ratio. Banded: ≤0.3× scores 90, ≤0.7× scores 70, ≤1.5× scores 45, else 20.

### 2.4 Quality Drift
Compares the current Portfolio Quality Score against the most recently **saved** composite snapshot's own quality score (never a live external benchmark). Honestly `null`/"Insufficient data" until at least one snapshot has been saved (the never-persist-unless-asked discipline the existing Risk snapshot already established, Sprint 27–29). `Improving` (≥+10 points), `Stable` (within ±10), or `Deteriorating` (≤-10).

### 2.5 Portfolio Stability
A composite blending Overall Risk and Quality Drift — the only two signals available today — over whichever of the two are actually computable. Never fabricated when neither is available.

## 3. Snapshots — two separate, coexisting tables

- **`investing_risk_snapshots`** (Phase 2, Sprint 29, unchanged) — captures only the 3 original risk dimensions above, via the existing "Save Risk Snapshot" button.
- **`investing_portfolio_snapshots`** (new, Phase 13) — captures the full composite (`qualityScore`, `riskScore`, `diversificationScore`, plus the full `PortfolioIntelligenceAnalysis` blob) via a separate "Save Portfolio Snapshot" button. The two are deliberately distinct: the risk-only table is untouched, and the new table is what Quality Drift reads from.

Both are explicit-save-only — risk/quality is never persisted automatically on a plain read.

## 4. Never-fabricate discipline, explicitly

- A holding with an unresolvable symbol or unknown sector/beta is **excluded** from that specific dimension's calculation, renormalized over the holdings that do have the data — never silently treated as 0 or averaged in as if known.
- Country and Currency exposure (see `docs/Portfolio-Scoring.md` §4) are not risk dimensions in this framework at all — they are always honestly `unavailable`, and no attempt is made to derive a proxy risk reading from their absence.
- No dimension here is ever surfaced as a trade/rebalancing instruction — this framework is advisory/educational analysis only.

## Cross-references

- `docs/Institutional-Portfolio-Manager.md` — the full module overview.
- `docs/Portfolio-Scoring.md` — the Quality/Capital-Allocation/Diversification/Income scoring methodology.
