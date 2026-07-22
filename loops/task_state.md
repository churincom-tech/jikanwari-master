# Task State

## 現在フェーズ
ページ遷移・開始方法UIの修正・検証完了

## 最終目的
中学校の教務担当者、管理職、時間割作成担当者が使える時間割自動作成Webアプリを、要件整理、設計、試作、評価、改善を経て作る。

## 作業対象
入力フォームから時間割候補を生成表示する無料ローカルWebアプリ。現在は、4段階ナビ、条件グリッド、3段階メッセージ、固定下部操作を備えた統合UI。

## 入力済み資料
- `C:\Users\nakab\Downloads\codex_timetable_agent_prompt.md`
- ユーザー要望: 学年・クラス数・曜日・時限数、教科ごとの週時数・担当教員・特別教室、固定授業・勤務不可時間・必ず守りたい条件を入力し、時間割候補を表示するアプリを目指す
- ユーザー方針: 有料APIは使用せず、完全無料のローカルWebアプリとして開発する
- ユーザー方針: 操作感をもっと直感的にし、中学校に適した雰囲気にする。ImageGen素材を利用する

## 不足情報
- 実際に最初の試作で使う学校規模の最終確認
- 初期表示する候補数の最終確認
- 入力を手入力中心にするか、CSV/JSON併用にするかの最終確認

## 仮定
- 日本の一般的な中学校
- 週5日、1日6時限
- まず1週間分の標準時間割
- 初期試作では認証や複数校管理は後回し
- 最小試作では最大3案の候補表示を初期案にする
- 最小試作では画面手入力を主、JSON保存を補助にする
- 技術スタックはHTML/CSS/Vanilla JavaScriptの静的ローカルWebアプリとする
- 有料API、外部API、外部CDNは使わない

## 直近判断
既存のHTML/CSS/Vanilla JavaScript構成と機能を維持し、画面を「学校情報 -> 授業情報 -> 条件設定 -> 結果確認」の4段階へ統合した。条件設定は表クリックを主操作、警告は作成停止・確認・改善の3段階、次操作は固定下部バーに集約する。学校別に異なる開始・終了時刻は生成に使わないため表示せず、行名は1限〜n限だけにする。

## 品質状態
代表シナリオで3候補を生成し、全候補174コマ、ハード制約違反0件を確認済み。H-001〜H-013とS-001〜S-007、JSON安全性14/14、代表受入6/6が合格。Chromeで4段階移動、固定追加解除、3段階警告、候補表示、390px表示、コンソールエラー0を確認済み。実学校データ、結果の手修正、教員別・教室別表示、最終承認は未完了。

## ブロッカー
- 実学校データまたは具体的なサンプル条件が未提供

## 次の最小アクション
今回のページ遷移・開始方法の修正をユーザーに再確認してもらう。次の機能実装候補は、生成後の時間割を現場で調整できる手修正と変更履歴であり、別スコープとして承認を得てから進める。

## 反復回数
| ループ | 回数 |
| --- | --- |
| コンテキスト収集 | 0 |
| 設計 | 3 |
| 試作 | 1 |
| 実装 | 5 |
| レビュー・修正 | 5 |
| ハーネス改善 | 0 |
## 2026-07-02 State Update
| Item | Content |
| --- | --- |
| Current phase | Timetable validity and result readability revision complete |
| Work | Added hard constraint `H-008` for no middle gaps, adjusted generation to avoid class/day gaps, fixed timetable column layout, and shortened long technology/home economics labels inside result cells. |
| Verification | Syntax passed. Standard sample generated 3 valid candidates with no middle gaps. Browser check passed at `http://127.0.0.1:8797/`; single and all-class day columns had 0px width delta and console errors 0. |
| Next action | Continue improving real-school constraints such as grade/term hour allocation, manual adjustment, CSV/PDF export polish, or teacher/room-specific result views. |

## 2026-07-02 State Update 2
| Item | Content |
| --- | --- |
| Current phase | Fixed conditions UX and curriculum master revision complete |
| Work | Reworked condition setting into a class/lesson/grid-click flow, moved manual fixed-list editing and constraint details into collapsed sections, enforced fixed-assignment weekly-count limits, separated `技術` and `家庭科`, added curriculum master adjustment, and updated the app identity to `コマいぬ`. |
| Verification | Syntax passed. Standard sample generated 3 valid candidates with hard violations 0, 0, 0 and middle gaps 0, 0, 0. Artificial fixed overflow was rejected. Browser check passed at `http://127.0.0.1:8799/` with console errors 0. |
| Next action | Confirm whether the new condition-setting flow feels intuitive, then continue simplifying teacher availability and lesson-entry workflows. |

