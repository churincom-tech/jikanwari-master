# Lunch Break And Double-Period Constraint Check

## Date
2026-07-02

## Scope
- `app/scripts/sample-data.js`
- `app/scripts/state.js`
- `app/scripts/timetable-core.js`
- `app/scripts/validation.js`
- `docs/timetable_constraint_catalog.md`

## Changes Checked
- Removed double-period preference from `理科` and `保体` in the sample and default curriculum master.
- Added `H-011`: double-period lessons must not cross lunch, assumed to be between 4th and 5th periods.
- Added `H-012`: lessons without double-period mode must not be placed in adjacent periods.
- Kept required double-period sample blocks for `美術`, `技術`, and `家庭科`.

## Automated Checks
- `node --check app/scripts/sample-data.js`: pass
- `node --check app/scripts/timetable-core.js`: pass
- `node --check app/scripts/validation.js`: pass
- `node --check app/scripts/state.js`: pass

## Generation Check
Using `App.SampleData.createSampleState()` and `App.TimetableCore.generateCandidates(state, 3)`:

| Candidate | Entries | Hard violations | Shape issues | 理科/保体 adjacent | 4-5 crossing |
| --- | ---: | ---: | ---: | ---: | ---: |
| 候補A | 174 | 0 | 0 | 0 | 0 |
| 候補B | 174 | 0 | 0 | 0 | 0 |
| 候補C | 174 | 0 | 0 | 0 | 0 |

候補Aの連続ペア:
- `1年1組 月2-3 美術`
- `1年1組 月5-6 家庭科`
- `1年2組 月2-3 技術`
- `1年2組 月5-6 美術`
- `2年1組 月5-6 技術`
- `2年2組 月2-3 家庭科`

## Browser Check
Local check URL: `http://127.0.0.1:8801/`

- All-class view showed 6 class timetables.
- DOM table shape issues: 0.
- Adjacent `理科` / `保体` pairs: 0.
- 4-5 crossing pairs: 0.
- Hard constraints panel: no hard violations.
- Console errors: 0.
