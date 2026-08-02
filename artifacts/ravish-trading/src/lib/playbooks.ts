// v1.5.0, Sprint 18 — Institutional Playbooks & Operating Procedures Engine.
//
// NOT another Learning Centre. NOT another Workflow Engine. NOT another
// Knowledge Graph. This module defines HOW institutional workflows are
// executed consistently — a Playbook is a documented, repeatable
// operating procedure whose every stage points at an existing module.
// Playbooks orchestrate; they never duplicate functionality.
//
// ─── REUSE MAP (see docs/v1.5.0-Sprint-18-Institutional-Playbooks.md for
// the full narrative version) ───────────────────────────────────────────
//   Trade lifecycle stage/checklist/journal/decision signals -> the same
//     PipelineStageId/TradeLifecycleRecord shape lib/tradeLifecycle.ts
//     (Sprint 14) and lib/decisionWorkflow.ts (Sprint 13) already compute
//     — playbookProgress.ts (this sprint) reads those fields directly,
//     never re-deriving stage math of its own.
//   Research/Strategy readiness -> the exact same notebooksByCoach/
//     strategiesByCoach aggregate signals lib/workflowAutomation.ts
//     (Sprint 16) already computes for its own research-to-notebook/
//     notebook-to-strategy tasks.
//   Portfolio/Risk cadence -> lib/portfolioRiskIntelligence.ts's own
//     PortfolioHealthScore/RiskIntelligenceReport (Sprint 15).
//   Checklist templates -> the platform ALREADY has a coach-specific
//     checklist-template system (TRADE_PLAN_CHECKLIST_TEMPLATES,
//     artifacts/api-server/src/lib/tradePlanChecklistTemplates.ts, Sprint
//     10) applied per Trade Plan via applyTradePlanChecklistTemplate() —
//     this sprint's "Templates" requirement links to that existing system
//     rather than inventing a second one.
//   AI Coach -> the same deterministic-narrative pattern established by
//     buildDecisionCoachNarrative()/buildPortfolioCoachNarrative()/
//     buildWorkflowCoachNarrative()/answerKnowledgeQuestion() (Sprints
//     13/15/16/17) — see playbookProgress.ts's buildPlaybookCoachNarrative().
//   Knowledge Graph -> lib/knowledgeGraph.ts's own relatedEntities()/
//     relatedEntitiesWithinTwoHops()/discoverPatterns() (Sprint 17), called
//     directly from the execution page for whichever entity a playbook is
//     currently bound to — never a second, duplicate graph.
//   Search -> components/command/CommandPalette.tsx (Phase 10), extended
//     this sprint with a "Playbooks" group — never a second search engine.
//
// A Playbook is pure, static, version-controlled content (a plain
// TypeScript literal, the same "deterministic, never LLM-generated"
// discipline lib/learningPaths.ts already established for Learning
// Centre content) — never a database row, mirroring
// tradePlanChecklistTemplates.ts's own "a new template is a one-line
// addition, never a migration" precedent exactly.

export type PlaybookId =
  | "investment-research"
  | "strategy-development"
  | "trade-planning"
  | "decision-review"
  | "execution-preparation"
  | "trade-management"
  | "post-trade-review"
  | "portfolio-review"
  | "risk-review"
  | "weekly-investment-committee"
  | "monthly-portfolio-review"
  | "quarterly-performance-review";

export type PlaybookCategory = "research-and-strategy" | "trade-lifecycle" | "portfolio-and-risk" | "cadence-review";

export const PLAYBOOK_CATEGORY_LABELS: Record<PlaybookCategory, string> = {
  "research-and-strategy": "Research & Strategy",
  "trade-lifecycle": "Trade Lifecycle",
  "portfolio-and-risk": "Portfolio & Risk",
  "cadence-review": "Cadence Review",
};

export interface PlaybookRelatedLearning {
  pathKey: string;
  topicKey: string;
  label: string;
}

/**
 * "auto": completion is derived honestly from real, already-computed
 * platform state (a trade plan's own currentStage, a notebook count, a
 * portfolio health signal) — never fabricated, and never claimed complete
 * without a real signal behind it.
 * "manual": no platform signal exists for this step (e.g. "held the
 * meeting," "read the report out loud to the committee") — self-certified
 * only, via a client-side acknowledgement, and always visually labeled as
 * such so it is never confused with a verified, automatic reading.
 */
export type PlaybookStageSignalType = "auto" | "manual";

export interface PlaybookStage {
  id: string;
  title: string;
  purpose: string;
  whyItMatters: string;
  requiredActions: string[];
  moduleLabel: string;
  moduleHref: string;
  signalType: PlaybookStageSignalType;
}

/**
 * Which kind of live context a playbook's stage-completion checks bind
 * to. "trade-plan" playbooks can optionally be pointed at one specific,
 * real Trade Plan (via lib/tradeLifecycle.ts's own TradeLifecycleRecord)
 * for entity-specific validation; "aggregate" playbooks are always scored
 * against the user's overall research/portfolio state, since they have no
 * single bound entity (e.g. a quarterly review isn't "about" one trade).
 */
export type PlaybookEntityBinding = "trade-plan" | "aggregate";

export interface Playbook {
  id: PlaybookId;
  category: PlaybookCategory;
  name: string;
  purpose: string;
  objective: string;
  prerequisites: string[];
  requiredInputs: string[];
  expectedOutputs: string[];
  validationRules: string[];
  commonMistakes: string[];
  institutionalNotes: string[];
  relatedLearning: PlaybookRelatedLearning[];
  relatedKnowledge: string;
  relatedWorkflows: string[];
  entityBinding: PlaybookEntityBinding;
  stages: PlaybookStage[];
}

