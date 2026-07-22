# Fixed Conditions UX And Curriculum Check

Date: 2026-07-02

## Scope
- `app/index.html`
- `app/styles.css`
- `app/scripts/main.js`
- `app/scripts/state.js`
- `app/scripts/sample-data.js`
- `app/scripts/validation.js`
- `docs/timetable_constraint_catalog.md`
- `docs/timetable_data_model.md`
- `review/timetable_validation_checklist.md`

## User Issues Covered
- 条件設定の操作が直感的でない
- 固定授業を授業情報の週時数より多く置けてしまう
- 技術と家庭科を分けつつ、将来の教育課程変更にも対応したい
- アプリ名を `コマいぬ` にしたい

## Implementation Checks
- 条件設定の主操作を `クラスを選ぶ -> 授業を選ぶ -> 表のマスをクリック` に整理した。
- 固定授業の一覧編集とハード/ソフト条件一覧を折りたたみへ移した。
- 選択中授業の `固定済み x/y` と残り固定コマを表示した。
- 週時数を超える固定授業は、画面選択肢、表クリック、事前検証で止めるようにした。
- 教育課程マスタに `技術` と `家庭科` を分離して保持し、必要時は `技術・家庭` の合算チェックもできるようにした。
- アプリ名とfaviconを `コマいぬ` に更新した。

## Automated Verification
- JavaScript syntax check passed for all app scripts.
- Standard sample generated 3 candidates.
- Candidate hard violations: `0, 0, 0`.
- Middle-gap violations: `0, 0, 0`.
- Sample includes both `技術` and `家庭科`.
- Old labels like `技術・家庭（技術）` / `技術・家庭（家庭）` are not present in sample lessons.
- Artificial fixed overflow is rejected with a weekly-count error.

## Browser Verification
Checked at `http://127.0.0.1:8799/` using local Chrome.

- Page title and heading are `コマいぬ`.
- 条件設定のガイドボタン is `この条件で時間割を作る`.
- 主操作 heading is `固定授業を表で入れる`.
- Fixed status shows `固定済み 0/4` for the selected sample lesson.
- Fixed hint explains the remaining slots.
- `固定授業を一覧で細かく編集` is collapsed by default.
- `守る条件の詳細を開く` is collapsed by default.
- Fixed lesson table is hidden until the detail section is opened.
- A full `学活（固定 1/1）` option is disabled.
- Horizontal overflow delta is `0`.
- Console errors: `0`.

## Mobile Verification
Checked at `390 x 844`.

- Horizontal overflow delta is `0`.
- Manual fixed-list editing is collapsed by default.
- Constraint details are collapsed by default.
- Console errors: `0`.

## Result
Passed. The condition-setting screen now emphasizes the primary table-click workflow and prevents fixed assignments from exceeding the registered weekly count.
