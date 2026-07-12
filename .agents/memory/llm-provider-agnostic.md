---
name: LLM provider-agnostic key handling
description: Why the LLM layer detects key prefix instead of assuming OpenAI, and the working Anthropic model on this account.
---

# Provider-agnostic LLM key handling

The env var named `OPENAI_API_KEY` on this project actually contains an **Anthropic** key
(prefix `sk-ant-`). Do not assume the OpenAI SDK.

**Rule:** the LLM wrapper detects the key prefix at runtime — `sk-ant-` → Anthropic
(`@anthropic-ai/sdk`), otherwise the OpenAI SDK.

**Why:** a previous integration silently 401'd because it hardcoded the OpenAI client
against an Anthropic key. The key name lies; trust the prefix.

**How to apply:** when adding any LLM call, go through the existing provider-agnostic
wrapper. Default Anthropic model is `claude-haiku-4-5-20251001` — the alias
`claude-3-5-haiku-latest` returns 404 on this account (only claude-4.x models are
provisioned). Always degrade to a deterministic template on any LLM error; the request
must never crash because the model failed.
