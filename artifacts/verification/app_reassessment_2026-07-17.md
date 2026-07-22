# App Reassessment 2026-07-17

## 1. Verdict
- Result: **不合格（最終運用判定）**
- Prototype assessment: サンプル生成と主要ハード制約検出は正常で、設計・試作の土台としては良好。
- Blocking reason: データを失う可能性がある読込・削除操作、最終要件の未実装、現在環境での実ブラウザ再確認未完了が残る。
- Source changes: なし。評価とプロジェクト記録だけを対象とした。

## 2. Environment And Evidence
- Date: 2026-07-17
- Target: `app/index.html` と参照中の `styles.css` / JavaScript 7ファイル
- Runtime: 完全ローカル、HTTP `127.0.0.1:8817`、外部通信なし
- HTTP: ルート、アプリHTML、CSS、favicon、全参照JavaScriptが200
- Syntax: 現行7ファイルと未参照の `app.js` を含む8ファイルが構文検査合格
- Browser: 2026-07-02の既存証拠では主要操作、390x844、横はみ出し0、コンソールエラー0。2026-07-17の現在画面はブラウザ接続基盤エラーのため未確認
- Version control: このフォルダはGit worktreeとして認識されなかったため、commit/branchは未確認

## 3. Core Execution Results
| Check | Result | Evidence |
| --- | --- | --- |
| Sample request validation | OK | errors 0 / warnings 0 |
| Three candidate generation | OK | 3 candidates, each 174 entries |
| Candidate hard constraints | OK | all three candidates: 0 violations |
| Scores and warnings | OK | scores 80 / 69 / 55, warnings 8 / 12 / 17 |
| Empty lesson input | OK | generation blocked with a user-readable error |
| Odd required double-period hours | OK | even-number requirement error detected |
| Fixed assignments over weekly count | OK | weekly-count overflow rejected |
| Missing lesson entry | OK | H-003 detected |
| Middle gap | OK | H-003 and H-008 detected |
| Corrupt collection types | OK | arrays normalized without an exception |
| Standard sample generation time | Attention | 1.46-2.13 seconds for three candidates, five runs |

## 4. Done Criteria Matrix
| ID | Criterion | Result | Notes |
| --- | --- | --- | --- |
| AC-001 | School, teacher, room, lesson and fixed-condition inputs | OK | Implemented and statically connected |
| AC-002 | Hard-violation-free sample timetable | OK | Three candidates, 174 entries each, hard violations 0 |
| AC-003 | Multiple candidates with score and warnings | OK | Three scored candidates generated |
| AC-004 | Input contradictions and timetable violations are explained | OK | Major constraint errors have actionable messages |
| AC-005 | JSON save and restore are safe | NG | Schema/version is not checked and replacement is not transactional |
| AC-006 | User can manually correct a generated timetable | NG | Inputs can be changed and regenerated, but result cells cannot be moved/swapped/locked |
| AC-007 | Teacher and room views are available | NG | Current result UI is class-based only |
| AC-008 | Free local-only operation | OK | No API, CDN or external data dependency |
| AC-009 | Current browser interaction and responsive behavior | 未確認 | Existing 2026-07-02 evidence passed; current browser connection failed outside the app |
| AC-010 | Real-school conditions | 未確認 | No actual or agreed realistic school fixture is available |

## 5. Findings

### BUG-001 P1: Valid JSON with the wrong shape can replace current work
- Cause: `DATA_CONTRACT` / `VALIDATION` / `STATE_MANAGEMENT`
- Evidence: `import-export.js:22-29` accepts `parsed.state || parsed` without app/version/schema checks; `main.js:122-130` replaces `state` before validation or rollback.
- Reproduction: importing `{}` is accepted as JSON and normalized to `新規時間割`, teachers 0, lessons 0, rooms 7, candidates 0.
- Expected: reject incompatible files or show an import preview, then replace only after full validation and confirmation.
- Impact: existing in-memory work can be replaced and automatically persisted.
- Repair: validate `app`, `version`, required keys and types; normalize into a temporary state; run request/candidate validation; show a summary; confirm replacement; retain rollback data.

### BUG-002 P1: Teacher and lesson deletion has no confirmation or undo
- Cause: `STATE_MANAGEMENT` / `ERROR_HANDLING`
- Evidence: `main.js:476-481` deletes a teacher and clears linked lesson/fixed teacher IDs; `main.js:859-864` deletes a lesson and all linked fixed assignments.
- Expected: show affected counts and require confirmation, or provide undo/version restore.
- Impact: one click can invalidate many rows and immediately update local storage.
- Repair: impact preview, confirmation, short-lived undo, and pre-delete snapshot.

