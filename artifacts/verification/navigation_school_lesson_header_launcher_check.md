# Navigation, School Input, Lesson Rule, Header, And Launcher Check

## Scope
- `app/index.html`
- `app/styles.css`
- `app/scripts/main.js`
- `app/scripts/validation.js`
- `コマいぬ！を開く.html`

## Changes Checked
- Header brand changed to `時間割作成サポートアプリ / コマいぬ！`.
- Header actions reordered to `白紙から始める`, `時間割サンプル例`, `保存`, `読込`.
- Left navigation now uses numbered items for screen navigation only, with the generate action placed between condition setting and results.
- Workspace banner no longer shows the duplicate app label or right-side illustration.
- School information inputs now use clearer grouping:
  - `時間割を設定する曜日`
  - `最大時限数` as a select
  - `学年数` as a select
  - removed the old quick period-only preset section.
- Lesson rows changed from segmented `2時間続き` buttons to a cleaner `配置ルール` select.
- Added root launcher file `コマいぬ！を開く.html`.

## Automated Checks
- Syntax checks passed:
  - `app/scripts/main.js`
  - `app/scripts/validation.js`
  - `app/scripts/timetable-core.js`
  - `app/scripts/state.js`
- Standard sample generation:
  - candidates: 3
  - hard violations: 0, 0, 0
- Ordinary subject adjacent fixed test:
  - candidates: 0
  - first blocking reason: `1年1組 国語 は2時間続き設定ではないため連続配置できません。`

## Browser Checks
Checked with local server `http://127.0.0.1:8804/`.

- Page title: `コマいぬ！`
- Header brand: `コマいぬ！`
- Header eyebrow: `時間割作成サポートアプリ`
- Header buttons: `白紙から始める`, `時間割サンプル例`, `保存`, `読込`
- Workspace banner app-label count: 0
- Workspace banner image count: 0
- School controls:
  - `最大時限数`: `SELECT`
  - `学年数`: `SELECT`
  - day section title: `時間割を設定する曜日`
  - old quick settings count: 0
- Left navigation:
  - step 1: `学校情報`
  - step 2: `授業情報`
  - step 3: `条件設定`
  - generate action index: 3
  - result step index: 4
- Lesson settings after sample load:
  - active panel: `tab-lessons`
  - visible `2時間続き` labels in lesson rows: 0
  - placement rule selects present
  - segmented controls: 0
  - first placement rule options: `通常`, `連続を優先`, `連続必須`
- Browser console errors: 0

## Notes
- Existing copied files under `app` were not deleted because the user has not explicitly requested deletion.
