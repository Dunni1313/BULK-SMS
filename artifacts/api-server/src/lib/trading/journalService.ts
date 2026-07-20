// Phase 24 — Institutional Trading Engine Foundation.
//
// Journal service boundary. Trading Journal itself already exists, fully
// built and shipped (Sprint 39/46) — full CRUD lives directly in
// routes/tradingJournal.ts (list/create/get/update/delete), mirroring
// routes/journal.ts's own established pattern, with no separate lib
// module of its own to facade over.
//
// This file's job is narrower and genuinely new: it gives any future
// Engine 2 module (a Trade Plan wanting to link to the journal entry that
// closed it out, a future Reporting module wanting journal data) one
// stable import point for the table/row shape, instead of reaching into
// @workspace/db directly or duplicating the row type. Zero new query
// logic, zero new route.

export {
  tradingJournalEntriesTable,
  type TradingJournalEntryRow,
} from "@workspace/db";
