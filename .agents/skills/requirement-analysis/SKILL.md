---
name: requirement-analysis
description: ユーザー要望を要件、不足情報、仮定、成功条件へ分解するときに使う。承認済み実装だけを進める場面では使わない。
---

# Requirement Analysis

## 目的
ユーザーの要望を、時間割アプリの要件、未確認事項、仮定、成功条件に分解します。

## 発動条件
- 新しい要望や大きな仕様変更が出た
- 何を作るべきかが曖昧
- 成功条件や完了条件を整理する必要がある

## 非発動条件
- すでに承認済みの実装を進めるだけ
- 検証結果のレビューだけ
- 作業環境の改善だけ

## 入力
- ユーザー要望
- `PROJECT_SPEC.md`
- `context/assumptions.md`
- `loops/task_state.md`

## 手順
1. 要望を目的、利用者、対象業務、成果物に分ける
2. 機能要件と非機能要件を分ける
3. ハード制約とソフト制約の候補を抽出する
4. 不足情報を3点以内に優先順位づけする
5. 仮定を `context/assumptions.md` に記録する
6. 成功条件と完了条件を `docs/success_criteria.md` と照合する
7. `loops/task_state.md` を更新する

## 出力
- 更新された要件整理
- 不足情報リスト
- 仮定リスト
- 次工程への確認事項

## 完了条件
- 未確認事項が確定扱いされていない
- 次に収集すべき情報が3点以内で示されている
- 成功条件との関係が説明できる

## 失敗時の処理
要件が大きすぎる場合は最小試作範囲へ戻し、`loops/iteration_log.md` に理由を記録します。

## 更新すべき状態ファイル
- `loops/task_state.md`
- `loops/iteration_log.md`
- `context/assumptions.md`

## 次工程への受け渡し
不足情報が中心なら `context-collection`、概念整理が必要なら `timetable-domain-modeling` へ渡します。
