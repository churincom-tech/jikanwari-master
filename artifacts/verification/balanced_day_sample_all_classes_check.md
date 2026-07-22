# Balanced Day Sample And All Classes Check

## Date
2026-07-02

## Scope
- `app/scripts/timetable-core.js`
- `app/scripts/state.js`
- `app/index.html`
- `app/README.md`
- `docs/timetable_constraint_catalog.md`

## Changes Checked
- Sample button label changed from `まず試す` to `時間割サンプル例`.
- Candidate generation now uses class/day target lengths so each class timetable is filled from 1st period without middle gaps.
- Daily lesson counts are balanced for ordinary weekly timetables, e.g. 29 weekly periods across 5 days becomes 6/6/6/6/5.
- Required double-period lessons are reserved before ordinary single-period choices.
- All-class result view remains available.

## Automated Checks
- `node --check app/scripts/timetable-core.js`: pass
- `node --check app/scripts/state.js`: pass
- `node --check app/scripts/main.js`: pass
- `node --check app/scripts/sample-data.js`: pass

## Generation Check
Using `App.SampleData.createSampleState()` and `App.TimetableCore.generateCandidates(state, 3)`:

| Candidate | Entries | Hard violations | Table shape issues |
| --- | ---: | ---: | ---: |
| 候補A | 174 | 0 | 0 |
| 候補B | 174 | 0 | 0 |
| 候補C | 174 | 0 | 0 |

`Table shape issues` checks both:
- no blank period before a later lesson on the same class/day
- no day outside the balanced 5-6 period range for the 29-period sample week

## Browser Check
Local check URL: `http://127.0.0.1:8801/`

- Page title: `コマいぬ`
- Header sample button: `時間割サンプル例`
- Candidate cards after sample generation: 3
- All-class result view button: present
- All-class view table count: 6
- DOM table shape issues in all-class view: 0
- Console errors: 0

## Notes
The sample uses a 35-week representative weekly timetable based on current junior high school standard annual subject hours. Annual 45/50-hour subjects cannot be represented exactly as the same integer weekly timetable every week, so the sample keeps a normal 29-period week and leaves yearly/alternate-week precision as a future enhancement.
