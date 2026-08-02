# RESUMELAB — FIXES & IMPROVEMENTS BACKLOG

Drop this file in the resumelab project root. Tell Claude Code:
"Read FIXES.md and action every item marked TODO. Mark each DONE
with a brief note when complete. Add new findings at the bottom."

---

## SCORER ALGORITHM FIXES

### [DONE — Slice A, 2026-07-30] Number detection regex is broken
Scoring 0/15 on measurable impact even when bullets contain real metrics
like "3,500+ employees", "91.23%", "15+ organizations", "750+ employees".
The regex does not match numbers formatted with +, commas, or ₹ prefix.

**Fixed in `backend/scoring/scorer.py`:**
- Replaced `\d+`/`\d[\d,]*` with `_N = r"[\d,]+(?:\.\d+)?"` (handles commas, decimals, Indian format)
- Added `\+?` between number and unit to absorb plus signs ("50+" patterns)
- Added "N adjective unit" variant for patterns like "8 junior developers"
- Expanded `_UNIT_ALTS` from 7 to 40+ professional unit words (engineers, clients, records, features, sprints, etc.)
- Added standalone `\b{_N}\+` pattern for "40+", "1,000+" etc.
- Gate: strong reference resume achievement 14.8/15 → 15/15; all 9 tests still pass

---

### [DONE partial — Slice A, 2026-07-30] One-page penalty should be conditional on experience
Currently penalises any resume over one page equally.

**Partially fixed:** 2 pages now gives 3/6 instead of 0/6, with detail note "acceptable for 7+ years".
Full experience-based conditional (detect date ranges → adjust threshold) is still TODO.

Fix (full version): detect years of experience from date ranges in the Experience
section. Apply the penalty as:
- 0 to 3 years: one page required (full 10-point penalty for 2 pages)
- 3 to 7 years: two pages acceptable (zero penalty)
- 7+ years: two pages expected (bonus for two, penalise one)

---

### [TODO] LinkedIn detection: check string presence not just hyperlink
Currently scoring LinkedIn=False on resumes where the URL is present
as plain text (e.g. "linkedin.com/in/username") but not a hyperlink.

Fix: scan the raw extracted text for "linkedin.com/" as a string match
in addition to checking for embedded hyperlinks. Same fix for GitHub
and portfolio URLs.

---

### [DONE — Slice A, 2026-08-01] Phrase-repetition check
Resume Worded flags repeated multi-word phrases across bullets.

**Fixed in `backend/scoring/scorer.py`:**
- Added `_count_phrase_repetition(bullets)`: scans trigrams across all bullets,
  flags any appearing 3+ times. Common tech terms excluded via `_REPEAT_EXCLUSIONS`.
- Penalty: -0.5 pts per repeated trigram, capped at existing variety score.
- Folded into the `start_variety` check (3 pts max); same check ID, no point-budget change.
- Detail now reports both first-word overuse AND repeated phrases.

---

### [DEFERRED — reason documented] Outcome vs context framing detection
Numbers that appear as scale context ("serving 3,500+ employees")
score lower than numbers framed as outcomes ("scaled to 3,500+ employees",
"reduced X by 40%"). Currently the scorer treats all numbers equally.

Deferred: outcome-verb patterns already in IMPACT_SIGNALS handle most cases
(`r"\bincreased\b.*\bby\b"`, `r"\breduced\b.*\bby\b"`, etc.). Full 1.5x
weighting would restructure the achievement check from binary to weighted —
defer until real user data shows calibration is still off after number fix.

Fix (when undeferred): check whether the number appears adjacent to an outcome verb
(reduced, increased, improved, eliminated, scaled, achieved, cut,
saved, generated, grew, accelerated, raised). Weight outcome-framed
numbers at 1.5x vs context numbers at 1.0x in the impact score.

---

### [DEFERRED — reason documented] Tense consistency check
Current role bullets should use present tense, past roles past tense.
Mixing is a recruiter flag and an ATS parsing issue.

Deferred: false-positive rate is high without a POS tagger. Past-tense action
verbs (Integrated, Optimized, Reduced) end in -ed but are correct. Cannot
distinguish active-past from passive-past from text alone without context.
Revisit when/if a POS library (spacy) enters the dependency list.

Fix (when undeferred): detect the most recent role (Present or current year end date).
Scan its bullets for past-tense verbs (ended in -ed). Flag each as
a deduction with a specific line reference.

---

### [DEFERRED — reason documented] Duplicate content detection
Same claim appearing in the summary AND in an experience bullet
wastes space and can look like padding.

Deferred: needs fuzzy string matching; `thefuzz` not in current deps.
Adding a library for a non-scoring advisory is not the right trade-off now.

Fix (when undeferred): compare summary sentences against bullet text using fuzzy
matching (70%+ similarity = duplicate). Flag but do not score harshly;
suggest removing the weaker instance.

---

### [DONE — Slice A, 2026-08-01] Skills evidenced in bullets
A skill listed in the Skills section but never mentioned in any bullet
is a keyword claim without proof.

