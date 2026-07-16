// Lightweight Server-Sent Events client for the coach's streaming endpoints.
//
// The streaming coach routes (under /api) are deliberately NOT part of the
// OpenAPI/orval contract — orval only models single-shot JSON responses. They
// emit `text/event-stream` with named events (`meta`, `delta`, `done`, `error`).
// The generated client bakes the `/api` base prefix into request URLs, so we
// mirror that here by prefixing paths with `/api`.

const API_PREFIX = "/api";

export interface SseHandlers {
  /** Fired once before any delta with deterministic context (lesson, source…). */
  onMeta?: (data: unknown) => void;
  /** Fired for each streamed text chunk. Append to the displayed text. */
  onDelta?: (text: string) => void;
  /** Fired once at the end with the authoritative final payload. */
  onDone?: (data: unknown) => void;
  /** Fired on a server-signalled stream error event. */
  onError?: (message: string) => void;
}

interface ParsedEvent {
  event: string;
  data: string;
}

function parseSseChunk(raw: string): ParsedEvent | null {
  let event = "message";
  const dataLines: string[] = [];
  for (const line of raw.split("\n")) {
    if (line.startsWith("event:")) {
      event = line.slice(6).trim();
    } else if (line.startsWith("data:")) {
      dataLines.push(line.slice(5).replace(/^ /, ""));
    }
  }
  if (dataLines.length === 0) return null;
  return { event, data: dataLines.join("\n") };
}

/**
 * POST `body` to a streaming coach endpoint and dispatch parsed SSE events to
 * the supplied handlers. Resolves when the stream closes. Rejects if the
 * connection fails or the server returns a non-OK status before the stream
 * opens (e.g. a 400/404 JSON validation error).
 */
export async function streamCoach(
  path: string,
  body: unknown,
  handlers: SseHandlers,
  signal?: AbortSignal,
): Promise<void> {
  const res = await fetch(`${API_PREFIX}${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "text/event-stream",
    },
    body: JSON.stringify(body),
    signal,
  });

  if (!res.ok) {
    // Validation/lookup errors are returned as JSON before the SSE stream opens.
    let message = `Request failed (${res.status})`;
    try {
      const json = await res.json();
      if (json && typeof json.error === "string") message = json.error;
    } catch {
      // ignore — fall back to status message
    }
    throw new Error(message);
  }

  if (!res.body) {
    throw new Error("Streaming is not supported in this environment");
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  const dispatch = (chunk: string) => {
    const parsed = parseSseChunk(chunk);
    if (!parsed) return;
    let data: unknown = parsed.data;
    try {
      data = JSON.parse(parsed.data);
    } catch {
      // leave as raw string
    }
    switch (parsed.event) {
      case "meta":
        handlers.onMeta?.(data);
        break;
      case "delta": {
        const text =
          data && typeof data === "object" && "text" in data
            ? String((data as { text: unknown }).text)
            : String(data);
        handlers.onDelta?.(text);
        break;
      }
      case "done":
        handlers.onDone?.(data);
        break;
      case "error": {
        const msg =
          data && typeof data === "object" && "error" in data
            ? String((data as { error: unknown }).error)
            : "Stream error";
        handlers.onError?.(msg);
        break;
      }
    }
  };

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let sep: number;
    while ((sep = buffer.indexOf("\n\n")) !== -1) {
      const chunk = buffer.slice(0, sep);
      buffer = buffer.slice(sep + 2);
      if (chunk.trim()) dispatch(chunk);
    }
  }

  // Flush any trailing event that wasn't terminated by a blank line.
  buffer += decoder.decode();
  if (buffer.trim()) dispatch(buffer);
}
