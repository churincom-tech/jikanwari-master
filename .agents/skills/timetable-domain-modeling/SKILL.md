---
name: timetable-domain-modeling
description: 学校、学年、クラス、教員、教科、教室、時限、固定枠の概念整理をするときに使う。制約スコア設計だけなら使わない。
---

# Timetable Domain Modeling

## 目的
中学校時間割業務の概念を整理し、データモデルと画面設計の土台を作ります。

## 発動条件
- 学校条件や教員、教科、教室の情報を整理する
- サンプルデータの構造を決める
- 概念の抜け漏れを確認する

## 非発動条件
- 既にデータモデルが確定している
- 制約評価の計算だけを設計する
- 実装作業だけを行う

## 入力
- `docs/timetable_data_model.md`
- `context/timetable_domain_notes.md`
- 提供された学校条件

## 手順
1. 学校、学年、クラス、教員、教科、教室、時限、固定枠を洗い出す
2. 各概念の属性を定義する
3. 関係性を整理する
4. 必要なサンプルデータ項目を決める
5. 実データでは匿名コードが使えるようにする
6. `docs/timetable_data_model.md` を更新する

## 出力
- 更新されたデータモデル
- サンプルデータ項目一覧
- 未確認の業務ルール

## 完了条件
- 制約チェックに必要な属性が揃っている
- 個人情報の扱いが明示されている
- 次に制約設計へ渡せる

## 失敗時の処理
概念が増えすぎた場合は、最小試作に必要なものと後続候補へ分けます。

## 更新すべき状態ファイル
- `docs/timetable_data_model.md`
- `context/timetable_domain_notes.md`
- `loops/task_state.md`
- `loops/iteration_log.md`

## 次工程への受け渡し
データモデルが整ったら `constraint-design` へ渡します。
