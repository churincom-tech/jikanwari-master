# Double Period Sample And Edit Regeneration Check

## Date
2026-07-02

## Scope
- `app/scripts/sample-data.js`
- `app/scripts/timetable-core.js`
- `app/scripts/main.js`
- `app/scripts/state.js`
- `app/styles.css`

## Changes Checked
- The standard sample keeps the current junior high school annual-hours intent as a 35-week representative timetable.
- `技術・家庭` is represented as a class-specific `技術` or `家庭科` 2-period block in grade 1 and grade 2 sample weeks.
- `美術` grade 1 remains required as a 2-period block.
- `理科` and `保体` are treated as preferred double-period subjects, so the generator places adjacent periods when feasible.
- Editing sample lesson data clears stale results and shows an inline `この条件で作り直す` action in the result view.

## Automated Checks
- `node --check app/scripts/sample-data.js`: pass
- `node --check app/scripts/timetable-core.js`: pass
- `node --check app/scripts/main.js`: pass
- `node --check app/scripts/state.js`: pass

## Generation Check
Using `App.SampleData.createSampleState()` and `App.TimetableCore.generateCandidates(state, 3)`:

| Candidate | Entries | Hard violations | Shape issues |
| --- | ---: | ---: | ---: |
| 候補A | 174 | 0 | 0 |
| 候補B | 174 | 0 | 0 |
| 候補C | 174 | 0 | 0 |

候補Aの連続ペア例:
- `1年1組 月2-3 美術`
- `1年1組 月4-5 家庭科`
- `1年2組 月2-3 技術`
- `2年1組 月4-5 技術`
- `2年2組 月2-3 家庭科`
- `理科` and `保体` also have adjacent preferred pairs.

## Browser Check
Local check URL: `http://127.0.0.1:8801/`

- `時間割サンプル例` after reload generated 3 candidate cards.
- All-class view showed 6 class timetables.
- DOM table shape issues: 0.
- Detected double-period pairs in all-class view: 21.
- Editing a sample weekly count cleared stale candidates and showed `この条件で作り直す`.
- Inline regeneration after editing produced 3 candidate cards.
- Console errors: 0.

## Note
文科省の標準授業時数は年間時数で示されます。35時間や45時間の教科は、毎週同じ整数コマの表だけでは完全再現できないため、このサンプルは35週換算の代表週として扱います。
