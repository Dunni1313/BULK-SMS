// Minimal Server-Sent Events helper for streaming coach narrations.
//
// SSE is intentionally hand-rolled (not part of the OpenAPI/Orval contract):
// the generated react-query client only understands single-shot JSON, so the
// streaming endpoints are consumed by a small bespoke client on the frontend.
//
// Event protocol used by the coach streaming endpoints:
//   event: meta   — one structured payload sent first (deterministic facts)
//   event: delta  — incremental text chunks (zero or more)
//   event: done   — final authoritative payload (full text + source)
//   event: error  — a failure after the stream was already opened

import type { Response } from "express";

export interface SseChannel {
  send(event: string, data: unknown): void;
  close(): void;
}

// How often to emit a keep-alive comment while the LLM is thinking. SSE comment
// lines (starting with ":") are ignored by clients but keep the reverse proxy
// from idle-timing-out the connection (a 502) during the ~10-20s LLM wait —
// e.g. between the `meta` event and the first `delta`, or while a single-flight
// follower waits on the in-flight leader.
const HEARTBEAT_MS = 15_000;

export function openSse(res: Response): SseChannel {
  res.status(200);
  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  // Disable proxy buffering so chunks arrive incrementally through the
  // reverse proxy instead of being held until the response closes.
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders?.();

  const heartbeat = setInterval(() => {
    // A standalone comment frame; never interleaves mid-event because each
    // send() below is a single atomic write.
    try {
      res.write(`: keep-alive\n\n`);
    } catch {
      clearInterval(heartbeat);
    }
  }, HEARTBEAT_MS);
  // Stop pinging if the client hangs up before close() runs.
  res.on("close", () => clearInterval(heartbeat));

  return {
    send(event: string, data: unknown): void {
      // Single write so a heartbeat can only land between whole events.
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    },
    close(): void {
      clearInterval(heartbeat);
      res.end();
    },
  };
}
