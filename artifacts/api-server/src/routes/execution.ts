import { Router, type IRouter } from "express";
import {
  PreviewExecutionBody,
  SubmitExecutionBody,
  PreviewExecutionResponse,
  PreviewAdjustmentExecutionBody,
  SubmitAdjustmentExecutionBody,
} from "@workspace/api-zod";
import {
  previewOptionOrder,
  submitOptionOrder,
  previewAdjustmentOrder,
  submitAdjustmentOrder,
  TicketError,
  type ExecutionTicket,
} from "../lib/execution.js";
import { getScopedUserId } from "../lib/tenantScope.js";

const router: IRouter = Router();

// Strip the persistence-only fields before serializing a ticket to the client.
function publicTicket(t: ExecutionTicket) {
  const { _quote, _storedLegs, ...rest } = t as ExecutionTicket & {
    _quote: unknown;
    _storedLegs: unknown;
    _scannerResultId?: unknown;
  };
  void _quote;
  void _storedLegs;
  const { _scannerResultId, ...clean } = rest as Record<string, unknown>;
  void _scannerResultId;
  return clean;
}

router.post("/execution/preview", async (req, res): Promise<void> => {
  const parsed = PreviewExecutionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  try {
    const userId = await getScopedUserId(req);
    const ticket = await previewOptionOrder({
      scannerResultId: parsed.data.scannerResultId ?? null,
      symbol: parsed.data.symbol ?? null,
      strategy: parsed.data.strategy ?? null,
      quantity: parsed.data.quantity,
    }, userId);
    res.json(PreviewExecutionResponse.parse(publicTicket(ticket)));
  } catch (err) {
    if (err instanceof TicketError) {
      res.status(err.status).json({ error: err.message });
      return;
    }
    req.log.error({ err }, "execution preview failed");
    res.status(500).json({ error: "Failed to build execution preview" });
  }
});

router.post("/execution/submit", async (req, res): Promise<void> => {
  const parsed = SubmitExecutionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  try {
    const userId = await getScopedUserId(req);
    const result = await submitOptionOrder({
      scannerResultId: parsed.data.scannerResultId ?? null,
      symbol: parsed.data.symbol ?? null,
      strategy: parsed.data.strategy ?? null,
      quantity: parsed.data.quantity,
      confirm: parsed.data.confirm,
    }, userId);
    res.status(201).json({
      orderId: result.orderId,
      status: result.status,
      broker: result.broker,
      tradeId: result.tradeId,
      journalId: result.journalId,
      message: result.message,
      ticket: publicTicket(result.ticket),
    });
  } catch (err) {
    if (err instanceof TicketError) {
      res.status(err.status).json({ error: err.message });
      return;
    }
    req.log.error({ err }, "execution submit failed");
    res.status(500).json({ error: "Failed to submit order" });
  }
});

router.post("/execution/adjustment/preview", async (req, res): Promise<void> => {
  const parsed = PreviewAdjustmentExecutionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  try {
    const userId = await getScopedUserId(req);
    const ticket = await previewAdjustmentOrder({
      tradeId: parsed.data.tradeId,
      quantity: parsed.data.quantity ?? null,
    }, userId);
    res.json(PreviewExecutionResponse.parse(publicTicket(ticket)));
  } catch (err) {
    if (err instanceof TicketError) {
      res.status(err.status).json({ error: err.message });
      return;
    }
    req.log.error({ err }, "adjustment preview failed");
    res.status(500).json({ error: "Failed to build roll/convert preview" });
  }
});

router.post("/execution/adjustment/submit", async (req, res): Promise<void> => {
  const parsed = SubmitAdjustmentExecutionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  try {
    const userId = await getScopedUserId(req);
    const result = await submitAdjustmentOrder({
      tradeId: parsed.data.tradeId,
      quantity: parsed.data.quantity ?? null,
      confirm: parsed.data.confirm,
    }, userId);
    res.status(201).json({
      orderId: result.orderId,
      status: result.status,
      broker: result.broker,
      tradeId: result.tradeId,
      journalId: result.journalId,
      message: result.message,
      ticket: publicTicket(result.ticket),
      closedTradeId: result.closedTradeId,
      closedReason: result.closedReason,
    });
  } catch (err) {
    if (err instanceof TicketError) {
      res.status(err.status).json({ error: err.message });
      return;
    }
    req.log.error({ err }, "adjustment submit failed");
    res.status(500).json({ error: "Failed to submit roll/convert order" });
  }
});

export default router;