## 2026-07-02 State Update 3
| Item | Content |
| --- | --- |
| Current phase | Balanced timetable shape and sample result revision complete |
| Work | Updated the active project path to `C:\Users\nakab\Documents\時間割作成アプリ`. Changed the header sample action to `時間割サンプル例`. Revised generation so each class/day fills from 1st period, stays within balanced daily lengths, and reserves required 2-period lessons before ordinary lessons. Added `H-010` for natural daily load balancing. Confirmed all-class result view is present and working. |
| Verification | Syntax passed for `timetable-core.js`, `state.js`, `main.js`, and `sample-data.js`. Standard sample generated 3 candidates with 174 entries each, hard violations 0, table-shape issues 0. Browser check passed at `http://127.0.0.1:8801/`: all-class view showed 6 tables, DOM table-shape issues 0, console errors 0. |
| Next action | Consider a future annual-hours/alternate-week model so 45-hour and 50-hour annual subjects can be represented more exactly than a single 35-week representative timetable. |

## 2026-07-02 State Update 4
| Item | Content |
| --- | --- |
| Current phase | Double-period sample and editable sample workflow revision complete |
| Work | Adjusted the sample so grade 1/2 `技術・家庭` appears as class-specific 2-period `技術` or `家庭科` blocks while preserving combined standard hours. Strengthened preferred adjacent placement for `理科` and `保体`. Added result-view regeneration guidance after sample edits, and made weekly-count edits invalidate stale candidates immediately. |
| Verification | Syntax passed for changed scripts. Standard sample generated 3 candidates with hard violations 0 and shape issues 0. Browser all-class view detected 21 adjacent pairs among `美術`, `技術`, `家庭科`, `理科`, and `保体`; editing a sample lesson showed `この条件で作り直す`, and inline regeneration produced 3 candidates. Console errors 0. |
| Next action | Add a real annual-hours / alternating-week model if the user wants exact handling of 35-hour and 45-hour subjects as every-other-week 2-period blocks. |

## 2026-07-02 State Update 5
| Item | Content |
| --- | --- |
| Current phase | Lunch-break and double-period realism revision complete |
| Work | Removed double-period treatment from `理科` and `保体`. Added hard constraints `H-011` for no double-period crossing between 4th and 5th periods, and `H-012` for no adjacent placement when a lesson is not configured as double-period. Updated generation, candidate validation, sample/default curriculum, and constraint catalog. |
| Verification | Syntax passed for changed scripts. Standard sample generated 3 candidates with hard violations 0, table-shape issues 0, `理科/保体` adjacent pairs 0, and 4-5 crossing pairs 0. Browser all-class view showed 6 tables and console errors 0. |
| Next action | If needed, expose lunch-break position as a school setting instead of hardcoding the default break after 4th period. |

## 2026-07-02 State Update 6
| Item | Content |
| --- | --- |
| Current phase | Navigation and input UX revision complete |
| Work | Normalized left navigation so numbered items are screen destinations, moved the generate action between condition setting and results, revised school information inputs and wording, changed lesson-row continuous-placement UI to `配置ルール`, updated the header to `時間割作成サポートアプリ / コマいぬ！`, reordered header actions, removed duplicate banner label/art, and added `コマいぬ！を開く.html` in the project root. |
| Verification | Syntax passed for changed scripts. Standard sample generated 3 candidates with hard violations 0, 0, 0. Browser check passed at `http://127.0.0.1:8804/` with console errors 0. |
| Next action | Confirm whether the new root launcher and simplified input UI feel easier in Explorer and the browser. Existing copy files in `app` remain untouched until deletion is explicitly requested. |

## 2026-07-17 State Update
| Item | Content |
| --- | --- |
| Current phase | Existing app reassessment complete; P1 revision awaits approval |
| Work | Reviewed program structure, input/data safety, timetable generation, hard constraints, usability, accessibility, regression coverage, and requirement fit. No app source files were changed. |
| Verification | JavaScript syntax passed. Standard sample generated 3 candidates of 174 entries with hard violations 0, 0, 0. Empty/odd-double/fixed-overflow/missing-entry/middle-gap cases were detected. All local assets returned HTTP 200. |
| Blockers | Current live browser interaction could not be rechecked because the browser-control runtime failed outside the app. Real-school data is still unavailable. P1 import/delete safety and final workflow gaps remain. |
| Next action | Obtain separate approval for a targeted `revision -> production` pass beginning with transactional import and destructive-action protection. |

