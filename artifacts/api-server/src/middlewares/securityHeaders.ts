// Phase 9 — Production Readiness.
//
// A small, dependency-free set of standard HTTP security response headers.
// Deliberately hand-written rather than installing the `helmet` package —
// every header set here is a single, well-understood, static string with
// no per-request computation and no configuration surface worth a whole
// dependency for; this keeps the change auditable in one file with zero
// new supply-chain surface.
//
// Every header below is a defense-in-depth response header, not a change
// to any request-handling, authentication, authorization, or business
// logic — this middleware never inspects or blocks a request, it only adds
// headers to the response before any route handler runs.
//
//   X-Content-Type-Options: nosniff
//     Stops a browser from MIME-sniffing a response into a different
//     content type than the server declared (e.g. treating a JSON error
//     body as executable script).
//   X-Frame-Options: DENY
//     Stops this app from being embedded in a third-party <iframe>
//     (clickjacking protection). This is an API + a single-origin SPA,
//     never meant to be framed by another site.
//   Referrer-Policy: strict-origin-when-cross-origin
//     Avoids leaking a full URL path (which can contain a symbol, a
//     portfolio id, etc.) to a third-party site's referrer logs, while
//     still sending the origin for same-site/cross-site-but-same-scheme
//     navigation, matching most browsers' own current default.
//   X-DNS-Prefetch-Control: off
//     Stops the browser from speculatively resolving DNS for links found
//     in a response before the user clicks them.
//   Strict-Transport-Security
//     Only set when the request actually arrived over TLS (checked via
//     req.secure, which respects Express's own "trust proxy" setting —
//     see app.ts's TRUST_PROXY handling) or the caller opts in via
//     FORCE_HSTS=true for a local HTTPS-terminating-elsewhere deployment.
//     Never sent over plain HTTP: an HSTS header on an insecure response
//     is at best ignored and at worst actively wrong.
//
// Deliberately NOT set here: Content-Security-Policy. A real CSP for this
// app's actual script/style/connect sources needs a real inventory of
// every third-party origin the frontend legitimately talks to — getting
// it wrong either breaks the app (too strict) or provides no real
// protection (too loose, e.g. 'unsafe-inline' everywhere). That inventory
// is real, disclosed technical debt (see the Security Review), not
// silently done here with a guessed policy.

import type { Request, Response, NextFunction } from "express";

export function securityHeaders(req: Request, res: Response, next: NextFunction): void {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("X-DNS-Prefetch-Control", "off");

  if (req.secure || process.env.FORCE_HSTS === "true") {
    // 180 days, includeSubDomains — a conservative, standard starting
    // value; not `preload`, since opting into the browser preload list is
    // a one-way, hard-to-reverse decision that belongs to a real deployment
    // owner, not a default baked into application code.
    res.setHeader("Strict-Transport-Security", "max-age=15552000; includeSubDomains");
  }

  next();
}
