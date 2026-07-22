---
name: harness-improvement
description: 失敗や改善点を作業環境に限定して反映するときに使う。アプリ仕様や成功条件の大幅変更には使わない。
---

# Harness Improvement

## 目的
失敗や改善点を、AGENTS、Skill、品質ゲート、ログなどの作業環境へ限定的に反映します。

## 発動条件
- 同じ失敗の再発を防ぎたい
- 品質ゲートやSkillに不足がある
- 作業ログや回復手順を改善する必要がある

## 非発動条件
- アプリ仕様や成功条件を大きく変える
- 制約を緩和する
- 実装作業だけを行う
- ユーザー承認が必要な重要変更

## 入力
- 失敗内容
- レビュー結果
- `review/known_failures.md`
- `review/quality_gate.md`
- 対象Skill

## 手順
1. 何を防ぐ改善か明確にする
2. 影響範囲を確認する
3. 更新可能なファイルか確認する
4. 最小限の変更を行う
5. 何を変えたか、理由、防ぐ失敗を記録する
6. `loops/improvement_backlog.md` を更新する

## 出力
- 更新された作業環境ファイル
- 改善理由
- 防ぐ失敗
- 次回確認事項

## 完了条件
- 作業環境への限定改善である
- 重要方針変更ではない
- 変更理由が記録されている

## 失敗時の処理
改善範囲が大きい場合は実行せず、ユーザー承認が必要な判断として `workflows/approval_flow.md` に戻します。

## 更新すべき状態ファイル
- `loops/improvement_backlog.md`
- `loops/iteration_log.md`
- `review/known_failures.md`
- `review/quality_gate.md`
- 必要な各Skill

## 次工程への受け渡し
改善後は、元の作業ループに戻し、再発防止が効いているか `quality-review` で確認します。