**Fixed in `backend/scoring/scorer.py`:**
- Skills extraction now reads ALL lines of the ## Skills section (was only first line).
- Advisory detail appended to `depth` check: lists unevidenced skill names.
- No point deduction — purely informational, exactly as specified.

---

### [DEFERRED to Slice C] Render the parsed ATS text visually
Show the user their resume as plain extracted text (the way an ATS
reads it) alongside the original. If section headers are garbled or
bullet order is scrambled in the extracted version, that is a
critical ATS failure no other free tool surfaces clearly.

Already doing parse-back fidelity check; this is the visual output
of that check surfaced in the UI.

---

## PIPELINE FIXES

### [TODO] CLAUDE.md: update one-page rule to match conditional above
Currently says "HARD LIMIT: one page, always." Should match the
conditional logic: one page for 0-3 years, two acceptable for 3+.

---

### [TODO] CLAUDE.md: add outcome-framing rule to Phase 4
Add to the rewrite instruction: "Every bullet carrying a number must
frame it as an outcome (scaled to X, reduced by Y, achieved Z) not
just context (serving X, with Y). If the source provides a number
without an outcome verb, use the closest defensible outcome verb."

---

## UX / PRODUCT FIXES

### [TODO] Resume Worded score display bug
The before/after demo on the landing page shows "ATS 44" in both
BEFORE and AFTER columns with "+39 pts" floating. Counter animation
is not completing before the demo renders. Fix the animation timing
or hardcode the final state.

### [TODO] LinkedIn URL in generated resumes
The generator writes "LinkedIn" as plain text in the header. The
parser then scores LinkedIn=False. Fix: write the full URL
(linkedin.com/in/username) in the header so the parser detects it
as present even without a hyperlink.

---

## FINDINGS LOG
<!-- Add new scorer findings here after each test run -->

| Date | Resume | Our Score | Resume Worded | Gap | Primary Gap Cause |
|---|---|---|---|---|---|
| Jul 2026 | Shobhit (original) | — | 65 | — | No numbers |
| Jul 2026 | Shobhit (v2) | — | 83 | — | Numbers added, buzzwords removed |
| Jul 2026 | Hasti (original) | 50 | 48 | +2 ours | Both low, no numbers |
| Jul 2026 | Hasti (v2) | 57 | 77 | -20 ours | Number regex broken, one-page penalty |

---

## FORMATTING FIXES

### [TODO] Dates must be right-aligned on all role and project lines
ATS parsers and human screeners both expect dates to sit flush right.
In Word the positional tab approach (PositionalTab RIGHT MARGIN) works
correctly in the docx builder. Verify in LibreOffice export too — some
renderers lose the positional tab and collapse dates next to the role
title instead of pushing them to the margin.

Fix: in the docx builder, every role line and project title line must
use PositionalTab with alignment=RIGHT, relativeTo=MARGIN. Test by
running pdftotext and checking that date strings appear at the end of
their line, not mid-line.

Applies to: role lines (Company | Role → Date), project lines (Project
Name → Date), education lines (Degree | University → Date).

---

### [TODO] Consistent indentation for ATS parsing
ATS parsers read text in document order. Inconsistent indentation
(mixed use of tabs, spaces, and paragraph indent) causes parsers to
scramble bullet content or attach it to wrong sections.

Required standard (already in builder, verify on every output):
- Section headers: no indent, bold, with bottom border
- Role/company lines: no indent
- Subheader lines (e.g. "StaffWise HRMS — Primary Ownership"): no
  indent, bold, smaller font
- Bullet points: left indent 280-300 twips, hanging indent 160-180
  twips, bullet character U+2022. Never use tab characters for
  bullet indentation.
- Skills lines: no indent, label bold, value plain

Verification: run pdftotext on output and confirm bullets start with
"•" not whitespace, and no bullet content appears on a line by itself
without the bullet character (indicates bad line wrap or indent).

---

### [TODO] User edits in Word can lose number improvements
Pattern observed: user opens generated DOCX, edits URLs, saves and
uploads back. The Word edit resets to a previous version losing number
additions made in subsequent builds. 

Fix in app: lock the generated DOCX with a visible DRAFT watermark
until the user explicitly downloads the FINAL version. Add a revision
history panel showing what changed per build. When user uploads a
resume back for re-processing, diff it against the last generated
version and warn if any numbers were removed.

---

## FINDINGS LOG
<!-- Add new scorer findings here after each test run -->

| Date | Resume | Our Score | Resume Worded | Gap | Primary Gap Cause |
|---|---|---|---|---|---|
| Jul 2026 | Shobhit (original) | — | 65 | — | No numbers |
| Jul 2026 | Shobhit (v2) | — | 83 | — | Numbers added, buzzwords removed |
| Jul 2026 | Hasti (original) | 50 | 48 | +2 ours | Both low, no numbers |
| Jul 2026 | Hasti (v2) | 57 | 77 | -20 ours | Number regex broken, one-page penalty |
| Jul 2026 | Hasti (v4) | 57 | 80 | -23 ours | Number regex broken (numbers not detected) |
| Jul 2026 | Hasti (v5) | — | 74 | — | Score dropped after URL edit lost number improvements |
