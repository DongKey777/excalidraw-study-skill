# Writing slides in English

Write the way a person explains at a whiteboard. Rules are signals: lint catches some, the rest needs reading aloud. Do not swap a flagged phrase for a synonym of the same cliché; rewrite the sentence.

**error** = lint fails, **warn** = judge it, **review** = lint cannot see it.

| Rule | Bad → good | Check |
|---|---|---|
| Titles state the point, no trailing period | "Understanding indexes." → "A B-tree keeps values in order" | error `title-period` |
| Subtitle adds what the reader will see, never repeats the title | | review |
| Say it; do not announce it | "Let's dive into the plan" → "The plan reads 400k pages" | warn `style` |
| Verbs over stacked nouns | "performs validation of the request" → "validates the request" | review |
| No stock AI phrasing | delve, tapestry, seamless, unlock, game-changer | warn `style` |
| No evaluation words without evidence | "a powerful, robust fix" → "reads 100x fewer pages" | warn `style` |
| No em dashes in slide text | "cause — lock wait" → "The cause is a lock wait" | error `dash` |
| "Not X but Y" at most once per slide | | warn `contrast-cadence` |
| One name per concept across the study | refactor / re-factor | warn `variants` |
| One phrasing per behaviour | "the visibility map is set" mixed with "the bit is on" → pick "the bit is on" | register both in `variants` |
| "Slide N" in body text means a slide of this study only | "Chapter 12 blames …" (an outside doc) → name the doc; "3-4 pages" not "3-4 slides" | review; write slide numbers as `{{#id}}` |
| Identifiers and settings stay in code form | `shared_buffers` | review |
| Numbers only when they help; units attached | "about 300 MB, 3 s" | warn `numbers` |
| Times carry a zone | "14:05 UTC" | warn `timezone` (opt-in) |
| No emoji | | error `emoji` |
| Unverified claims are marked as such | "The team didn't know" → "Solving this needed concept X" | review |

After writing a slide, read only its takeaway. If that sentence does not stand for the slide, restructure the slide.
