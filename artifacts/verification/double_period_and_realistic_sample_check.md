# Double Period And Realistic Sample Check

## 対象
- `app/scripts/state.js`
- `app/scripts/sample-data.js`
- `app/scripts/validation.js`
- `app/scripts/scoring.js`
- `app/scripts/timetable-core.js`
- `app/scripts/main.js`
- `app/index.html`
- `app/styles.css`

## 実装内容
- 授業設定に `連続授業` を追加した。
  - `通常`
  - `2時間連続必須`
  - `2時間連続が望ましい`
- `2時間連続必須` はハード制約 `H-007` として扱う。
- `2時間連続が望ましい` はソフト制約 `S-007` としてスコア・警告に反映する。
- 2時間連続必須の授業は、生成時に同日隣接2コマをまとめて配置する。
- 入力確認で次を検出する。
  - 週時数が2未満
  - 週時数が奇数
  - 2時間連続で置ける候補枠がない
  - 固定授業で連続2コマの片方だけを固定している
- `まず試す` サンプルを標準授業時数に寄せた中学校例へ変更した。
- `白紙から` ボタンを追加した。

## サンプル方針
文部科学省の中学校学習指導要領にある年間授業時数を、35週目安で整数の週時数へ近似した。

- 1年: 29コマ
- 2年: 29コマ
- 3年: 29コマ
- 1年美術、1・2年技術家庭: 2時間連続必須
- 理科: 2時間連続が望ましい

## 検証
- JS構文確認: 成功。
- script / image 参照確認: 欠落なし。
- 外部通信参照確認: `fetch(`、`XMLHttpRequest`、外部URL、CDN/API関連語の検出なし。
- サンプル生成:
  - 候補3件
  - 全候補ハード制約違反0件
  - 2時間連続必須の授業6件すべてで連続配置を確認
  - スコア: 62, 34, 34
- 不正データ検証:
  - 2時間連続必須で週時数が奇数の場合、入力エラーを検出
  - 2時間連続必須の固定授業を片方だけ固定した場合、入力エラーを検出
- ブラウザ確認:
  - `まず試す` で候補3件表示
  - ハード制約違反なし表示
  - `白紙から` ボタン表示
  - 授業設定72行
  - 連続授業セレクト72件
  - 2時間連続必須6件、2時間連続が望ましい6件
  - コンソールエラー0件

## 画像証跡
- `artifacts/verification/double_period_sample_browser.png`

## 結果
合格。2時間続き授業の必須・任意設定と、実態寄りサンプル、白紙初期化導線を追加できている。

## 2026-06-30 Home Economics Room Follow-up
- Added `家庭科室` to both blank and sample room defaults.
- Split sample `技術・家庭` into `技術・家庭（技術）` / `技術・家庭（家庭）`.
- Latest candidate scores after the split: 58, 34, 32.
- Latest hard violations: 0, 0, 0.
- See `artifacts/verification/home_economics_room_check.md`.