### GAP-001 P1: Final operational workflow is incomplete
- Cause: `SPEC_MISMATCH`
- Evidence: `PROJECT_SPEC.md:21`, `PROJECT_SPEC.md:33`, `PROJECT_SPEC.md:55-56`; current result UI in `app/index.html:263-290` only provides class views and printing.
- Missing: result-cell move/swap/lock, teacher timetable, room utilization table.
- Impact: a timetable officer cannot complete the adjustment and conflict-resolution cycle entirely in the app.
- Repair: add a manual adjustment workspace with revalidation after every move, then add teacher and room perspectives derived from the same candidate.

### BUG-003 P2: H-010 represents two different diagnostics
- Cause: `SPEC_MISMATCH` / `TEST_GAP`
- Evidence: `docs/timetable_constraint_catalog.md:15` defines natural daily load balancing, while `validation.js:360` uses H-010 for any out-of-range day/period.
- Impact: reports and support conversations cannot identify the actual rule consistently.
- Repair: give out-of-range slots a separate ID or rewrite the catalog and tests to one precise meaning.

### UX-001 P2: Real-school data entry remains too laborious
- Evidence: the six-class sample already contains 23 teachers and 72 lesson rows. Each teacher exposes a card and availability grid; lessons are edited row by row.
- Impact: setup is clear but time-consuming, and copying repeated availability/assignments is error-prone.
- Repair: CSV/JSON import preview, spreadsheet-like bulk edit, duplicate/copy actions, teacher availability templates, and grade/class batch creation.

### UX-002 P2: Generation blocks the screen without progress or cancellation
- Cause: `RENDERING` / performance risk
- Evidence: `timetable-core.js:16` tries up to 600 seeds synchronously; the standard sample took 1.46-2.13 seconds across five runs.
- Impact: larger schools may appear frozen and repeated clicks cannot be safely explained.
- Repair: show busy state immediately, disable repeated actions, move search to a Web Worker, support cancellation and elapsed/progress feedback.

### UX-003 P2: Keyboard and screen-reader state is incomplete
- Evidence: the hidden file input at `styles.css:86-88` leaves the visible read action without a normal keyboard target; workflow buttons do not expose tab semantics; dynamic validation at `app/index.html:82` is not an `aria-live` region.
- Repair: use a focusable import button/input, `aria-current` or tab roles where appropriate, live validation summaries, and visible focus verification.

### TEST-001 P2: No maintained automated regression suite
- Cause: `TEST_GAP`
- Evidence: verification is mainly Markdown records and ad-hoc scripts; no committed repeatable test runner covers H-001-H-012, import migration, destructive actions and DOM behavior.
- Repair: keep a small zero-dependency Node test harness plus browser smoke fixtures for normal, empty, invalid and migration cases.

### DOC-001 P3: Launcher record has drifted
- Evidence: state/review logs say `コマいぬ！を開く.html` exists, but the current root contains `index.html` as the launcher and the named file is absent.
- Repair: choose one official launcher name and align README, state and verification records.

## 6. Quality Gate
| Gate | Result | Reason |
| --- | --- | --- |
| Purpose fit | 合格 | Middle-school timetable generation is clearly represented |
| Target-user fit | 保留 | Guidance is improved, but bulk entry and recovery remain weak |
| Constraint separation | 合格 | H-001-H-012 and S-001-S-007 are separated |
| Hard-constraint verification | 合格 for sample | Three candidates passed; real-school fixture unverified |
| UI understandability | 条件付き | Main four-step flow is clear; destructive actions and bulk work need improvement |
| Input/output | 不合格 | Export exists, but import safety is insufficient |
| Testability | 条件付き | Core can be exercised, but regression tests are not maintained |
| Final quality | 不合格 | P1 findings and missing final requirements remain |

## 7. Recommended Order
1. Protect data: transactional import, schema/version validation, delete confirmation, undo/backup.
2. Complete the timetable officer's loop: move/swap/lock, revalidate, teacher view, room view.
3. Reduce setup work: bulk import/edit, copy templates and batch creation.
4. Make generation responsive: busy state, worker, cancel and progress.
5. Add repeatable regression tests and accessibility checks.
6. Validate with one anonymized realistic school fixture, then conduct an observed usability test with a timetable officer.

## 8. Return Path
- P1 implementation: project `revision` -> `production` after separate approval.
- Domain anomalies after repair: `timetable-validation`.
- Recheck: `app-check` -> project `quality-review`.