export const PLAYBOOKS: Playbook[] = [
  // ─── 1. Investment Research ────────────────────────────────────────────
  {
    id: "investment-research",
    category: "research-and-strategy",
    name: "Investment Research",
    purpose: "Turn a raw idea into structured, evidence-backed research that a Strategy or Trade Plan can be built on.",
    objective: "Produce a Research Notebook with enough documented evidence, sourcing, and reasoning that someone else could review your conclusion without asking you to reconstruct it from memory.",
    prerequisites: ["A specific idea, symbol, sector, or theme worth investigating."],
    requiredInputs: ["The idea or question driving the research.", "Whatever source material you're drawing on (filings, price action, news, your own analysis)."],
    expectedOutputs: ["A Research Notebook with a clear title and at least one tag.", "Documented findings, not just a bookmark or a vague note."],
    validationRules: [
      "A Notebook exists for this idea before a Strategy or Trade Plan references it.",
      "The Notebook has at least one tag connecting it to a symbol or theme, so the Knowledge Graph can actually link it to what comes next.",
    ],
    commonMistakes: [
      "Researching in your head or in an external tool, then jumping straight to a Trade Plan — the reasoning behind the plan is lost the moment you forget it.",
      "Creating a Notebook with a title but no real content, then treating it as 'done.'",
      "Never tagging the Notebook, which silently breaks every downstream connection (Strategy, Trade Plan, Knowledge Graph) that depends on shared tags.",
    ],
    institutionalNotes: [
      "Institutional desks separate research from decision-making by design — a research note is written to be judged on its own evidence, independent of whether a trade eventually happens.",
      "A research trail that can be reconstructed later (why did I believe this?) is what actually compounds over a career — a single trade's outcome does not.",
    ],
    relatedLearning: [{ pathKey: "professional-workflows", topicKey: "workflow-research", label: "Research Workflow" }],
    relatedKnowledge: "The Knowledge Graph surfaces every existing Notebook, Strategy, and Trade Plan already sharing a tag with your research topic — so you can see what's already been investigated before duplicating work.",
    relatedWorkflows: ["research-to-notebook", "notebook-to-strategy"],
    entityBinding: "aggregate",
    stages: [
      {
        id: "capture-idea",
        title: "Capture the Idea",
        purpose: "State the idea or question in one or two sentences before doing anything else.",
        whyItMatters: "A vague idea produces vague research — writing the question down first forces clarity about what you're actually trying to find out.",
        requiredActions: ["Open the AI Assistant and start a new Notebook.", "Write the idea/question as the Notebook's title."],
        moduleLabel: "AI Assistant — Research Notebook",
        moduleHref: "/assistant",
        signalType: "auto",
      },
      {
        id: "document-evidence",
        title: "Document Evidence",
        purpose: "Record the actual findings, sources, and reasoning inside the Notebook — not just a conclusion.",
        whyItMatters: "Evidence written down is reviewable and falsifiable later; a conclusion alone is just an opinion with no way to check it.",
        requiredActions: ["Add findings, references, and reasoning to the Notebook.", "Tag the Notebook with the relevant symbol(s) or theme."],
        moduleLabel: "AI Assistant — Research Notebook",
        moduleHref: "/assistant",
        signalType: "auto",
      },
      {
        id: "check-existing-knowledge",
        title: "Check Existing Knowledge",
        purpose: "See whether this idea connects to research, trades, or lessons you've already captured.",
        whyItMatters: "Institutional research never starts from zero — checking your own prior work first avoids re-litigating a question you already answered.",
        requiredActions: ["Search the Knowledge & Intelligence Graph for the same symbol or theme.", "Review any connected past research, trades, or lessons before concluding."],
        moduleLabel: "Knowledge & Intelligence Graph",
        moduleHref: "/knowledge-graph",
        signalType: "manual",
      },
    ],
  },

  // ─── 2. Strategy Development ────────────────────────────────────────────
  {
    id: "strategy-development",
    category: "research-and-strategy",
    name: "Strategy Development",
    purpose: "Turn research into a written, repeatable rule set that future trade ideas can be evaluated against.",
    objective: "Produce an approved (active) Strategy with a complete rule set — entry logic, risk parameters, and the market conditions it's designed for.",
    prerequisites: ["At least one Research Notebook the strategy is grounded in."],
    requiredInputs: ["The research the strategy is based on.", "A clear statement of the edge or thesis the strategy is trying to capture."],
    expectedOutputs: ["A Strategy with status 'active', not left permanently in draft.", "All required strategy sections completed, not just a title."],
    validationRules: [
      "The Strategy references, directly or via a shared tag, the research it's grounded in.",
      "The Strategy has moved from 'draft' to 'active' before a Trade Plan is built on top of it — an unapproved rule set shouldn't yet be driving real trade ideas.",
    ],
    commonMistakes: [
      "Building a Strategy with no underlying research — a rule set invented on the spot is not a repeatable edge.",
      "Leaving strategies permanently in draft, so nothing ever formally graduates to 'this is how I trade this setup.'",
      "Writing an entry rule but skipping the risk parameters — half a strategy isn't a strategy.",
    ],
    institutionalNotes: [
      "A Strategy is the boundary between 'an idea I had once' and 'a process I can apply consistently' — institutional desks won't size a trade off a one-off idea, only off a documented, repeatable rule set.",
      "Retiring a strategy that stops working is as institutionally important as approving one that does — a permanently 'active' strategy that's quietly abandoned is a silent process failure.",
    ],
    relatedLearning: [{ pathKey: "professional-workflows", topicKey: "workflow-research", label: "Research Workflow" }],
    relatedKnowledge: "The Knowledge Graph shows every Trade Plan that has already used this Strategy, so you can see its real track record before relying on it further.",
    relatedWorkflows: ["notebook-to-strategy", "strategy-to-tradeplan"],
    entityBinding: "aggregate",
    stages: [
      {
        id: "draft-strategy",
        title: "Draft the Strategy",
        purpose: "Turn the research's core thesis into a written rule set.",
        whyItMatters: "A strategy that only exists in your head can't be consistently applied or reviewed by anyone — including future you.",
        requiredActions: ["Open the AI Assistant and start a new Strategy.", "State the entry logic and the market conditions it targets."],
        moduleLabel: "AI Assistant — Strategy Builder",
        moduleHref: "/assistant",
        signalType: "auto",
      },
      {
        id: "complete-sections",
        title: "Complete Every Required Section",
        purpose: "Fill in every required strategy section — risk parameters included, not just the entry idea.",
        whyItMatters: "An entry rule with no risk rule isn't a complete strategy — it's half of one, and the missing half is usually the half that matters most in a drawdown.",
        requiredActions: ["Complete all required Strategy sections.", "Check for missing sections before moving on."],
        moduleLabel: "AI Assistant — Strategy Builder",
        moduleHref: "/assistant",
        signalType: "auto",
      },
      {
        id: "approve-strategy",
        title: "Approve for Active Use",
        purpose: "Move the strategy from draft to active once it's genuinely ready to drive real trade ideas.",
        whyItMatters: "Marking a strategy active is a real institutional gate — it's the moment a rule set graduates from 'idea' to 'process.'",
        requiredActions: ["Set the Strategy's status to 'active'."],
        moduleLabel: "AI Assistant — Strategy Builder",
        moduleHref: "/assistant",
        signalType: "auto",
      },
    ],
  },

  // ─── 3. Trade Planning ───────────────────────────────────────────────
  {
    id: "trade-planning",
    category: "trade-lifecycle",
    name: "Trade Planning",
    purpose: "Turn an approved Strategy (or standalone idea) into a fully documented Trade Plan before any capital is at risk.",
    objective: "Produce a Trade Plan complete enough to pass the pre-trade checklist, with thesis, entry, risk, and targets all written down.",
    prerequisites: ["An approved Strategy this plan is built from, or a well-documented standalone thesis."],
    requiredInputs: ["Market context for the planned trade.", "Entry, stop, and target logic."],
    expectedOutputs: ["A Trade Plan whose pre-trade checklist is complete.", "Every required Decision Engine section present, not left blank."],
    validationRules: [
      "The plan reaches at least the 'decision-ready' pipeline stage before execution is considered.",
      "The pre-trade checklist's required items are all completed — not just the plan's free-text sections.",
    ],
    commonMistakes: [
      "Writing a thesis but skipping the risk section — 'I like this trade' is not a trade plan.",
      "Applying a checklist template and then never actually completing it, so the box exists but the discipline doesn't.",
      "Planning a trade with no linked Strategy and no real thesis of its own — a trade that isn't grounded in either a rule set or documented reasoning.",
    ],
    institutionalNotes: [
      "A written trade plan is the artifact that separates a professional trade from a gut call — even when it's wrong, a written plan tells you exactly what assumption broke.",
      "Applying an existing checklist template (rather than free-handing one each time) is what makes the process actually repeatable across dozens of trades, not just well-intentioned once.",
    ],
    relatedLearning: [
      { pathKey: "trading-engine", topicKey: "trading-trade-planning", label: "Trade Planning & Scenario Comparison" },
      { pathKey: "professional-workflows", topicKey: "workflow-professional-trade", label: "Professional Trade Workflow" },
    ],
    relatedKnowledge: "The Knowledge Graph links this Trade Plan back to the Notebook/Strategy it was built from, and forward to every past trade plan that shared the same symbol or theme.",
    relatedWorkflows: ["strategy-to-tradeplan", "tradeplan-to-decision"],
    entityBinding: "trade-plan",
    stages: [
      {
        id: "capture-plan-idea",
        title: "Capture the Idea",
        purpose: "Create the Trade Plan and link it to its Strategy or standalone thesis.",
        whyItMatters: "Everything downstream — checklist, decision score, execution — is scoped to this one plan; it has to exist first.",
        requiredActions: ["Create a Trade Plan.", "Link it to a Strategy, if one applies."],
        moduleLabel: "AI Assistant — Trade Planner",
        moduleHref: "/assistant",
        signalType: "auto",
      },
      {
        id: "document-plan-context",
        title: "Document Market Context & Thesis",
        purpose: "Write the market context, thesis, bias, and catalysts sections.",
        whyItMatters: "This is the reasoning a future review will judge — not the outcome, the reasoning that led to the trade.",
        requiredActions: ["Complete market_context, trade_thesis, bias, and catalysts sections."],
        moduleLabel: "AI Assistant — Trade Planner",
        moduleHref: "/assistant",
        signalType: "auto",
      },
      {
        id: "set-risk-parameters",
        title: "Set Risk Parameters",
        purpose: "Define the stop loss, maximum risk, and risk/reward for this specific plan.",
        whyItMatters: "Risk defined before entry is a decision made with a clear head; risk defined after entry is a decision made under pressure.",
        requiredActions: ["Complete stop_loss, maximum_risk, and risk_reward sections."],
        moduleLabel: "AI Assistant — Trade Planner",
        moduleHref: "/assistant",
        signalType: "auto",
      },
      {
        id: "run-checklist",
        title: "Run the Pre-Trade Checklist",
        purpose: "Apply the relevant checklist template and complete its required items.",
        whyItMatters: "A checklist catches the things you know you should check but might skip under the pressure of a live opportunity.",
        requiredActions: ["Apply a pre-trade checklist template.", "Complete every required checklist item."],
        moduleLabel: "AI Assistant — Trade Planner",
        moduleHref: "/assistant",
        signalType: "auto",
      },
    ],
  },

  // ─── 4. Decision Review ────────────────────────────────────────────────
  {
    id: "decision-review",
    category: "trade-lifecycle",
    name: "Decision Review",
    purpose: "Objectively score a Trade Plan's own readiness before capital is committed — the Institutional Decision Engine, followed deliberately.",
    objective: "Reach a 'Well-Prepared' Decision Score with every evidence gap closed or consciously accepted.",
    prerequisites: ["A Trade Plan with at least some sections completed."],
    requiredInputs: ["The Trade Plan being reviewed."],
    expectedOutputs: ["A Decision Score of 'Well-Prepared'.", "No remaining missing-information gaps, or an explicit, documented reason for accepting the ones that remain."],
    validationRules: [
      "Every core Decision Engine stage (research, evidence, thesis, risk, strategy) is scored, not skipped.",
      "The weakest-scoring stage is addressed before the plan is treated as execution-ready.",
    ],
    commonMistakes: [
      "Treating a high overall score as a green light while ignoring one specific stage that's still genuinely weak.",
      "Re-running the Decision Engine repeatedly without actually closing any of the evidence gaps it identifies.",
      "Skipping this playbook entirely and going straight from planning to execution — the single most common process failure this platform is built to catch.",
    ],
    institutionalNotes: [
      "The Decision Score is a readiness signal, not a prediction — a Well-Prepared plan can still lose; an Early-Stage plan that wins anyway was still a worse process decision.",
      "Institutional risk committees review the plan's completeness, not just its conclusion — this playbook is that review, made explicit and repeatable for a single-operator desk.",
    ],
    relatedLearning: [
      { pathKey: "institutional", topicKey: "institutional-decision-quality", label: "Decision Quality" },
      { pathKey: "institutional-investing", topicKey: "investing-decision-engine", label: "The Decision Engine" },
    ],
    relatedKnowledge: "The Knowledge Graph shows past trade plans with a similar decision profile — including which ones eventually became your best-performing trades and which repeated a known mistake.",
    relatedWorkflows: ["tradeplan-to-decision", "decision-to-execution"],
    entityBinding: "trade-plan",
    stages: [
      {
        id: "review-evidence",
        title: "Review Evidence & Research",
        purpose: "Confirm market context and linked research/notebook references are present.",
        whyItMatters: "A thesis without cited evidence is an opinion, not a decision input.",
        requiredActions: ["Confirm market_context is complete.", "Confirm research_reference/notebook_reference sections are linked."],
        moduleLabel: "Decision Workflow",
        moduleHref: "/decision-workflow",
        signalType: "auto",
      },
      {
        id: "review-thesis-risk",
        title: "Review Thesis & Risk",
        purpose: "Confirm the thesis, bias, catalysts, and full risk parameters are all scored complete.",
        whyItMatters: "These are the two stages most predictive of a plan's own readiness — a strong score here is what 'Well-Prepared' actually means.",
        requiredActions: ["Confirm thesis-related sections are complete.", "Confirm risk-related sections are complete."],
        moduleLabel: "Decision Workflow",
        moduleHref: "/decision-workflow",
        signalType: "auto",
      },
      {
        id: "check-strategy-alignment",
        title: "Check Strategy Alignment",
        purpose: "If a Strategy is linked, confirm it's genuinely relevant and itself complete.",
        whyItMatters: "A Trade Plan linked to a half-finished or unrelated Strategy inherits that Strategy's own gaps.",
        requiredActions: ["Confirm the linked Strategy (if any) has no missing sections."],
        moduleLabel: "Decision Workflow",
        moduleHref: "/decision-workflow",
        signalType: "auto",
      },
      {
        id: "confirm-well-prepared",
        title: "Confirm Well-Prepared Score",
        purpose: "Reach and confirm the overall 'Well-Prepared' Decision Score.",
        whyItMatters: "This is the actual gate — nothing downstream (Execution Preparation) should begin before this is genuinely true.",
        requiredActions: ["Reach a 'Well-Prepared' overall Decision Score."],
        moduleLabel: "Decision Workflow",
        moduleHref: "/decision-workflow",
        signalType: "auto",
      },
    ],
  },

  // ─── 5. Execution Preparation ──────────────────────────────────────────
  {
    id: "execution-preparation",
    category: "trade-lifecycle",
    name: "Execution Preparation",
    purpose: "The last honest check before real money moves at your own external broker — this platform never places, closes, or modifies a real order.",
    objective: "A reviewed Execution Package and a confirmed, deliberate execution — never an impulsive one.",
    prerequisites: ["A Trade Plan with a 'Well-Prepared' Decision Score and a completed pre-trade checklist."],
    requiredInputs: ["The fully prepared Trade Plan."],
    expectedOutputs: ["A generated, reviewed Execution Package.", "A deliberate execution decision, logged as executed once genuinely done."],
    validationRules: [
      "The plan's checklist is 100% complete on required items before an Execution Package is generated.",
      "Execution is never treated as automatic — this platform requires a manual, external, conscious action at your own broker.",
    ],
    commonMistakes: [
      "Generating the Execution Package and then not actually reading it before acting.",
      "Executing before the checklist is fully complete because the setup 'felt urgent.'",
      "Forgetting to log the trade as executed in the platform, which silently breaks every downstream stage (Trade Management, Journal, Knowledge Graph) that depends on it.",
    ],
    institutionalNotes: [
      "Institutional execution desks treat the moment of execution as procedurally boring by design — all the real decision-making already happened in Decision Review; this stage is about faithful, careful implementation, not re-litigating the thesis.",
      "This platform is explicitly, permanently advisory — it will never place a real order for you. That boundary is a safety feature, not a missing feature.",
    ],
    relatedLearning: [{ pathKey: "professional-workflows", topicKey: "workflow-professional-trade", label: "Professional Trade Workflow" }],
    relatedKnowledge: "The Knowledge Graph shows how similar past executions on this symbol or with this strategy actually performed once opened.",
    relatedWorkflows: ["decision-to-execution"],
    entityBinding: "trade-plan",
    stages: [
      {
        id: "confirm-readiness",
        title: "Confirm Readiness",
        purpose: "Re-confirm the Decision Score is Well-Prepared and the checklist is complete immediately before acting.",
        whyItMatters: "Market conditions can change between planning and execution — a final readiness check catches a plan that's gone stale.",
        requiredActions: ["Re-check the Decision Score.", "Re-check checklist completion."],
        moduleLabel: "Decision Workflow",
        moduleHref: "/decision-workflow",
        signalType: "auto",
      },
      {
        id: "generate-package",
        title: "Generate the Execution Package",
        purpose: "Generate and actually read the plan's Execution Package.",
        whyItMatters: "The package consolidates everything into one reference — skipping it means executing from memory instead of from the documented plan.",
        requiredActions: ["Generate the Execution Package.", "Review it in full before acting."],
        moduleLabel: "Execution & Lifecycle Manager",
        moduleHref: "/execution-lifecycle",
        signalType: "auto",
      },
      {
        id: "execute-and-log",
        title: "Execute at Your Broker, Then Log It",
        purpose: "Execute manually at your own external broker, then log the execution in the platform.",
        whyItMatters: "Every later stage of this trade's lifecycle depends on the platform knowing the trade is genuinely open.",
        requiredActions: ["Execute the trade at your own external broker.", "Mark the Trade Plan as executed."],
        moduleLabel: "Execution & Lifecycle Manager",
        moduleHref: "/execution-lifecycle",
        signalType: "auto",
      },
    ],
  },

  // ─── 6. Trade Management ───────────────────────────────────────────────
  {
    id: "trade-management",
    category: "trade-lifecycle",
    name: "Trade Management",
    purpose: "Actively manage an open position against its own written plan, not against emotion in the moment.",
    objective: "A position managed to its plan's own exit rules — stopped, targeted, or adjusted deliberately, never abandoned to hope.",
    prerequisites: ["An open position with a linked Trade Plan."],
    requiredInputs: ["The open position's current state.", "The plan's own exit/adjustment rules."],
    expectedOutputs: ["Open risk tracked and known at all times.", "Any adjustment made deliberately, referencing the plan, not reactively."],
    validationRules: [
      "The position has a known stop — open risk is not left undefined while a position is live.",
      "Any adjustment reuses the Trade Adjustment Preview simulator before being placed at the broker.",
    ],
    commonMistakes: [
      "Moving a stop further away 'to give it room' without a documented reason — the single most common way a defined-risk trade becomes an undefined-risk one.",
      "Checking a position only when it moves against you, never when it's working — asymmetric attention leads to asymmetric mistakes.",
      "Forgetting the plan's own original exit rules and improvising new ones mid-trade.",
    ],
    institutionalNotes: [
      "Professional trade management is closer to monitoring against a checklist than to constant intervention — most good trades need less management than an anxious operator wants to give them.",
      "A position's open risk should be knowable at a glance at all times — if it isn't, that's itself a process gap worth fixing before the next trade.",
    ],
    relatedLearning: [{ pathKey: "trading-engine", topicKey: "trading-risk-management", label: "Risk Management: Position Sizing, R:R, and Portfolio Exposure" }],
    relatedKnowledge: "The Knowledge Graph surfaces past trades in the same symbol or strategy, including how they were managed and what happened as a result.",
    relatedWorkflows: ["decision-to-execution"],
    entityBinding: "trade-plan",
    stages: [
      {
        id: "confirm-execution-logged",
        title: "Confirm Execution Is Logged",
        purpose: "Verify the position is correctly reflected as open in the platform.",
        whyItMatters: "Management tools (open risk, adjustment preview) only work against a position the platform actually knows is open.",
        requiredActions: ["Confirm the Trade Plan shows as an open position."],
        moduleLabel: "Execution & Lifecycle Manager",
        moduleHref: "/execution-lifecycle",
        signalType: "auto",
      },
      {
        id: "track-open-risk",
        title: "Track Open Risk",
        purpose: "Know the position's current dollar risk at all times.",
        whyItMatters: "You can't manage what you haven't measured — undefined open risk is itself a risk-management failure.",
        requiredActions: ["Confirm the position has a defined stop.", "Review current open risk."],
        moduleLabel: "Position Sizing & Portfolio Impact",
        moduleHref: "/position-sizing",
        signalType: "auto",
      },
      {
        id: "manage-actively",
        title: "Actively Manage the Position",
        purpose: "Monitor the position against the plan's own management/exit rules while it's open.",
        whyItMatters: "This is where discipline is actually tested — the plan was written calmly; the management happens live.",
        requiredActions: ["Review the position regularly against its own trade_management/exit_plan sections."],
        moduleLabel: "Execution & Lifecycle Manager",
        moduleHref: "/execution-lifecycle",
        signalType: "manual",
      },
      {
        id: "preview-adjustments",
        title: "Preview Any Adjustment Before Acting",
        purpose: "Simulate a roll, resize, or exit adjustment before actually placing it at the broker.",
        whyItMatters: "Simulating the adjustment's portfolio impact first catches a change that looks reasonable in isolation but isn't in context.",
        requiredActions: ["Use the Trade Adjustment Preview simulator before making any change to the live position."],
        moduleLabel: "Trade Adjustment & Roll/Convert Preview",
        moduleHref: "/trade-adjustment-preview",
        signalType: "manual",
      },
    ],
  },

  // ─── 7. Post-Trade Review ──────────────────────────────────────────────
  {
    id: "post-trade-review",
    category: "trade-lifecycle",
    name: "Post-Trade Review",
    purpose: "Turn a closed trade into an actual lesson, while the reasoning is still fresh.",
    objective: "A completed Journal entry with a real lesson learned, connected back to the plan and research that produced the trade.",
    prerequisites: ["A closed trade with a linked Trade Plan."],
    requiredInputs: ["The closed trade's outcome.", "Your honest read on what went right or wrong in the process."],
    expectedOutputs: ["A Journal entry logged for the trade.", "A specific, non-generic lesson learned recorded."],
    validationRules: [
      "The Journal entry is created before the 'fresh reasoning' window closes — ideally the same day the trade closes.",
      "The lesson learned field is filled in, not left blank — a log entry without a lesson is a record, not a review.",
    ],
    commonMistakes: [
      "Journaling only losing trades — winning trades that worked for the wrong reason teach just as much, and get skipped by this bias almost every time.",
      "Writing a generic lesson ('be more patient') instead of a specific, actionable one tied to what actually happened in this trade.",
      "Letting journaling slip for days, by which point the reasoning is reconstructed from memory rather than recalled.",
    ],
    institutionalNotes: [
      "A trade's P&L tells you the outcome; the journal entry is the only record of whether the process itself was sound — institutional review separates the two deliberately, since a good process can still lose and a bad one can still win.",
      "The Knowledge Graph's own pattern discovery only has real data to work with once journal entries with genuine lessons exist — an unjournaled trade is invisible to every future pattern the platform could otherwise catch.",
    ],
    relatedLearning: [{ pathKey: "trading-engine", topicKey: "trading-journal-review", label: "The Trading Journal" }],
    relatedKnowledge: "The Knowledge Graph connects this trade's journal entry back to its originating research and strategy, and flags whether its lesson repeats a theme from earlier journal entries.",
    relatedWorkflows: ["trade-closed-to-journal"],
    entityBinding: "trade-plan",
    stages: [
      {
        id: "close-and-confirm",
        title: "Confirm the Trade Is Closed",
        purpose: "Verify the platform correctly reflects the position as closed.",
        whyItMatters: "The rest of this playbook depends on the platform knowing there's a completed trade to review.",
        requiredActions: ["Confirm the Trade Plan shows as closed."],
        moduleLabel: "Execution & Lifecycle Manager",
        moduleHref: "/execution-lifecycle",
        signalType: "auto",
      },
      {
        id: "log-journal-entry",
        title: "Log the Journal Entry",
        purpose: "Create a Journal entry for this trade while the reasoning is fresh.",
        whyItMatters: "A trade journaled the same day captures real decision quality; journaled a week later, it's reconstructed from memory.",
        requiredActions: ["Create a Journal entry linked to this trade."],
        moduleLabel: "Trading Journal",
        moduleHref: "/trading-journal",
        signalType: "auto",
      },
      {
        id: "record-lesson",
        title: "Record a Real Lesson Learned",
        purpose: "Write a specific, actionable lesson — not a generic one.",
        whyItMatters: "This is the single field that turns a log entry into an actual review, and the one most often skipped.",
        requiredActions: ["Complete the lesson learned field with something specific to this trade."],
        moduleLabel: "Trading Journal",
        moduleHref: "/trading-journal",
        signalType: "auto",
      },
      {
        id: "check-for-patterns",
        title: "Check for Recurring Patterns",
        purpose: "See whether this lesson echoes a theme from previous journal entries.",
        whyItMatters: "A mistake made once is a data point; the same mistake made three times is a process gap worth fixing directly.",
        requiredActions: ["Review the Knowledge & Intelligence Graph's Pattern Discovery panel for recurring themes."],
        moduleLabel: "Knowledge & Intelligence Graph",
        moduleHref: "/knowledge-graph",
        signalType: "manual",
      },
    ],
  },

  // ─── 8. Portfolio Review ────────────────────────────────────────────────
  {
    id: "portfolio-review",
    category: "portfolio-and-risk",
    name: "Portfolio Review",
    purpose: "Step back from individual trades and review the portfolio as a whole — exposure, allocation, and overall health.",
    objective: "A conscious, documented read of the current Portfolio Health Score and its contributing factors, not a passive glance.",
    prerequisites: ["At least one open position or holding to review."],
    requiredInputs: ["Current portfolio state (positions, holdings, exposure)."],
    expectedOutputs: ["A reviewed Portfolio Health Score and its weakest factors.", "A conscious decision on whether any exposure needs to change."],
    validationRules: ["The review references the actual, current Portfolio Health Score and Risk Intelligence report — not a stale or remembered figure."],
    commonMistakes: [
      "Reviewing the portfolio only when something already feels wrong, rather than on a fixed cadence.",
      "Looking at the overall score without checking which specific factor is weakest — the score can hide a concentrated problem inside an otherwise fine average.",
      "Treating 'no elevated alerts' as 'nothing to think about' rather than as one confirmed, positive data point.",
    ],
    institutionalNotes: [
      "Institutional desks review portfolio health on a fixed cadence, not reactively — an elevated reading is a cue that the cadence is due now, not the only time a review happens.",
      "Portfolio-level review exists precisely because individually-sound trades can still combine into an unsound portfolio (concentration, correlated exposure) — this is the review layer that catches that.",
    ],
    relatedLearning: [{ pathKey: "professional-workflows", topicKey: "workflow-portfolio-review", label: "Portfolio Review Workflow" }],
    relatedKnowledge: "The Knowledge Graph's Portfolio Review node links directly to the 5 most recently closed trades feeding the current read.",
    relatedWorkflows: ["portfolio-risk-to-review"],
    entityBinding: "aggregate",
    stages: [
      {
        id: "review-health-score",
        title: "Review the Portfolio Health Score",
        purpose: "Read the current overall Health Score and its label.",
        whyItMatters: "This is the single top-line number every other figure in the review explains.",
        requiredActions: ["Open Portfolio & Risk Intelligence and note the current score."],
        moduleLabel: "Portfolio & Risk Intelligence",
        moduleHref: "/portfolio-risk-intelligence",
        signalType: "auto",
      },
      {
        id: "review-exposure-allocation",
        title: "Review Exposure & Allocation",
        purpose: "Check sector exposure and concentration signals for anything unintentional.",
        whyItMatters: "Concentration risk builds gradually and quietly — a review is often the only point it's actually noticed.",
        requiredActions: ["Review the exposure and allocation signals."],
        moduleLabel: "Portfolio & Risk Intelligence",
        moduleHref: "/portfolio-risk-intelligence",
        signalType: "auto",
      },
      {
        id: "identify-weakest-factor",
        title: "Identify the Weakest Factor",
        purpose: "Find the specific factor dragging the overall score down, not just the average.",
        whyItMatters: "The weakest factor, not the average, is what tells you where to actually focus.",
        requiredActions: ["Note the weakest available health factor and its recommended review task."],
        moduleLabel: "Portfolio & Risk Intelligence",
        moduleHref: "/portfolio-risk-intelligence",
        signalType: "auto",
      },
    ],
  },

  // ─── 9. Risk Review ────────────────────────────────────────────────────
  {
    id: "risk-review",
    category: "portfolio-and-risk",
    name: "Risk Review",
    purpose: "A focused review of open risk specifically — position-level and portfolio-level — separate from the broader health review.",
    objective: "Every open position's risk is known, and total portfolio risk is within a range you've consciously accepted.",
    prerequisites: ["At least one open position."],
    requiredInputs: ["Current open positions and their stops."],
    expectedOutputs: ["A confirmed read of single-position and total open risk.", "Any breach addressed, not left standing unacknowledged."],
    validationRules: [
      "Every open position has a defined stop — an undefined stop is an undefined risk, not a small one.",
      "Any signal reporting a breach ('above'/'exceed' language) is explicitly addressed, not silently dismissed.",
    ],
    commonMistakes: [
      "Reviewing individual position risk without ever summing it into total portfolio risk.",
      "Treating a risk alert as noise because 'it's usually fine' — a breach signal exists specifically because the usual case doesn't always hold.",
      "Sizing a new position without checking its marginal effect on total portfolio risk first.",
    ],
    institutionalNotes: [
      "Risk review is deliberately separate from performance review — a profitable stretch can mask a genuinely elevated risk posture that hasn't yet been tested by a bad week.",
      "'Known and accepted' risk and 'unknown' risk look identical on a quiet day and completely different on a bad one — this review exists to make sure it's the former.",
    ],
    relatedLearning: [{ pathKey: "trading-engine", topicKey: "trading-risk-management", label: "Risk Management: Position Sizing, R:R, and Portfolio Exposure" }],
    relatedKnowledge: "The Knowledge Graph flags whether an open position's own risk profile echoes a past trade that had a similar setup.",
    relatedWorkflows: ["portfolio-risk-to-review"],
    entityBinding: "aggregate",
    stages: [
      {
        id: "review-single-position-risk",
        title: "Review Single-Position Risk",
        purpose: "Check the largest single position's own risk contribution.",
        whyItMatters: "One oversized position can dominate the whole portfolio's risk profile even if every other position is well-sized.",
        requiredActions: ["Review the single-position risk signal."],
        moduleLabel: "Portfolio & Risk Intelligence",
        moduleHref: "/portfolio-risk-intelligence",
        signalType: "auto",
      },
      {
        id: "review-total-risk",
        title: "Review Total Open Risk",
        purpose: "Check total portfolio-level open risk against your own accepted range.",
        whyItMatters: "Total risk is what actually determines how bad a genuinely bad day could be.",
        requiredActions: ["Review the total open trade risk signal."],
        moduleLabel: "Portfolio & Risk Intelligence",
        moduleHref: "/portfolio-risk-intelligence",
        signalType: "auto",
      },
      {
        id: "stress-test",
        title: "Run a Stress Test",
        purpose: "Simulate an adverse scenario against the current portfolio.",
        whyItMatters: "A stress test turns 'I think this is fine' into 'here's specifically what happens if it isn't.'",
        requiredActions: ["Run at least one stress-test scenario against the current portfolio."],
        moduleLabel: "Portfolio Stress Test",
        moduleHref: "/portfolio-stress-test",
        signalType: "manual",
      },
    ],
  },

  // ─── 10. Weekly Investment Committee ────────────────────────────────────
  {
    id: "weekly-investment-committee",
    category: "cadence-review",
    name: "Weekly Investment Committee",
    purpose: "A weekly, cadence-based review of the whole book — open decisions, execution pipeline, and portfolio state — held with committee-level discipline even on a single-operator desk.",
    objective: "A weekly record of what's in progress, what's blocked, and what changed since last week.",
    prerequisites: ["A full week of platform activity to review."],
    requiredInputs: ["The current Execution Pipeline, Workflow queue, and Portfolio state."],
    expectedOutputs: ["A weekly read of pipeline bottlenecks and blocked workflows.", "Explicit decisions on anything stuck for more than one week."],
    validationRules: [
      "This review happens on a fixed cadence, not only when something feels urgent — the whole point is catching what isn't yet urgent.",
      "Every blocked workflow item is either resolved or has an explicit, conscious reason for staying blocked.",
    ],
    commonMistakes: [
      "Skipping the review in a quiet week because nothing seems to need it — quiet weeks are exactly when process discipline erodes unnoticed.",
      "Reviewing individual trades in detail but never stepping back to look at the pipeline as a whole.",
      "Letting the same blocked item sit unaddressed across several consecutive weekly reviews.",
    ],
    institutionalNotes: [
      "An investment committee's real value isn't approving good ideas — it's the forcing function of a fixed cadence that catches drift before it compounds.",
      "This platform doesn't track calendar-based review history — completion of this playbook's cadence-specific steps is self-certified, not automatically verified, and is disclosed as such rather than fabricated.",
    ],
    relatedLearning: [{ pathKey: "professional-workflows", topicKey: "workflow-weekly-monthly-review", label: "Weekly & Monthly Review" }],
    relatedKnowledge: "The Knowledge Graph's Command Centre insights summarize the week's most frequently connected entities and any newly emerging themes.",
    relatedWorkflows: ["portfolio-risk-to-review", "learning-weakness-to-practice"],
    entityBinding: "aggregate",
    stages: [
      {
        id: "review-pipeline",
        title: "Review the Execution Pipeline",
        purpose: "Check requiring-action, open, execution-ready, and bottleneck counts across the whole pipeline.",
        whyItMatters: "The pipeline view is where a bottleneck (too much stuck in one stage) is actually visible, versus scattered across individual plans.",
        requiredActions: ["Review the Execution Pipeline's current bottleneck and requiring-action counts."],
        moduleLabel: "Execution & Lifecycle Manager",
        moduleHref: "/execution-lifecycle",
        signalType: "auto",
      },
      {
        id: "review-workflow-queue",
        title: "Review the Workflow Queue",
        purpose: "Check recommended, blocked, and awaiting-review workflow items.",
        whyItMatters: "This is the single consolidated queue of what the platform itself has flagged as needing attention.",
        requiredActions: ["Review My Workflow's recommended and blocked items."],
        moduleLabel: "Workflow Automation Engine",
        moduleHref: "/workflow-automation-engine",
        signalType: "auto",
      },
      {
        id: "committee-decision",
        title: "Record the Committee's Decisions",
        purpose: "Consciously decide what happens to anything still blocked or overdue.",
        whyItMatters: "This is the actual output of the review — a decision, not just an observation.",
        requiredActions: ["Resolve or consciously defer every item still blocked from last week."],
        moduleLabel: "Workflow Automation Engine",
        moduleHref: "/workflow-automation-engine",
        signalType: "manual",
      },
    ],
  },

  // ─── 11. Monthly Portfolio Review ───────────────────────────────────────
  {
    id: "monthly-portfolio-review",
    category: "cadence-review",
    name: "Monthly Portfolio Review",
    purpose: "A monthly, deeper review of portfolio construction, concentration, and risk — beyond the weekly pipeline check.",
    objective: "A monthly record of portfolio health, concentration, and any structural rebalancing decisions made.",
    prerequisites: ["A full month of portfolio activity to review."],
    requiredInputs: ["Current portfolio construction, concentration, and risk state."],
    expectedOutputs: ["A monthly read of the Portfolio Health Score trend.", "Any rebalancing or concentration decision, documented."],
    validationRules: ["This review covers construction and concentration specifically, not just the weekly pipeline view — a monthly review that's really just a repeat of the weekly one misses its own purpose."],
    commonMistakes: [
      "Conflating this with the Weekly Investment Committee review and skipping the deeper concentration/construction check it's specifically for.",
      "Reviewing concentration risk without checking whether it changed from last month — a single-point-in-time reading misses the trend.",
    ],
    institutionalNotes: [
      "Monthly review operates at a different altitude than weekly review — weekly asks 'what's stuck right now,' monthly asks 'is the portfolio's overall shape still what I intend it to be.'",
      "This platform has no historical Health Score trend table — the monthly comparison relies on your own recorded notes from the prior review, not an automatic trend line; this is disclosed honestly rather than fabricated.",
    ],
    relatedLearning: [{ pathKey: "professional-workflows", topicKey: "workflow-weekly-monthly-review", label: "Weekly & Monthly Review" }],
    relatedKnowledge: "The Knowledge Graph highlights which sectors/themes have grown most connected to your activity over the recent window.",
    relatedWorkflows: ["portfolio-risk-to-review"],
    entityBinding: "aggregate",
    stages: [
      {
        id: "review-construction",
        title: "Review Portfolio Construction",
        purpose: "Check current holdings, target weights, and drift from those targets.",
        whyItMatters: "Portfolio drift accumulates slowly enough that it's easy to miss without a dedicated monthly check.",
        requiredActions: ["Review current holdings and their drift from target weights."],
        moduleLabel: "Portfolio Construction",
        moduleHref: "/stock-analyst/portfolio-construction",
        signalType: "manual",
      },
      {
        id: "review-concentration",
        title: "Review Concentration & Correlation",
        purpose: "Check sector and single-position concentration in depth.",
        whyItMatters: "Concentration is the specific risk category most likely to build gradually across a month without any single week flagging it clearly.",
        requiredActions: ["Review the Concentration & Correlation Risk report."],
        moduleLabel: "Correlation & Concentration Risk",
        moduleHref: "/concentration-risk",
        signalType: "manual",
      },
      {
        id: "rebalance-decision",
        title: "Make a Rebalancing Decision",
        purpose: "Consciously decide whether to rebalance, and document why or why not.",
        whyItMatters: "The decision to hold current weights is itself a decision, and deserves to be a conscious one, not a default.",
        requiredActions: ["Decide to rebalance or explicitly hold current weights, and note the reason."],
        moduleLabel: "Portfolio Construction",
        moduleHref: "/stock-analyst/portfolio-construction",
        signalType: "manual",
      },
    ],
  },

  // ─── 12. Quarterly Performance Review ───────────────────────────────────
  {
    id: "quarterly-performance-review",
    category: "cadence-review",
    name: "Quarterly Performance Review",
    purpose: "Step back from any single trade or month and review performance, learning progress, and process quality across a full quarter.",
    objective: "A quarterly record of realized performance, the strongest recurring lessons, and any process change made as a result.",
    prerequisites: ["A full quarter of trading/investing activity to review."],
    requiredInputs: ["Quarterly trade history and journal entries.", "Learning Centre progress across the quarter."],
    expectedOutputs: ["A reviewed Performance Analytics summary.", "At least one identified recurring pattern (win or mistake) addressed going forward."],
    validationRules: ["The review checks Performance Analytics AND the Knowledge Graph's pattern discovery — a performance number alone doesn't explain why it happened."],
    commonMistakes: [
      "Reviewing only the P&L total and skipping the 'why' — the same total return can come from a sound process or a lucky one, and only the pattern-level detail tells you which.",
      "Never connecting quarterly performance back to specific journal lessons, so the same review keeps surfacing the same unaddressed mistake next quarter too.",
      "Treating a good quarter as proof the process needs no changes — a good outcome doesn't retroactively validate every decision that produced it.",
    ],
    institutionalNotes: [
      "Quarterly review is the altitude at which institutional desks actually change process — not after one trade, not even after one month, but once a pattern has had enough time to show itself clearly.",
      "This is the one playbook explicitly designed to close the loop back to the Investment Research playbook — a genuine quarterly lesson should change how the next quarter's research gets done.",
    ],
    relatedLearning: [{ pathKey: "professional-workflows", topicKey: "workflow-weekly-monthly-review", label: "Weekly & Monthly Review" }],
    relatedKnowledge: "The Knowledge Graph's Pattern Discovery is the primary input here — recurring mistakes, winning strategy clusters, and the lessons most associated with reduced drawdown.",
    relatedWorkflows: ["learning-weakness-to-practice"],
    entityBinding: "aggregate",
    stages: [
      {
        id: "review-performance",
        title: "Review Performance Analytics",
        purpose: "Check realized P&L, win rate, and expectancy across the quarter.",
        whyItMatters: "This is the outcome-level view — necessary, but not sufficient on its own.",
        requiredActions: ["Review the quarter's Performance Analytics summary."],
        moduleLabel: "Performance Analytics",
        moduleHref: "/performance-analytics",
        signalType: "auto",
      },
      {
        id: "review-patterns",
        title: "Review Recurring Patterns",
        purpose: "Check the Knowledge Graph's Pattern Discovery for recurring mistakes and winning clusters across the quarter.",
        whyItMatters: "This is the 'why' behind the performance number — the same total return can hide a sound process or a lucky one.",
        requiredActions: ["Review Pattern Discovery for recurring themes across the quarter's journal entries."],
        moduleLabel: "Knowledge & Intelligence Graph",
        moduleHref: "/knowledge-graph",
        signalType: "auto",
      },
      {
        id: "review-learning-progress",
        title: "Review Learning Progress",
        purpose: "Check which Learning Centre paths advanced this quarter and which weak areas remain.",
        whyItMatters: "Skill development is itself a quarterly-scale signal — it rarely shows up meaningfully week to week.",
        requiredActions: ["Review Learning Centre progress for the quarter."],
        moduleLabel: "Learning Centre",
        moduleHref: "/learn",
        signalType: "auto",
      },
      {
        id: "commit-process-change",
        title: "Commit to a Process Change",
        purpose: "Decide on at least one concrete process change for next quarter, based on what this review actually found.",
        whyItMatters: "A review that changes nothing next quarter wasn't a review — it was a retrospective look with no forward effect.",
        requiredActions: ["Document at least one specific process change to carry into next quarter."],
        moduleLabel: "Institutional Mentor",
        moduleHref: "/institutional-mentor",
        signalType: "manual",
      },
    ],
  },
];

export function getPlaybook(id: string): Playbook | null {
  return PLAYBOOKS.find((p) => p.id === id) ?? null;
}

export function allPlaybooks(): Playbook[] {
  return PLAYBOOKS;
}

export function playbooksByCategory(category: PlaybookCategory): Playbook[] {
  return PLAYBOOKS.filter((p) => p.category === category);
}
