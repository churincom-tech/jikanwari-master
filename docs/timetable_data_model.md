# Timetable Data Model

## 初期エンティティ
| エンティティ | 主な属性 | 備考 |
| --- | --- | --- |
| School | name, days, periods_per_day | 学校基本設定 |
| Grade | id, name | 学年 |
| ClassGroup | id, grade_id, name | クラス |
| Teacher | id, name_or_code, subjects, unavailable_slots | 実データでは匿名コードも可 |
| Subject | id, name, weekly_periods, room_type, rules | 教科 |
| CurriculumProfile | name, hour_check_mode, subjects, hour_groups | 教育課程マスタ。改訂や学校独自教科に対応する裏側設定 |
| SubjectMaster | id, name, weekly_by_grade, default_room_type, default_double_mode, active | 教科名、標準時数、標準教室、2時間続き初期値 |
| CurriculumHourGroup | name, subject_names, weekly_by_grade, active | 技術・家庭のように複数教科を合算して標準時数確認する単位 |
| Room | id, name, room_type, capacity | 特別教室を含む |
| Slot | day, period | 曜日と時限 |
| LessonRequirement | class_id, subject_id, teacher_id, weekly_count, double_mode | 必要授業数。double_mode は none / required / preferred |
| FixedAssignment | slot, class_id, subject_id, teacher_id, room_id | 固定枠 |
| TimetableEntry | slot, class_id, subject_id, teacher_id, room_id, block_id | 生成結果。2時間連続枠は同一 block_id で関連づけ可能 |
| GenerationRequest | school, classes, subjects, teachers, rooms, fixed_assignments, constraints | ユーザー入力をまとめた生成条件 |
| TimetableCandidate | id, entries, hard_violations, soft_score, notes | 生成された候補 |
| ValidationResult | candidate_id, hard_violations, soft_warnings, score_breakdown | 候補ごとの検証結果 |

## 初期データ形式候補
- 画面入力: 初期試作の主入力手段
- JSON: ネストした学校設定や制約を扱いやすい
- CSV: 表計算ソフトから入力しやすい

## 候補生成の最小データ流れ
1. 画面入力を `GenerationRequest` にまとめる
2. ハード制約に明らかな矛盾がないか事前確認する
3. `TimetableCandidate` を1案以上生成する
4. 候補ごとに `ValidationResult` を作る
5. スコア、違反、改善候補と一緒に画面へ表示する

## 注意
教員名を扱う場合は、ユーザー承認なしに外部送信しません。初期検証では匿名コードを推奨します。
