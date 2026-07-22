---
name: production
description: 承認済み計画に基づいて実装または成果物制作を行うときに使う。未承認の実装開始や要件整理には使わない。
---

# Production

## 目的
承認済みの計画に基づいて、実装または成果物制作を行います。

## 発動条件
- ユーザーが実装または制作開始を承認した
- 試作計画と検証方法がある
- 作業対象が具体的に決まっている

## 非発動条件
- アプリ本体の実装が未承認
- 要件、制約、検証方法が未整理
- 品質ゲートだけを確認する

## 入力
- 承認済み計画
- `docs/prototype_scope.md`
- `docs/evaluation_plan.md`
- `review/quality_gate.md`
- 既存プロジェクトファイル

## 手順
1. 承認済み範囲を確認する
2. 既存プロジェクトの構成に合わせる
3. 小さく実装する
4. 変更後に検証する
5. 失敗を記録する
6. 次の改善候補を残す

## 出力
- 実装または成果物
- 検証結果
- 変更内容の要約
- 残課題

## 完了条件
- 承認済み範囲を超えていない
- 検証が実行されている
- 次工程が明確

## 失敗時の処理
検証不合格なら完成扱いせず、`revision` または `harness-improvement` へ渡します。

## 更新すべき状態ファイル
- `loops/task_state.md`
- `loops/iteration_log.md`
- `review/review_log.md`
- `artifacts/verification/`

## 次工程への受け渡し
生成結果や実装を `timetable-validation` と `quality-review` へ渡します。
