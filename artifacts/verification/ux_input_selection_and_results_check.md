# UX Input Selection And Results Check

## Scope
- `app/index.html`
- `app/styles.css`
- `app/scripts/main.js`
- `app/scripts/validation.js`
- `app/scripts/timetable-core.js`

## Changes
- Replaced left guide wording with `作成ガイド`, `学校情報`, `授業情報`, `条件設定`, `候補作成`, and `結果確認`.
- Added school input helpers:
  - period preset buttons
  - day selection buttons
  - class-count cards
  - school summary
- Added lesson input helpers:
  - `中学校の標準例を使う` button
  - subject suggestions
  - lesson card layout
  - `通常 / できれば連続 / 必ず連続` buttons for double-period lessons
- Added condition-setting helpers:
  - fixed-lesson board
  - click a timetable cell to add or remove a fixed lesson
  - teacher unavailable slots are real buttons
- Added result helpers:
  - `1クラス` / `全クラス一覧` view switch
  - `印刷 / PDF` action
  - print stylesheet focused on all-class timetables

## Verification
- JavaScript syntax check passed for all app scripts.
- Sample candidate generation passed:
  - candidates: 3
  - hard violations: 0, 0, 0
  - scores: 58, 34, 32
- Browser check passed at `http://127.0.0.1:8796/`:
  - guide title: `まずは学校情報を入力します`
  - old visible terms removed: `今日の作業`, `入力を確認`, `学校設定`, `授業設定`, `制約確認`, `候補生成`
  - validation ok message: `候補作成に進めます。`
  - day buttons: 6
  - period preset buttons: 3
  - school summary: visible
  - lesson cards: 72
  - double-period segment buttons: 216
  - fixed board click added a fixed slot
  - all-class result tables: 6
  - candidate cards: 3
  - print/PDF button: visible
  - console errors: 0

## Screenshot
- `artifacts/verification/ux_input_selection_results_final.png`
