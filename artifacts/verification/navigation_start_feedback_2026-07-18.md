# Navigation And Start-Method Feedback Verification — 2026-07-18

## Verdict

Passed. Both user-reported usability issues are corrected without removing automatic recovery of previously entered data.

## User feedback addressed

1. Moving from the bottom of one screen to the next screen kept the same bottom scroll position.
2. `白紙に戻す` and the sample were hidden under `その他`, so the initial starting method was unclear.

## Implemented behavior

- Every change between School, Teacher, Room, Lesson, Conditions, and Results resets the document scroll position to the top.
- `白紙から` is always visible in the header and retains the existing confirmation dialog.
- The `その他` menu was removed.
- `使い方・サンプル` is open on the School screen and explains the three main steps.
- `サンプルを読み込んで試す` is placed in that section.
- Fresh browser storage starts with `新規時間割`, zero lessons, and zero candidates.
- Existing local input is still restored automatically to prevent data loss; the help text explains this behavior.
- Loading the sample from a true blank state requires no confirmation. Loading it over entered data requires confirmation and preserves the current input when cancelled.
- Blocking error banners are hidden during early input screens so the start guide appears first. They remain visible in Conditions and Results, where the user acts on them.

## Chrome verification

| Check | Result |
| --- | --- |
| Fresh state | `新規時間割`, lessons 0, candidates 0 |
| Restored state | Edited school name restored after reload |
| Header start action | `白紙から` visible; old Other menu absent |
| Help/sample | Section open and sample button visible |
| Blank sample load | No dialog; 3 candidates; Results active |
| Protected sample replacement | One confirmation; Cancel preserved `変更済み学校` |
| Scroll transition | Before: 666px; after next screen: 0px |
| Early blocking banner | Hidden on School; visible on Conditions |
| Mobile viewport | 390 x 844, no page overflow |
| Mobile sample discoverability | Button fully above the fixed footer without scrolling |
| Console/page errors | 0 / 0 |

## Regression results

- JavaScript syntax: 8/8 passed.
- Data-safety tests: 14/14 passed.
- Representative timetable acceptance: 6/6 passed.
- Baseline timetable signature remains 3 candidates x 174 entries with hard violations 0.

## Visual evidence

- `artifacts/verification/navigation_start_feedback_2026-07-18/desktop-start-method.png`
- `artifacts/verification/navigation_start_feedback_2026-07-18/mobile-start-method.png`
- `artifacts/verification/navigation_start_feedback_2026-07-18/mobile-start-viewport.png`

## Evidence boundary

The timetable regression scenario remains project-representative data, not an actual school's data.
