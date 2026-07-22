---
name: quality-review
description: quality_gate.mdに基づいて成果物をレビューするときに使う。新規実装や要件収集だけなら使わない。
---

# Quality Review

## 目的
成果物が目的、制約、成功条件、検証可能性を満たしているか確認します。

## 発動条件
- 設計、試作、実装、検証結果をレビューする
- 完了扱いできるか判定する
- 既知失敗の再発を確認する

## 非発動条件
- 成果物がまだない
- 要件の聞き取りだけ
- 承認済み実装だけを進める

## 入力
- `review/quality_gate.md`
- `review/known_failures.md`
- 対象成果物
- 検証結果

## 手順
1. 品質ゲートの各項目を確認する
2. 既知失敗の再発を確認する
3. 不合格項目を具体的に記録する
4. 修正方針を示す
5. `review/review_log.md` を更新する

## 出力
- レビュー結果
- 不合格項目
- 修正方針
- 完了可否

## 完了条件
- 合格、不合格、保留が明確
- 不合格時の次アクションがある
- 完成扱いの根拠が検証結果に基づく

## 失敗時の処理
レビュー基準が足りない場合は、`harness-improvement` に回して品質ゲートを補強します。

## 更新すべき状態ファイル
- `review/review_log.md`
- `loops/task_state.md`
- `loops/iteration_log.md`
- `review/known_failures.md`

## 次工程への受け渡し
不合格なら `revision`、基準不足なら `harness-improvement` へ渡します。
