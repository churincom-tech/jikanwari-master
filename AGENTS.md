# Project Agent Guide

## 基本役割
このプロジェクトは、中学校の時間割自動作成Webアプリを最終的に設計、試作、評価、改善するための作業環境です。Codexはアプリ本体へすぐ入らず、要件、制約、検証、改善ログを整えてから進めます。

## 最初に読むファイル
1. `START_HERE.md`
2. `PROJECT_SPEC.md`
3. `loops/task_state.md`
4. `review/quality_gate.md`
5. 必要に応じて `.agents/skills/*/SKILL.md`

## 作業順序
State -> Plan -> Act -> Verify -> Reflect -> Update Harness -> Next Action の順で進めます。各工程の詳細は `loops/loop_policy.md` と `workflows/` を参照します。

## 禁止事項
- 最終アプリ本体の実装へ未承認で入らない
- ハード制約違反のある時間割を完成扱いしない
- 不明点を確定事項として扱わない
- 検証なしに完成扱いしない
- nested Codex起動、外部送信、秘密情報利用を無承認で行わない
- 既存ファイル削除、重要方針変更、成功条件の大幅変更を無承認で行わない

## 品質ゲート
重要な成果物は `review/quality_gate.md` を通過させます。レビュー結果は `review/review_log.md` に残し、再発しそうな失敗は `review/known_failures.md` に追加します。

## 状態更新
作業開始時と完了時に `loops/task_state.md` を更新します。実行内容、検証結果、持ち越しは `loops/iteration_log.md` に記録します。

## 不明点の扱い
未確認の前提は `context/assumptions.md` に分離します。重要判断はユーザー確認に回し、進められる部分だけ仮定つきで進めます。

## ユーザー承認が必要な場面
実装開始、技術スタック確定、制約緩和、成功条件変更、外部送信、秘密情報利用、最終確定、重要ファイルの大規模上書きにはユーザー承認が必要です。

## 認識確認
ファイル作成後は、`artifacts/verification/recognition_check.md` にAGENTS.mdとSkillの確認結果を記録します。
