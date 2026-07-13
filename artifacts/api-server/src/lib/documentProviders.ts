// Phase 2, Sprint 22 — Document Intelligence Engine: ingestion abstraction
// (approved Phase 2 plan, Sprint 22). Mirrors fundamentals.ts's
// FundamentalsProvider seam: a small interface any document source can
// implement, so future document types (10-Q, earnings-transcript, investor-
// presentation, sustainability-report, management-commentary) plug in without
// touching this interface or any caller.
//
// CRITICAL CONTRACT: unlike Fundamentals, there is no SIMULATED path here — a
// document is either successfully fetched from a real source (dataSource
// "LIVE") or honestly unavailable (null). Fabricating placeholder filing text
// would risk being mistaken for real disclosure content, a categorically
// different (and worse) kind of dishonesty than a fabricated number. See
// filingAnalysis.ts for how an unavailable document degrades gracefully
// rather than failing the whole analysis.
//
// LIVE VERIFICATION IS DEFERRED — this session's outbound proxy denies
// data.sec.gov (confirmed via a live connectivity probe: 403, policy denial),
// the same situation as this codebase's FMP/Alpha Vantage integrations lacking
// API keys. EdgarDocumentProvider is built and covered by mocked-fetch tests
// only, never exercised against the real SEC API in this session.

import { isValidTickerShape } from "./investingUniverse.js";

export type DocumentType =
  | "10-K"
  | "10-Q"
  | "earnings-transcript"
  | "investor-presentation"
  | "sustainability-report"
  | "management-commentary";

export interface FetchDocumentOpts {
  forceRefresh?: boolean;
}

export interface RawDocument {
  symbol: string;
  documentType: DocumentType;
  filingDate: string | null; // YYYY-MM-DD
  sourceUrl: string;
  accessionNumber: string | null;
  fetchedAt: string; // ISO-8601
  html: string;
}

export interface DocumentProvider {
  readonly id: string;
  fetchDocument(symbol: string, documentType: DocumentType, opts?: FetchDocumentOpts): Promise<RawDocument | null>;
}

const SEC_USER_AGENT = "DK-AI-Institutional-Investing-OS research-tool contact@example.com";

async function fetchText(url: string, timeoutMs = 15000): Promise<string> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(url, { signal: ctrl.signal, headers: { "User-Agent": SEC_USER_AGENT, Accept: "*/*" } });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.text();
  } finally {
    clearTimeout(t);
  }
}

async function fetchJson(url: string, timeoutMs = 15000): Promise<unknown> {
  const text = await fetchText(url, timeoutMs);
  return JSON.parse(text) as unknown;
}

// SEC's own ticker->CIK mapping (a single static file covering every listed
// company, refreshed periodically by SEC — not per-symbol). Cached in-process
// with a long TTL since it rarely changes and is ~700KB; avoids fetching it on
// every single filing lookup.
const TICKER_MAP_TTL_MS = 24 * 60 * 60 * 1000;
let tickerMapCache: { at: number; map: Map<string, string> } | undefined;

async function loadTickerToCik(): Promise<Map<string, string>> {
  if (tickerMapCache && Date.now() - tickerMapCache.at < TICKER_MAP_TTL_MS) return tickerMapCache.map;
  const raw = (await fetchJson("https://www.sec.gov/files/company_tickers.json")) as Record<
    string,
    { cik_str: number; ticker: string; title: string }
  >;
  const map = new Map<string, string>();
  for (const entry of Object.values(raw)) {
    map.set(entry.ticker.toUpperCase(), String(entry.cik_str).padStart(10, "0"));
  }
  tickerMapCache = { at: Date.now(), map };
  return map;
}

interface EdgarFiling {
  form: string;
  filingDate: string;
  accessionNumber: string;
  primaryDocument: string;
}

function parseRecentFilings(submissions: unknown): EdgarFiling[] {
  const recent = (submissions as { filings?: { recent?: Record<string, unknown[]> } })?.filings?.recent;
  if (!recent) return [];
  const forms = (recent.form ?? []) as string[];
  const dates = (recent.filingDate ?? []) as string[];
  const accessions = (recent.accessionNumber ?? []) as string[];
  const primaryDocs = (recent.primaryDocument ?? []) as string[];
  const out: EdgarFiling[] = [];
  for (let i = 0; i < forms.length; i++) {
    out.push({
      form: forms[i],
      filingDate: dates[i],
      accessionNumber: accessions[i],
      primaryDocument: primaryDocs[i],
    });
  }
  return out;
}

// SEC Financial Modeling Prep / Alpha Vantage — Financial Reports (10-K/10-Q).
// Only "10-K" is implemented this sprint; any other DocumentType honestly
// throws rather than fabricating a result. Future sprints add real
// implementations (transcripts, presentations, etc.) alongside this one,
// never by modifying it.
export class EdgarDocumentProvider implements DocumentProvider {
  readonly id = "edgar";

  async fetchDocument(
    symbol: string,
    documentType: DocumentType,
    _opts?: FetchDocumentOpts,
  ): Promise<RawDocument | null> {
    if (documentType !== "10-K") {
      throw new Error(`EdgarDocumentProvider does not yet support document type "${documentType}"`);
    }
    const sym = symbol.toUpperCase();
    if (!isValidTickerShape(sym)) return null;

    const tickerMap = await loadTickerToCik();
    const cik = tickerMap.get(sym);
    if (!cik) return null; // honestly unknown to SEC — not a fabricated "no filing"

    const submissions = await fetchJson(`https://data.sec.gov/submissions/CIK${cik}.json`);
    const filings = parseRecentFilings(submissions);
    const tenK = filings.find((f) => f.form === "10-K");
    if (!tenK) return null;

    const accessionNoDashes = tenK.accessionNumber.replace(/-/g, "");
    const sourceUrl = `https://www.sec.gov/Archives/edgar/data/${parseInt(cik, 10)}/${accessionNoDashes}/${tenK.primaryDocument}`;
    const html = await fetchText(sourceUrl, 25000);

    return {
      symbol: sym,
      documentType: "10-K",
      filingDate: tenK.filingDate,
      sourceUrl,
      accessionNumber: tenK.accessionNumber,
      fetchedAt: new Date().toISOString(),
      html,
    };
  }
}
