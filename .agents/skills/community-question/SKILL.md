---
name: community-question
description: Draft a self-contained, paste-ready community/forum question to gather outside opinions on a design, UX, or architecture decision — grounded in the actual codebase, neutral in tone, and structured so a reader with zero product knowledge can give a useful answer.
---

# Community Question Skill

Drafts a paste-ready community/forum question so the user can get outside opinions on a design, UX, or architecture decision. Two invariants govern every question:

1. **Grounded in the real code** — never a hypothetical. Read the actual surfaces, values, and constraints first.
2. **Self-contained** — a reader with zero product knowledge must be able to answer without opening the app.

## When to use

- The user is weighing two or more design/UX/architecture approaches and wants outside opinions (e.g. "which is better", "is this hard to change", "where should this live").
- The user asks to "write a community question", "draft a question", "ask for opinion", or pastes a community reply back for analysis.
- Trigger phrasing: "which reads better", "how do others handle", "should we ask".

## Workflow

1. **Investigate first — never draft from memory.** Read the actual code for the surfaces and options involved (components, styles, constants, architecture rules). Collect concrete evidence: the exact current rendering, the real labels/colors/values, any duplication or drift, and the architecture constraints that shape the fix. The question must be truthful to the product.
2. **Name the core tension.** Reduce the decision to its genuine trade-off (e.g. semantic clarity vs. compactness; single source of truth vs. layer purity). A good question is a dilemma, not a pitch.
3. **Frame concrete options.** Present 2–3 realistic alternatives with real text or ASCII mockups so a stranger can see the difference without running the app.
4. **State the specific concern.** One or two sentences naming the crux — the thing the user is actually unsure about.
5. **Draft the deliverable.** Paste-ready title + body (see Question Anatomy). Keep the tone neutral; do not load the question toward the user's current preference.
6. **Deliver with posting tips.** Suggest what to include when posting (real screenshots of both states, which community/audience fits best) and offer reworded variants — shorter, more opinionated, or aimed at a different audience (designers vs. engineers vs. end users).
7. **Iterate on replies.** When the user pastes community feedback: evaluate it against the actual code (what's right, what's arguable), name the actionable recommendation, and — if a change is implied — ask the user which direction to implement before touching code.

## Question anatomy

A good question has five parts, in order:

1. **Title** — the decision framed neutrally as a question (e.g. "Option A vs Option B — which reads as X?").
2. **Context** — what the app does, who uses it, where the decision surfaces. Two to four sentences; assume zero product knowledge.
3. **Options** — each with a concrete example or ASCII mockup, labeled (Option A / Option B / alternative).
4. **The concern** — the crux, named explicitly ("I worry that…", "the tension is…").
5. **The ask** — an open question inviting judgment and alternatives ("which communicates X better? Is there a third pattern?"), not just a binary vote.

## Quality rules

- **Grounded:** every option must reflect the actual code/state — cite real labels, colors, values, and constraints.
- **Self-contained:** a stranger must be able to answer without seeing the app.
- **Concrete over abstract:** show real text in mockups (`✓ Option A + Option B`), not "joined items".
- **Neutral:** present trade-offs honestly; do not pre-judge. If an option has a real flaw, say so even if the user favors it.
- **Actionable ending:** close with an open question that invites alternatives.
- **Honest about evidence:** if the codebase already shows drift or inconsistency, include it — it is often the strongest argument in the question.
- **Never invent catch-all options** ("Other", "Custom", "None of the above") inside the question body — that belongs in decision prompts, not community questions.

## Templates

### Template A — presentation / semantics question

````
**Title:** [A] vs [B] for showing [X] — which reads as [intended meaning]?

**Context:** [app, who uses it, where the decision shows].

**Option A:**
```
[1 pt] [Medium] [Type] [✓ A, B, C]
```

**Option B:**
```
[1 pt] [Medium] [Type] [All: A] [B] [C]
```

**The concern:** [the crux, e.g. whether B reads as "any one is correct" (OR) instead of "all are required" (AND)].

**Question:** Which communicates [meaning] better for someone [doing the task]? Is there a third pattern you'd recommend?
````

### Template B — architecture / consistency question

````
**Title:** [Shared system] duplicated across [surfaces] — where should the single source of truth live?

**Context:** [what the shared data is, where it's used, and the architecture constraint that makes the placement non-trivial].

**Candidates:**
1. [option, with its trade-off]
2. [option, with its trade-off]
3. [option, with its trade-off]

**Question:** [open ask, e.g. where do you put it — and how do you prevent drift in practice?]
````

## Example outputs

The skill has produced questions like:

- Single comma-separated chip vs. separate "All:" chips for select-all answers — which reads as "all are correct" vs. "pick any".
- A shared badge palette duplicated across features (already drifted apart) — where should the source of truth live, and how do you prevent drift?

## Notes

- The skill is for gathering opinions — it never implements changes on its own. Implementation follows only after the user decides, using a decision prompt with concrete options.
