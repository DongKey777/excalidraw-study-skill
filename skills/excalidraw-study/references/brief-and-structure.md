# Brief and structure

## Intake

The brief is a contract. Copy the user's words; do not paraphrase their structure into yours.

Fill these in `brief.md`:

- **Topic and goal.** What the reader can explain after reading, at most three things. "Understand PostgreSQL" is too wide; "explain why a range condition uses an index and a function on the column does not" is a goal.
- **Reader.** Who, what they already know, which terms must be explained on first use. Material for a team that lived through the incidents differs from material for newcomers: the former already knows *what happened*, so the slides spend their space on *why*.
- **Structure the user gave.** Verbatim. If they gave an order, that order wins.
- **Format.** Slide count, flow, language and voice, how many numbers.
- **Evidence.** What exists (docs, code, logs, measurements), what can be reproduced locally, what cannot be verified.
- **Constraints.** Where the material may and may not go, words not to use, where output lives.

Ask only what changes the result, all in one message. Typical blocking questions: who reads it, where it will be published (private material?), and the rough length. If the user asked you to proceed, write your assumptions into `brief.md` and go.

## Choosing a flow

Pick the flow from the goal. The user's structure overrides all of these.

| Flow | Use when | Steps preset |
|---|---|---|
| Case-first (`--flow case`) | real incidents or projects teach the concepts | `case-first-ko`: 상황 → 분석 → 원리 → 해결; `case-first-en`: Situation → Analysis → Principle → Fix |
| Concept-first (`--flow concept`) | no shared incidents; a topic is built up piece by piece | `concept-first-ko`: 질문 → 개념 → 동작 → 적용; `concept-first-en`: Question → Concept → Mechanism → Apply |
| Comparison (`--flow comparison`) | two designs, versions or tools | `comparison-ko`: 질문 → 기준 → 비교 → 고르기; `comparison-en`: Question → Criteria → Compare → Choose; parts per aspect |
| Tour (`--flow tour`) | a system walked through end to end | none; parts per component |

### Case-first in detail

Tell the incidents in the order they happened. Inside each incident:

1. **상황 (situation)**: what was observed, in the reader's terms. One slide.
2. **분석 (analysis)**: how the cause was found: the query plan, the log, the measurement. One or two slides.
3. **원리 (principle)**: the concepts needed to understand the cause. This is where the reader learns, so give it room: usually two to five slides per incident, each teaching one concept with a figure (how a B-tree leaf is ordered, what a HOT chain is, what BUFFERS counts).
4. **해결 (fix)**: what was changed and what remains open (`left` in the spec). One slide.

A single "principle" slide per incident is the most common failure: the reader meets terms without explanation. Ask of each analysis slide: which words on it would a newcomer not know? Each of those needs a concept slide before or at that point.

### Pacing

- Keep the introduction short (two or three slides: the question, the system at a glance, the timeline). Put depth where learning happens.
- Alternate dense and light slides. Three dense slides in a row tire the reader; lint warns (`density`).
- Close with what the reader should now be able to explain, and pointers for further study.
- Add an appendix slide for sources when the material cites many.

## Planning slides

Write `plan.md` before drawing. For each slide:

| Field | Meaning |
|---|---|
| id | stable kebab-case id (`c2-btree-order`). Numbers come from order; never put numbers in ids. |
| part / step | which incident or section, and which step |
| takeaway | the one sentence the reader keeps. If you cannot write it, the slide is not ready. |
| figure | the figure type that shows the relationship (see visual-system.md) |
| new terms | terms first used here; each needs an explaining slide at or before this one |
| claims | ids from `evidence/claims.md` |

Then fill `glossary` in `study.config.mjs` with each term and the id of the slide that explains it. Lint fails if any earlier slide uses the term.

Refer to other slides with `{{#slide-id}}` in any text; it becomes the slide number at build time, so renumbering never leaves stale "see slide 12" references.

## Revisions

When the user comments on a finished study:

- Change only what they asked about; keep everything else, including wording they did not question.
- Encode wording feedback as rules (`writing.banned`, `writing.replace`) so lint enforces it from now on.
- If feedback says concepts are missing, add concept slides in the principle step; do not stuff more text into existing slides.
- Record the change in README's history with the date.
