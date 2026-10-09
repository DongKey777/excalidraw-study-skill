# Review, audit, delivery

Mechanical checks confirm geometry, wording rules and references. They cannot tell whether a slide teaches. That takes looking at the render and a second reader.

## Evidence types

Keep them apart when you report:

- **lint**: static rules on the built file (`build/lint.json`)
- **render**: PNGs made by Excalidraw's exporter, with measured text widths (`build/render/`)
- **view**: you opened a PNG and looked (`review.json` marks, bound to the PNG hash)
- **audit**: a fresh reader checked facts, pedagogy, writing or visuals (`review.json` audits)

"All slides reviewed" means every current PNG has a mark in `review.json`. `review.mjs` prints what is missing.

## The review round (phase 4)

1. `node <skill>/scripts/check.mjs <dir>` with no `--slides`, so every slide and the contact sheets are fresh.
2. Open the contact sheets (`build/render/contact-NN.png`) first. Judge the study as a whole: rhythm of dense and light slides, repeated compositions, colour meaning, whether parts are visually distinct.
3. Open every slide PNG at full size and walk the checklist below. Write findings down as you go (slide, problem, fix). Do not fix while viewing.
4. Mark every slide you viewed, including the ones with findings: `review.mjs <dir> --mark 1-12`. The marks hold the hash of the PNG you saw.
5. Fix all findings in one batch in `slides/`.
6. Re-run `check.mjs`. It prints "changed since the previous render" with the slide numbers whose PNG changed, and `review.mjs` lists marked slides whose PNG no longer matches. View those, then mark them.
7. One confirmation round at most, in the same order: view, mark, fix, check. Then stop; further polishing goes to the audit.

### Per-slide checklist

**Message**
- The takeaway is one sentence and the slide's content supports exactly that.
- The title states the point; the subtitle adds what the reader will see.
- Every term on the slide is explained here or earlier.

**Figure**
- The figure shows the relationship (order, containment, comparison, change). If the slide is only text in boxes, is there a figure it needs?
- Arrows mean movement or cause; none are decorative; none cross text.
- One element dominates; the eye knows where to start.

**Layout**
- Nothing touches, overlaps or nearly touches (chips, labels, arrowheads).
- Boxes fit their content; no large empty region without purpose.
- Neighbouring elements share edges; spacing between groups exceeds spacing inside groups.
- Text is legible at half size (look at the contact sheet).

**Text**
- Reads naturally aloud; no translationese, no drama, no repeated sentence shapes (see the writing guide).
- Numbers help understanding, carry units, match the ledger.
- Code and logs are real excerpts; omissions marked.

## Audits (phase 5)

Run each audit in a context that did not write the slides: a subagent, a separate session, or another person. Give every auditor the same inputs: `brief.md`, `plan.md`, `evidence/`, `build/outline.md`, the PNGs in `build/render/` and `build/lint.json`, plus `study.config.mjs` for the consistency pass. Do not give it your reasoning. Ask it to write its report to `audits/drafts/<kind>.md` in the study. When your runtime cannot start a fresh context, run the passes yourself one at a time and say in the report that they were not independent.

For a long study (more than about 15 slides), split the facts audit by part so each auditor checks 5–15 slides against the sources, and give each group's findings to a second fresh reader who tries to refute them before you act. Auditors misread sources too (UTC vs KST, one node vs the whole plan, before vs after a deploy).

Record each pass right after it returns and before you change anything: `review.mjs <dir> --audit <kind> --by "<who>" --summary "<result>" --verdict <ship|fix|…> --file <report>`. Kinds are facts, pedagogy, writing, consistency and visual; a follow-up is the same kind recorded again on the fixed build, and `--amend` replaces a record you got wrong. The record is bound to the build the auditor saw; recording it after your fixes would claim the fixed build was audited. `--file` copies the auditor's full report into `audits/` inside the study as `NN-<kind>-<date>.md`; delete `audits/drafts/` once every draft is recorded. Keep reports in the study, not in a temp directory: fixes often take more than one session, and a lost report means auditing again.

After fixes, run a follow-up only for the kinds whose verdict was not `ship`, plus the consistency pass. A kind that returned `ship` is not repeated unless your fixes touched what it judged (a fact changed, a slide was redrawn).

### Facts

