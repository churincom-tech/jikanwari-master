# No Midday Gaps And Fixed Columns Check

Date: 2026-07-02

## Scope
- Prevent generated class timetables from leaving an empty period before later lessons on the same day.
- Keep timetable day columns equal width even when a subject name is long.
- Shorten `技術・家庭（技術）` / `技術・家庭（家庭）` inside timetable cells while preserving the full label in the title attribute.

## Automated Checks
- JS syntax check: passed for `app/scripts/*.js`.
- Standard sample generation:
  - candidates: 3
  - hard violations: `0, 0, 0`
  - middle gaps: `0, 0, 0`
  - scores: `33, 2, 0`
- Intentional invalid candidate:
  - detected `H-008`
  - message: `1年1組 月2限が空きのまま、後ろの時限に授業があります。空きはその日の末尾に寄せてください。`

## Browser Checks
- URL: `http://127.0.0.1:8797/`
- Single-class result:
  - hard violations shown as 0
  - middle gaps: 0
  - day column width delta: 0px
  - `技家（技術）` visible, full label preserved in `title`
  - console errors: 0
- All-class result:
  - class timetable count: 6
  - middle gaps: 0
  - max day column width delta: 0px
  - short technology/home economics label visible

## Screenshot
- `artifacts/verification/no_midday_gaps_fixed_columns_browser.png`
