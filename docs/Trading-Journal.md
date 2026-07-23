# Trading Journal

This document covers the trading journal system as it exists after the
**Trade History, Performance Analytics & Trading Journal** sprint (Options
Income Engine, Paper Trading track). It is a companion to
`docs/Alpaca-Paper-Trading-Architecture.md` §4.7, which covers the same
sprint's Trade History and Performance Analytics pages — read that document
for the broader sprint context; this one is scoped to the journal itself.

---

## 1. What the journal is

`journal_entries` is a pre-existing table (Phase 1) holding free-form trading
notes, optionally linked to a specific `trades` row via a loose, unenforced
`trade_id` reference (never a foreign key — matching this codebase's
established "loose reference" convention for cross-referencing a trade from
an adjacent table, the same pattern later reused by
`trading_journal_entries.trading_position_id` on the Engine 2 side).

Two entry points exist into the same table and the same rows:

1. **`/journal`** (`pages/Journal.tsx`) — the original, general-purpose
   journal page: a list of every entry plus a "New Entry" form, with an
   existing AI Coach review feature (`streamCoach()`). **This page is
   completely unmodified by this sprint** — it still works exactly as it did
   before, and remains the place to write a journal entry that isn't tied to
   any specific trade.
2. **`/trade-history`** (`pages/TradeHistory.tsx`, new this sprint) — each
   trade row can be expanded into a detail panel that shows and edits the
   journal entry associated with that trade (matched by `tradeId`), so a
   trader reviewing their trade history doesn't have to cross-reference a
   separate page to find the notes for a specific trade.

No new journal page was created. Journal editing was added to the existing
Trade History detail panel instead of duplicating `/journal`'s own list/edit
UI — deliberately, to avoid two independent editors for the same
underlying rows.

---

## 2. New fields added this sprint

Two new nullable `text` columns were added to `journal_entries`
(`lib/db/manual-migrations/017_journal_thesis_entry_reasoning.sql`,
additive, `IF NOT EXISTS`-guarded, with a documented rollback):

- **`thesis`** — the overall case for taking the trade (why this trade, why
  now, what's the setup).
- **`entry_reasoning`** — what specifically triggered entry (the technical
  or fundamental signal that made this the right moment).

Both are surfaced on the `JournalEntry`/`JournalEntryInput`/
`JournalEntryUpdate` OpenAPI schemas as ordinary optional/nullable string
fields — a purely additive schema change. **Zero code changes were needed in
`routes/journal.ts`**: `formatEntry()` already spreads every column of the
row (`{...e, ...}`), and `PATCH /journal/:id` already does a generic
`db.update(journalEntriesTable).set(parsed.data)` — both patterns pick up
new columns automatically the moment the OpenAPI schema and Drizzle schema
know about them, with no route-level logic change required.

### Exit Reasoning — no new column

The request scope asked for "Exit reasoning" to be shown per trade. Rather
than add a third new column duplicating existing data, this reuses the
**already-existing `trades.exit_reason`** field (set by the existing,
untouched `tradeClose.ts` close-position logic) — shown directly on the
Trade History detail panel, read-only, sourced from the trade itself, not
from the journal entry. This avoids two different, possibly-conflicting
"why did I exit" fields for the same trade.

### Lessons Learned, Trade Notes

Both already existed on `journal_entries` before this sprint
(`lessonLearned`, `content`) and are unchanged — surfaced as-is in both the
`/journal` page and the new Trade History detail panel.

---

## 3. Editing from Trade History

`TradeHistory.tsx`'s per-row detail panel includes a `JournalEntryEditor`
sub-component that:

- Looks up the journal entry (if any) whose `tradeId` matches the expanded
  trade's `id`, from the same `useListJournalEntries()` list already fetched
  for the page (no extra network call per row).
- If a matching entry exists, shows its Notes / Thesis / Entry Reasoning /
  Lessons Learned in editable text areas, and an editable-in-place "Save"
  flow via the existing `useUpdateJournalEntry()` mutation
  (`PATCH /journal/:id`) — the same endpoint `/journal` itself already uses,
  reused unmodified.
- If no matching entry exists for that trade, shows an honest "No journal
  entry for this trade yet" message rather than fabricating an empty form
  that silently creates a new entry — **creating new trade-linked journal
  entries from Trade History is out of scope for this sprint**; a trader who
  wants a fresh entry for a trade still uses `/journal`'s own "New Entry"
  form (which already supports an optional `tradeId` field) or a future
  sprint can add a "create for this trade" shortcut.

No new mutation endpoint was added. `useCreateJournalEntry()` /
`useUpdateJournalEntry()` are the exact same generated hooks `/journal`
already used before this sprint.

---

## 4. AI review placeholder

Per the explicit instruction for this sprint ("AI review placeholder... do
not add AI generation yet"), the Trade History detail panel shows a static,
non-interactive placeholder line noting that an AI-generated trade review is
not yet available — **no LLM call is made from this panel**. This is
distinct from `/journal`'s own pre-existing, already-shipped AI Coach review
feature (`streamCoach()`), which is untouched and continues to work exactly
as before on that page. A future sprint could wire the Trade History panel
into that same existing coach infrastructure; this sprint deliberately does
not.

---

## 5. Broker reconciliation summary

The Trade History detail panel also shows a compact broker-reconciliation
summary for the expanded trade, reusing the exact same `GET
/broker/reconciliation` endpoint (unmodified, `lib/brokerReconciliation.ts`,
shipped in an earlier sprint this session) that both `PaperTradingReconciliation.tsx`
and `PaperPortfolio.tsx` already consume — **no new broker endpoint was
added for this sprint**. The check is manual-only: `useGetBrokerReconciliation`
is called with `{ enabled: false }`, and a "Check Reconciliation" button
triggers `refetch()` — matching the established manual-only broker-interaction
convention from every prior broker-touching sprint this session. See
`docs/Alpaca-Paper-Trading-Architecture.md` §4.7 for the full detail on how
local trade status, broker status, mismatches, fill quantity, average fill
price, and last-reconciliation time are derived and displayed, and for the
honest "Simulated (no broker order)" label shown for trades whose
`alpacaOrderId` starts with `mock-` (never sent to Alpaca at all, so they
are never compared against real broker data).

---

## 6. What this sprint did not change

- `pages/Journal.tsx`, `routes/journal.ts`'s route logic, and every
  pre-existing journal endpoint's request/response shape for
  already-existing fields — unchanged.
- No AI-generated content of any kind is written to `journal_entries` by
  this sprint's code.
- No execution, order-routing, or risk logic — `execution.ts`,
  `optionsMath.ts`, `risk.ts`, `autoExecution.ts`, `autoAdjustment.ts` are
  untouched.
- No broker write operations — every broker interaction remains read-only,
  Paper-only, and manually triggered.

---

## 7. Cross-references

- `docs/Alpaca-Paper-Trading-Architecture.md` §4.7 — the full Trade History
  / Performance Analytics / broker cross-reference detail for the sprint
  this document is a companion to.
- `docs/Broker-Health-API.md` — the underlying account-verification
  endpoint.
- `docs/Operations-Handbook.md` — day-to-day operational usage.