> You are checking a study material against its evidence. For every slide, list each factual statement and number. For each, find the claim id in evidence/claims.md and the source it cites, open the source, and classify: matches / value differs / context distorted (right number, wrong scope, time zone or query) / no source. Also flag estimates presented as measurements and statements about people's knowledge or intent that no source supports. Output a table: slide, statement, claim id, verdict, correction. Do not rewrite slides.

### Pedagogy

> You are a reader who knows the prerequisites in brief.md and nothing else. Read the slides in order (PNG files). For each slide: what is the one thing it teaches, which terms are used before being explained, what question does it leave that the next slide does not answer. Then list missing concept slides, slides that teach two things, and places where the order confuses. Be specific (slide number, term).

### Writing

> Read every text on the slides against references/writing-ko.md (or writing-en.md). List translationese, stacked nouns, announcements, drama or metaphor, personification, repeated sentence shapes, inconsistent terms and unnatural word choices, each with a rewrite that keeps the meaning. Do not add facts.

### Consistency

> Read all slides and list every fact, number or term that appears on more than one slide. For each, check that every slide says the same thing (same value, same unit, same wording for the same behaviour, same name for the same thing). Then read brief.md and study.config.mjs (`writing.replace`, `writing.variants`) and list terms used against those choices. Output: slides, the differing texts, which one the evidence supports.

Run this pass after fixes too (see below): fixes made slide by slide are where the same fact drifts apart.

### Visual finish

> You review rendered slides with fresh eyes. First check evidence validity: every PNG is 1600x900, slide count matches build/outline.md, no blank or half-rendered frames, no missing glyphs (tofu boxes). If any fails, the verdict is "recapture" and you stop. Otherwise form your judgment from the images before reading build/lint.json. Return: verdict (recapture | rebuild | fix | ship), at most 8 ordered fixes (slide, what, why), and one line on what must be kept. "ship" is allowed only when no fix is material.

A follow-up visual pass scores each earlier fix as resolved, partial or unresolved. Open fixes never become "ship".

## Applying audit findings

For a short study, fix the findings yourself in one batch. For a long one (or many findings), split the work, but prepare first:

1. **Decide shared wording once.** Read all findings and settle every term, unit and recurring fact that more than one slide uses (for example "VACUUM, not 청소", "커넥션 최대 3개", which of two conflicting numbers the evidence supports). Put the term decisions into `study.config.mjs` (`writing.replace`, `writing.variants`) so lint enforces them for everyone; write the rest in a short conventions note next to the reports in `audits/`.
2. **Split by slide file.** One fixer per `slides/*.mjs` file (or group of files), each with the findings for its slides plus findings on other slides that mention them. Fixers edit only their files. They do not edit `claims.md`, `study.config.mjs` or other slides; they return ledger rows and anything that needs a decision.
3. **Give each fixer its own copy for checking.** Several fixers building the same study at once read each other's half-edited files. Each fixer lints a copy: `cp -R <study> <tmp>` without `build/`, copy its slide files in, `check.mjs <tmp> --no-render`.
4. **Facts are re-verified, not copied.** A fixer applies a fact finding only after opening the cited source; findings refuted by the second reader are not applied.
5. **Merge.** Apply the returned rows with `claims.mjs <dir> --apply rows.md` (it replaces rows by id and inserts new ones next to their siblings), run `check.mjs`, and resolve conflicts the fixers reported: two slides now stating a fact differently is the common one. Then run the consistency pass.
6. **Structural changes are the user's.** Moving slides between parts, adding or dropping slides: apply the no-move fix (reword, add a pointer) and list the move as a decision in README.

If a fixer stops part way, its file may hold some edits. Restart it on the current file and tell it to keep correct edits and finish the rest.

## Delivery (phase 6)

1. Finish `README.md` and delete its template marker line: how to open, structure (from `build/outline.md`), evidence and its date, verification record (lint result with kept warnings and why, how many slides viewed, which audits ran and what they changed), what could not be verified, decisions left to the user, history.
2. Run `check.mjs` once more; the report must match the README.
3. Reveal the file to the user (`open -R <file>` / `xdg-open <dir>` / `explorer /select,<file>`). Without a desktop (a remote machine, a container, a CLI agent with no GUI), print the absolute path of the `.excalidraw` file and the contact sheets instead.
4. Report in a few lines: what was built (slides, parts), which checks ran with results, what was not verified, decisions the user may want to revisit. Do not claim a check you did not run.
