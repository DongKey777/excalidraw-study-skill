# Evidence

Most defects that survived earlier versions of this workflow were factual, not visual: a value copied from the wrong query, an estimate labelled as a measurement, cumulative and daily numbers mixed, a UTC time read as local, a behaviour described from an outdated document. Layout lint cannot catch any of them. The ledger and local experiments exist for this.

## The ledger (`evidence/claims.md`)

One row per fact or number that will appear on a slide.

| Column | Rule |
|---|---|
| id | `C1`, `C2`, … Slides cite these in `claims: ["C3"]`. |
| claim | the sentence as the slide will state it |
| value | the number with its unit and scope ("per day", "cumulative since 09-01", "p95") |
| source | file and line, link, or experiment file. Not "the docs". |
| as of | date, and time zone for times |
| status | `확인`/`verified`, `실측`/`measured`, `문서`/`documented`, `계산`/`derived`, or `미확인`/`todo` |

Rules:

- Write the claim before drafting the slide that uses it.
- `derived` means you computed it from other claims; name them in the source column.
- An estimate is a claim whose value says "about" and whose source says how it was estimated. Never present an estimate as a measurement.
- Times carry a zone. Set `writing.requireTimezone: true` when times matter; lint then flags clock times without KST/UTC.
- When code, schemas or PR states are cited, record the commit or merge date; they change.

`lint` fails when a slide cites a missing claim or one whose status is not verified. It warns when a slide shows three or more measured-looking numbers with neither `source` nor `claims`.

## Local experiments (`evidence/labs/`)

Behaviour ("HOT does not apply when an indexed column changes", "a function on the column prevents an index range scan") must be reproduced, not recalled.

- Pin versions: `docker run --rm -d --name study-pg18 -p 55432:5432 -e POSTGRES_PASSWORD=pw postgres:18.4`.
- Use a dedicated container name and port.
- Keep each experiment as an input/output pair: `03-hot.sql` and `03-hot.out.txt`, output saved from the command, never retyped.
- Record in `labs/README.md`: setup, command, which claims it verifies, and whether the result changed the material.
- Never run experiments against production or shared environments. If a claim can only be checked in production, mark it unverified and say so on the slide or in the README.

## Sources (`evidence/sources.md`)

Number the sources (§1, §2, …). A slide's `source` field points at them: `source: "근거 §2·§5"`. Keep dates and versions next to each source.

## Numbers on slides

Numbers are for understanding, not for proving diligence.

- Keep a number if it sets scale ("about 300 MB, 3 seconds"), compares ("five times fewer pages"), or is a threshold or setting the reader must remember.
- Round to what the argument needs; keep exact values in the ledger.
- Put the number and its unit in one text element.
- A definition (what a tree hash or a visibility map is) is a claim too: cite the official documentation (`문서`/`documented`) or show it in a lab. When the user asked for "only what you verified by running it", prefer the lab, and drop a term you can neither show nor cite.
- Escape a pipe inside a ledger cell as `\|`; the ledger is a markdown table.
- Label examples as examples. A calculation example is not a benchmark.
- `writing.maxNumbersPerSlide` (default 12) makes lint warn on slides with many quantities. Identifiers (case numbers, PR numbers, dates, versions) are not counted; list study-specific ones in `writing.identifiers`.

## Privacy

The brief says where the material may go. Material built from a private project stays where the user keeps it. Do not publish it, paste it into shared tools, or reuse its numbers in public examples.
