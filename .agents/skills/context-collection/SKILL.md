---
name: context-collection
description: 必要資料と確認事項を3点以内に優先順位づけするときに使う。大量質問や実装作業には使わない。
---

# Context Collection

## 目的
ユーザーに負担をかけず、時間割設計に必要な情報を優先順位つきで集めます。

## 発動条件
- 要件整理後に情報不足が残っている
- 実データまたはサンプル条件が必要
- ユーザーに次の提出資料を案内する

## 非発動条件
- すでに十分なサンプルデータがある
- 技術実装やコード修正だけを行う
- 最終レビューだけを行う

## 入力
- `context/context_collection_guide.md`
- `loops/task_state.md`
- ユーザーから提供された資料

## 手順
1. 既に把握した情報を短く整理する
2. 不足情報を重要度順に並べる
3. 最初に必要な資料を3点以内に絞る
4. 任意であると良い資料を分ける
5. 後回しでよい情報を明示する
6. 個人情報の扱いを確認する
7. `loops/task_state.md` を更新する

## 出力
- ユーザー向けの提出資料リスト
- 不足情報と仮定の更新
- 次の最小アクション

## 完了条件
- 重要情報が3点以内で示されている
- 専門用語を押しつけていない
- 不明点が `context/assumptions.md` に分離されている

## 失敗時の処理
質問が多すぎる場合は、最初の3点へ絞り直して `review/known_failures.md` のKF-002と照合します。

## 更新すべき状態ファイル
- `loops/task_state.md`
- `loops/iteration_log.md`
- `context/assumptions.md`
- `context/asset_ledger.md`

## 次工程への受け渡し
学校条件が集まったら `timetable-domain-modeling` へ渡します。