## 2026-07-17 Safety Revision Start
| Item | Content |
| --- | --- |
| Current phase | Approved safety revision in progress |
| Approved scope | Import schema/version validation, import preview and confirmation, rollback/undo, teacher and lesson deletion impact confirmation, and repeatable safety regression tests |
| Non-goals | Manual timetable editing, teacher/room result views, bulk input, generation architecture, and unrelated visual changes |
| Verification plan | Syntax, pure state safety tests, import compatibility/error cases, sample generation, H-001-H-012 regression, and browser smoke when the browser runtime is available |
| Next action | Implement transactional import inspection before changing current state. |

## 2026-07-17 Safety Revision Complete
| Item | Content |
| --- | --- |
| Current phase | Approved data-safety revision complete; overall app finalization remains open |
| Work | Added strict JSON app/version/schema checks, preview confirmation, transactional rollback, candidate revalidation, teacher/lesson deletion impact confirmation, and one-level Undo. Added a zero-dependency safety regression suite. |
| Verification | All 8 app scripts passed syntax checks. Safety suite passed 14/14. Standard sample kept 3 candidates x 174 entries with hard violations 0. Headless Chrome passed teacher delete/Undo, lesson delete/Undo, import preview/Undo, invalid import state preservation, and reported console/page errors 0. |
| Quality gate | Approved safety scope passed and KF-016 is controlled. Overall final-quality gate remains open because real-school acceptance, manual result correction, teacher/room views, and final completion approval remain. |
| Blockers | No blocker for the safety revision. Real-school data or an approved representative acceptance scenario is still required for final-use confidence. |
| Next action | Run a real-school acceptance scenario next; use its evidence to prioritize manual correction and teacher/room result workflows before further feature expansion. |

## 2026-07-17 Representative School Acceptance Start
| Item | Content |
| --- | --- |
| Current phase | Representative school acceptance validation in progress |
| Scope | Existing 3 grades x 2 classes, 5 days x 6 periods sample plus feasible fixed lessons and teacher-unavailable constraints; deliberate infeasible cases for blocking diagnostics |
| Evidence boundary | This is a reproducible representative scenario based on project assumptions, not evidence from an actual school |
| Non-goals | App feature implementation, constraint relaxation, and final-use approval |
| Next action | Inventory the sample workload and construct feasible and infeasible acceptance cases. |

## 2026-07-17 Representative School Acceptance Complete
| Item | Content |
| --- | --- |
| Current phase | Representative acceptance complete; hard constraints passed, soft-scoring gaps await approval |
| Evidence boundary | Project-assumption scenario only; no actual-school data was used |
| Work | Added a reusable standard/constrained/invalid acceptance suite, independently audited fixed lessons, unavailable slots, daily load, major-subject afternoon ratio, and part-time attendance days, and aligned the validation checklist with H-001-H-012 and S-001-S-007. |
| Verification | Safety 14/14, representative acceptance 6/6, all app/test script syntax passed. Standard scores 80/69/55; constrained scores 73/70/64; all candidates 174 entries and hard violations 0. |
| Findings | S-001 and S-005 are not connected to app scoring. H-010 uses one ID for natural daily load in generation and out-of-school slots in candidate validation. Standard sample does not exercise S-007 without the dedicated probe. |
| Revision status | Test/report/checklist/backlog/known-failure updates completed. App implementation was not changed because the newly identified scoring/diagnostic revision requires approval. |
| Next action | Request approval for a focused S-001 + S-005 + H-010 revision, then rerun both suites and current browser smoke. |

## 2026-07-17 Scoring And H-010 Revision Start
| Item | Content |
| --- | --- |
| Current phase | Approved focused revision in progress |
| Approved scope | S-001 major-subject bias scoring, S-005 part-time attendance-day scoring, H-010 daily-target validation responsibility, related warnings and regression tests |
| Integration requirement | Existing soft-constraint enable switches must control the new and existing scoring items; invalid school day/period receives a distinct hard-constraint ID |
| Non-goals | Manual result editing, teacher/room result screens, bulk entry, generation architecture replacement |
| Verification plan | Syntax, scoring probes, H-001-H-013 probes, safety 14/14, representative acceptance, browser score/warning smoke |

