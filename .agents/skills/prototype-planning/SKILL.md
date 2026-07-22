---
name: prototype-planning
description: 最小試作範囲、サンプルデータ、検証方法を決めるときに使う。承認済みの本実装作業だけなら使わない。
---

# Prototype Planning

## 目的
実装前に、最小試作で何を作り、何で検証するかを明確にします。

## 発動条件
- MVPや最小試作の範囲を決める
- サンプルデータを設計する
- 検証方法と合格条件を決める

## 非発動条件
- まだ要件や制約が整理されていない
- すでに承認済みの実装を進めるだけ
- 最終納品レビューだけ

## 入力
- `docs/prototype_scope.md`
- `docs/evaluation_plan.md`
- `docs/timetable_constraint_catalog.md`
- `artifacts/sample_data/`

## 手順
1. 最小試作の対象機能を決める
2. 後続に回す機能を明示する
3. サンプルデータの規模と形式を決める
4. ハード制約の検証方法を定義する
5. ソフト制約スコアの初期案を決める
6. 実装開始前の承認事項を整理する

## 出力
- 試作スコープ
- サンプルデータ設計
- 検証計画
- 実装前チェックリスト

## 完了条件
- 試作の完了条件が明確
- サンプルデータで再現可能
- 実装開始前の承認事項が分かる

## 失敗時の処理
スコープが広がりすぎた場合は、ハード制約検証に必要な最小機能へ戻します。

## 更新すべき状態ファイル
- `docs/prototype_scope.md`
- `docs/evaluation_plan.md`
- `loops/task_state.md`
- `loops/iteration_log.md`
- `loops/improvement_backlog.md`

## 次工程への受け渡し
ユーザー承認後、`production` へ渡します。
