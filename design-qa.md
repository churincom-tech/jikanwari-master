# Design QA

## Final result

**Passed** — no unresolved P0, P1, or P2 findings in the approved integrated UI redesign scope.

## Comparison setup

| Item | Evidence |
| --- | --- |
| Selected visual target | `artifacts/verification/ui_redesign_2026-07-18/source-target.png` |
| Implementation state | Standard sample, condition-setting screen, 1487 x 1058 viewport |
| Implementation screenshot | `artifacts/verification/ui_redesign_2026-07-18/implementation-fixed-viewport.png` |
| Combined comparison | `artifacts/verification/ui_redesign_2026-07-18/source-vs-implementation.png` |
| Result and mobile states | `implementation-results-viewport.png`, `implementation-mobile.png` in the same evidence folder |

## QA findings

| Surface | Result | Evidence and judgment |
| --- | --- | --- |
| Information hierarchy | Pass | Four stages are visible across the top, one work area is shown, and the fixed footer holds Back, readiness, and the primary action. |
| Condition-setting layout | Pass | Class/lesson selection, fixed-slot grid, and three-level condition review are visible together at desktop width. |
| Warnings and recovery | Pass | Blocking issues, items to check, and enabled improvement conditions are separated. The first actionable message links to its correction screen. |
| Results comparison | Pass | Three candidate cards remain selectable; detail messages use the same three-level grouping and include a return-to-conditions action. |
| Responsive behavior | Pass | At 390 x 844, the page has no document-level horizontal overflow; the step path scrolls within its own region; the workbench stacks; the primary action remains visible. |
| Accessibility | Pass | Current stage exposes `aria-current`, fixed cells have contextual `aria-label` values, period headings use row scope, focus-visible styling is present, and controls meet the 42px target size in the redesign rules. |
| Visual fidelity | Pass | Teal/mint palette, horizontal step path, split workbench, grouped status panel, and teal bottom action bar align with the selected target. Spacing and duplicated headings were corrected after comparison. |
| Browser stability | Pass | Chrome reported zero console errors and zero page errors in blank, sample, condition, result, and mobile checks. |

## Intentional source deviation

The generated target showed school-specific clock times under `1限` and later periods. The implementation deliberately shows only `1限` through `n限`. Start and end times vary by school and do not affect generation, so removing the clock text reduces setup work and avoids misleading fixed values. No clock-time setting was added.

## Final validation

- JavaScript syntax: passed for all application scripts checked.
- Data-safety regression: 14/14 passed.
- Representative timetable acceptance: 6/6 passed.
- Standard scenario: 3 candidates, 174 entries each, hard violations 0.
- H-001 through H-013 and S-001 through S-007 coverage: passed by the representative suite.

## Remaining product-level work outside this UI scope

Actual-school data validation, manual result correction/change history, and teacher/room result views remain open. They do not block this redesign scope but continue to block a final whole-product completion verdict.
## User-feedback addendum — navigation and starting method

**Passed** — the user-directed change intentionally overrides the earlier overflow-menu treatment.

- `白紙から` is now a visible header action rather than hidden under `その他`.
- Sample loading moved to the open `使い方・サンプル` section on the School screen.
- At 390 x 844, the sample button is fully visible above the fixed footer, with no document-level horizontal overflow.
- The School screen no longer places a red blocking banner before the start guide; blocking guidance remains available in Conditions and Results.
- Screen transitions reset to the page top. Chrome measured 666px before a Next action and 0px after the next screen opened.
- Evidence: `artifacts/verification/navigation_start_feedback_2026-07-18.md`.
- No unresolved P0, P1, or P2 finding was introduced.