## 2026-07-17 Scoring And H-010 Revision Complete
| Item | Content |
| --- | --- |
| Current phase | Approved focused scoring and daily-target revision complete; overall app finalization remains open |
| Work | Added S-001 major-subject weekday/afternoon bias scoring and S-005 part-time attendance-day scoring. Connected all S-001-S-007 switches to scoring. Shared class/day targets between generation and validation, kept H-010 for daily targets, and added H-013 for invalid school days/periods. Prioritized the new operational warnings in candidate details. |
| Verification | Syntax passed. Safety regression 14/14 and representative acceptance 6/6 passed. Baseline and constrained scenarios each produced 3 x 174-entry candidates with hard violations 0. H-001-H-013 and S-001-S-007 coverage passed. Browser score/warning/toggle smoke passed with console/page errors 0. |
| Quality gate | Approved scope passed and KF-017 is controlled by the full-ID acceptance suite. Overall final-quality gate remains open because actual-school validation, result manual correction, teacher/room views, and final approval remain. |
| Evidence boundary | Tests use the project representative scenario, not actual-school data. |
| Blockers | No blocker for the approved revision. |
| Next action | Seek separate approval for result manual correction and change history, or validate with actual-school data when available. |

## 2026-07-18 Integrated UI Redesign Start
| Item | Content |
| --- | --- |
| Current phase | Approved integrated UI redesign in progress |
| Approved target | Guided four-step flow + usable fixed-slot grid + three-level actionable messages, based on the selected generated visual |
| Time-label decision | Do not show fixed clock times under period labels. Keep only 1限〜n限 because start/end times vary by school and are not generation inputs. |
| Preserved behavior | Existing school/teacher/room/lesson input, fixed assignments, generation, validation, scoring, JSON safety, Undo, all-class view, and print |
| Verification plan | Syntax, safety 14/14, representative acceptance 6/6, browser flow, keyboard labels, desktop/mobile layout, console errors, and source-vs-implementation design QA |

## 2026-07-18 Integrated UI Redesign Complete
| Item | Content |
| --- | --- |
| Current phase | Approved integrated UI redesign implemented and verified |
| Work | Replaced the left rail with a horizontal four-stage path, added the fixed bottom action bar, built the condition workbench with three-level actionable review, and grouped result messages consistently. |
| Period labels | Only `1限` through `n限` are shown. School-specific clock times were intentionally removed because they are not generator inputs. |
| Verification | Syntax passed; safety 14/14; representative acceptance 6/6; baseline 3 x 174 entries with hard violations 0; Chrome desktop/mobile core flow passed with console/page errors 0. |
| Design QA | Passed with source and implementation captured at the same condition-setting state and viewport. No unresolved P0-P2 finding in the approved UI scope. |
| Evidence | `design-qa.md` and `artifacts/verification/integrated_ui_redesign_2026-07-18.md` |
| Carryover | Actual-school validation, manual result correction/change history, teacher/room result views, and final whole-product approval. |
## 2026-07-18 Navigation And Start-Method Revision Start
| Item | Content |
| --- | --- |
| Trigger | User reported that the next screen inherits the previous screen's bottom scroll position and that blank start is hidden under the Other menu while sample data appears first. |
| Approved scope | Reset scroll to the page top on screen change; expose blank start in the header; move sample loading into a visible how-to/sample section on the School screen. |
| Data-safety decision | Preserve automatic restoration of the last local input. Fresh storage still starts blank; restored data is never discarded without confirmation. |
| Verification plan | Syntax, blank/restored/sample states, scroll reset from page bottom, sample and reset actions, desktop/mobile layout, console errors, safety 14/14, representative acceptance 6/6. |
## 2026-07-18 Navigation And Start-Method Revision Complete
| Item | Content |
| --- | --- |
| Current phase | User-reported navigation/start-method issues corrected and verified |
| Work | Reset screen transitions to top, exposed `白紙から` in the header, removed the Other menu, moved sample loading into the open how-to section, protected sample replacement, and delayed blocking banners until Conditions/Results. |
| Data behavior | Fresh storage is blank. Previous input continues to restore automatically; reset and replacement remain confirmation-protected. |
| Verification | Chrome measured 666px -> 0px on Next, verified blank/restore/sample/cancel/reset states, mobile sample visibility, no page overflow, and console/page errors 0. Syntax 8/8, safety 14/14, acceptance 6/6 passed. |
| Evidence | `artifacts/verification/navigation_start_feedback_2026-07-18.md` |
| Carryover | User feel check, actual-school validation, manual correction/history, and teacher/room result views. |