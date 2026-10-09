---
name: excalidraw-study
description: Turn a topic and the structure the user gives into a verified study material made of Excalidraw slides (1600x900 frames in one .excalidraw file). Covers the whole path - brief, evidence ledger, plan, deterministic generator, lint, rendering with Excalidraw's own exporter, slide-by-slide visual review and fresh-context audits. Use when asked to make or revise study/learning material, lecture or explainer slides, or a visual walkthrough in Excalidraw (e.g. "엑스칼리드로우로 학습 자료 만들어줘", "스터디 자료 만들어", "excalidraw study slides"). Not for one hand-drawn diagram, and not for PowerPoint/Keynote/Google Slides.
license: MIT
metadata:
  version: 0.1.0
---

# Excalidraw study material

You produce a study material the reader can learn from: one `.excalidraw` file whose frames are slides, built by a script from slide modules, checked by a linter, rendered with Excalidraw's own exporter, looked at slide by slide, and audited by someone who did not write it.

`<skill>` below is the directory that contains this SKILL.md. Scripts need Node 18+. The first render installs a small runtime into `~/.cache/excalidraw-study` (network, about 40 MB) and drives an installed Chrome, Edge or Chromium.

Some agent sandboxes (Codex's default sandbox on macOS, for one) let the scripts find the browser but not start it. `render.mjs` then reports `BROWSER_BLOCKED` and falls back to an approximate preview that is not an Excalidraw render. Installing another browser does not help. Ask the user to approve running `check.mjs` or `render.mjs` outside the sandbox; everything else runs inside it. When a browser fails to start for another reason (missing system libraries, for one), it reports `BROWSER_FAILED` with what to install.

## Principles

1. **The brief wins.** The user's topic, structure, order and wording override every default here. Copy them verbatim into `brief.md`. When a default in this skill conflicts with the brief, follow the brief.
2. **Evidence before slides.** Every fact and number on a slide traces to `evidence/claims.md`. Reproduce behaviour claims locally (a container, a script), never against production. Never invent a measurement, log, screenshot or quote.
3. **One slide, one message.** Each slide has a one-sentence `takeaway`. A term is explained on or before the first slide that uses it (`glossary` makes lint enforce this).
4. **Show, do not box.** Choose the figure from the relationship being taught (sequence, structure, comparison, change over time, quantity). Vary layouts. A colour means one thing across the whole study.
5. **Look at every slide.** Rendering and viewing each PNG is part of done. `review.json` records the exact PNG you viewed; a changed slide needs another look.
6. **Bounded passes.** One batched review, one batch of fixes, one confirmation round. Then stop polishing.
7. **Report what happened.** Say which checks ran, what was not verified, what is left. A passing lint is not a quality verdict.

## Workflow

Each phase has an output and a gate. Read the linked reference when you enter the phase.

| Phase | Output | Gate | Read |
|---|---|---|---|
| 0 Intake | `brief.md` | topic, reader, structure and constraints written down; blocking questions asked once, together | [brief-and-structure.md](references/brief-and-structure.md) |
| 1 Evidence | `evidence/sources.md`, `claims.md`, `labs/` | every claim you plan to show has a verified status | [evidence.md](references/evidence.md) |
| 2 Plan | `plan.md`, `glossary` in `study.config.mjs` | one takeaway per slide, figure type chosen, term order fixed; user has seen the plan when you designed the structure | [brief-and-structure.md](references/brief-and-structure.md) |
| 3 Draw | `slides/*.mjs` | `check.mjs` has no errors for each batch of about ten slides | [kit-api.md](references/kit-api.md), [visual-system.md](references/visual-system.md), writing guide |
| 4 Review | fixes, `review.json` marks | every current PNG viewed once; findings fixed in one batch; changed slides viewed again | [review.md](references/review.md) |
| 5 Audit | `review.json` audits, `audits/` reports | facts, pedagogy, writing, consistency and visual finish checked with fresh eyes; findings applied; verdict `ship` | [review.md](references/review.md) |
| 6 Deliver | `README.md`, the `.excalidraw` file | README states evidence, checks run and what is unverified; file revealed to the user | [review.md](references/review.md) |

Writing guide: [writing-ko.md](references/writing-ko.md) for Korean, [writing-en.md](references/writing-en.md) for English.

### 0 Intake

```bash
node <skill>/scripts/new.mjs <study-dir> --title "<title>" --lang ko --flow case   # --flow case | concept | comparison | tour, --lang en
```

Choose the flow now from the request ([brief-and-structure.md](references/brief-and-structure.md#choosing-a-flow)): case-first for incidents the reader lived through, concept-first for a topic built up piece by piece, comparison for two designs or tools, tour for a system walked end to end. `--flow` sets the step chips and the first parts; edit `parts` in `study.config.mjs` to match the brief.

Fill `brief.md` from the request and delete its template marker line. Ask the user only what changes the result (reader, scope, where the output may live, what must stay private) and ask it in one message. If the user already said "just do it", proceed with stated assumptions and list them in `brief.md`.

### 1 Evidence

Collect sources, write each claim with its value, source and date into `evidence/claims.md`, and run local experiments for behaviour claims, saving input and output side by side in `evidence/labs/`. Mark a claim `확인`/`verified`, `실측`/`measured`, `문서`/`documented` or `계산`/`derived` only after you checked it. Lint fails when a slide cites a claim that is missing or not verified.

### 2 Plan

Write `plan.md` (delete the template marker line): for every slide its id, part, step, takeaway, figure type, new terms and claims. When the user handed you an existing structure, `plan.md` records that structure; it is still required. Put the term order into `glossary` (`term: "slide-id-that-explains-it"`). Keep the introduction short and spend depth where the reader learns. Show the plan to the user before drawing, unless the user dictated the structure or told you to proceed without asking; then write in `brief.md` that the plan was not shown and why.

### 3 Draw

Slides are ES modules that receive the kit and return `slide(spec, draw)` calls. Build and check in batches:

```bash
node <skill>/scripts/check.mjs <study-dir> --slides 1-10   # build, lint, render these, lint with measured widths
```

Fix every lint error before the next batch. Warnings are decisions: fix them or keep them for a reason you can state.

- The build fails on a `{{#id}}` reference to a slide that does not exist yet. Write the cover's contents list and forward references after the slides they point to.
- The first full `check.mjs` measures text in Excalidraw and builds once more with those widths ([kit-api.md](references/kit-api.md#text-widths)); expect wrapping to change once.
- Shared drawing code goes in `slides/_name.mjs`. For graphs and trees use `s.graph` rather than placing circles and lines by hand.

### 4 Review

Render everything (`check.mjs <study-dir>`), then open each PNG in `build/render/` and the contact sheets `contact-NN.png`, and walk the checklist in [review.md](references/review.md). Mark the slides you viewed right away, even the ones with findings: the marks are how `review.mjs` later tells you which slides changed. Fix all findings in one batch, re-run `check.mjs`, look at the slides it lists as changed since the previous render, and mark them again. Record only what you actually viewed:

```bash
node <skill>/scripts/review.mjs <study-dir> --mark 1-12 --note "layout, text, figures checked"
node <skill>/scripts/review.mjs <study-dir>            # what still needs a look
```

### 5 Audit

Give auditors the inputs listed in [review.md](references/review.md#audits-phase-5) (brief, plan, evidence, outline, PNGs, lint result) and nothing of your reasoning. Use separate subagents or fresh sessions when your runtime has them; otherwise do the passes yourself one at a time and say so. Prompts are in [review.md](references/review.md). Record each pass before you fix anything, keeping the full report in the study:

```bash
node <skill>/scripts/review.mjs <study-dir> --audit facts --by "fresh subagent" --summary "48 claims checked, 2 wrong" --verdict fix --file report.md
```

Then apply the findings ([review.md](references/review.md#applying-audit-findings) shows how to split a large batch across fixers without facts drifting apart), run the consistency pass, and re-check: `check.mjs`, view changed slides, `claims.mjs` for the ledger. Follow-up audits are for the kinds that did not return `ship`.

### 6 Deliver

Complete `README.md` from the template, run `check.mjs` one last time, reveal the file (`open -R <file>` on macOS, `xdg-open <dir>` on Linux, `explorer /select,<file>` on Windows; without a desktop, print its absolute path) and report: what was built, which checks ran with what result, what was not verified, and the choices you made that the user may want to change.

## Revising an existing study

Treat feedback as refinement: keep everything the user did not mention. Turn wording feedback into rules so it sticks (`writing.banned`, `writing.replace`, `glossary` in `study.config.mjs`). Re-run `check.mjs`, re-view every slide whose PNG changed, update README's history.

## Commands

| Command | Does |
|---|---|
| `new.mjs <dir> [--title --lang --flow --steps --name]` | scaffold a study folder |
| `build.mjs [dir]` | slides → `<name>.excalidraw`, `build/slides/`, `build/manifest.json`, `build/outline.md` |
| `lint.mjs [dir] [--json] [--rules]` | run the rule catalog; exit 2 on errors |
| `render.mjs [dir] [--slides 3,5-7] [--preview]` | Excalidraw render to PNG, measured text widths, contact sheets, lint again |
| `check.mjs [dir] [--slides …] [--no-render] [--no-calibrate]` | build → lint → render → lint → review status; recalibrates text widths after a full render |
| `review.mjs [dir] [--mark …] [--audit <kind> --verdict … --file report] [--amend]` | review ledger; kinds: facts, pedagogy, writing, consistency, visual; `--file` keeps the report in `audits/` |
| `claims.mjs [dir] [--apply rows.md]` | evidence ledger counts; merge returned rows by id |

Rule catalog and ignore policy: [lint-rules.md](references/lint-rules.md). Slide DSL: [kit-api.md](references/kit-api.md).

## Never

- Edit files in `build/` or the generated `.excalidraw` by hand; change `slides/` and rebuild.
- Silence a finding to pass. Element-level `lint.ignore` needs a reason; study-level ignores need the user's agreement.
- Mark a slide reviewed that you did not view at its current hash, or report an audit that did not run.
- Copy private material (internal numbers, code, names) anywhere the brief does not allow.
