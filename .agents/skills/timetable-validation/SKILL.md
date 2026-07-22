---
name: timetable-validation
description: 生成された時間割の制約違反、スコア、偏り、実用性を検証するときに使う。要件整理だけなら使わない。
---

# Timetable Validation

## 目的
生成された時間割がハード制約を満たし、ソフト制約の状態を説明できるか検証します。

## 発動条件
- 時間割生成結果がある
- サンプルデータで検証する
- 制約違反やスコアを確認する

## 非発動条件
- まだ生成結果がない
- データモデルだけを設計する
- UIだけをレビューする

## 入力
- 生成された時間割
- `docs/timetable_constraint_catalog.md`
- `review/timetable_validation_checklist.md`
- サンプルデータ

## 手順
1. 入力データの妥当性を確認する
2. ハード制約を全件検証する
3. ソフト制約スコアを計算または確認する
4. 違反、偏り、改善候補を一覧化する
5. 検証結果を `artifacts/verification/` に保存する
6. 不合格なら `revision` へ渡す

## 出力
- 制約違反一覧
- スコアまたは評価コメント
- 改善候補
- 検証ログ

## 完了条件
- ハード制約違反が0件、または不合格として明示されている
- ソフト制約の状態が説明されている
- 再現可能な検証結果が残っている

## 失敗時の処理
検証不能な場合は、必要なサンプルデータまたは検証観点を `loops/improvement_backlog.md` に追加します。

## 更新すべき状態ファイル
- `artifacts/verification/`
- `loops/task_state.md`
- `loops/iteration_log.md`
- `loops/improvement_backlog.md`

## 次工程への受け渡し
合格なら `quality-review`、不合格なら `revision` へ渡します。
