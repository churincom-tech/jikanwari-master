# Recovery Flow

## 目的
失敗、矛盾、検証不合格を隠さず、再発防止へつなげます。

## 手順
1. 失敗内容を特定する
2. 影響範囲を確認する
3. `review/known_failures.md` に該当があるか確認する
4. 修正案を作る
5. 必要なら `review/quality_gate.md` またはSkillを更新する
6. `loops/iteration_log.md` に結果を記録する

## 扱う失敗例
- ハード制約とソフト制約の混同
- 未確認事項の断定
- 検証前の完成扱い
- サンプルデータ不足
- UIで違反理由が分からない
