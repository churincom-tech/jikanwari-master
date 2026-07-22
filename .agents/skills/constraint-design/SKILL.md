---
name: constraint-design
description: ハード制約、ソフト制約、評価スコアを設計するときに使う。画面実装やデータ収集だけなら使わない。
---

# Constraint Design

## 目的
時間割生成で必ず守る条件と、できれば守る条件を分離し、評価可能な形にします。

## 発動条件
- 制約一覧を作成または更新する
- ハード制約とソフト制約を分類する
- 評価スコアや違反検出方法を決める

## 非発動条件
- 要件の聞き取りだけ
- UIデザインだけ
- 承認済み実装だけ

## 入力
- `docs/timetable_constraint_catalog.md`
- `docs/evaluation_plan.md`
- `docs/timetable_data_model.md`
- ユーザー提供の条件

## 手順
1. 条件をハード制約とソフト制約に分類する
2. 各制約の検出方法を定義する
3. 失敗時の扱いを決める
4. ソフト制約には評価スコアを設ける
5. ハード制約違反を完成扱いしないルールを確認する
6. `docs/timetable_constraint_catalog.md` を更新する

## 出力
- ハード制約一覧
- ソフト制約一覧
- 評価スコア案
- 検証チェックリストへの反映案

## 完了条件
- 必須条件と改善対象が混ざっていない
- 検出方法がデータモデルと対応している
- 検証可能である

## 失敗時の処理
制約分類が曖昧な場合は、仮分類として記録し、ユーザー確認に回します。

## 更新すべき状態ファイル
- `docs/timetable_constraint_catalog.md`
- `docs/evaluation_plan.md`
- `review/timetable_validation_checklist.md`
- `loops/task_state.md`
- `loops/iteration_log.md`

## 次工程への受け渡し
制約が整理できたら `app-architecture-planning` または `prototype-planning` へ渡します。
