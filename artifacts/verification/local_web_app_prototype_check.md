# Local Web App Prototype Check

## 実施日
2026-06-30

## 対象ゴール
入力フォームから時間割候補を生成表示する無料ローカルWebアプリの最小試作を実装する。

## 確認対象
- `app/index.html`
- `app/styles.css`
- `app/scripts/state.js`
- `app/scripts/sample-data.js`
- `app/scripts/validation.js`
- `app/scripts/scoring.js`
- `app/scripts/timetable-core.js`
- `app/scripts/import-export.js`
- `app/scripts/main.js`
- `app/README.md`

## 実装確認
| 要件 | 証跡 | 判定 |
| --- | --- | --- |
| 無料ローカルWebアプリである | 静的HTML/CSS/JSのみ。npm、ビルド、サーバーなし | 合格 |
| 有料APIを使っていない | 外部通信参照検索で該当なし | 合格 |
| 外部API/CDNを使っていない | `http://`、`https://`、`fetch`、`XMLHttpRequest`、CDN参照なし | 合格 |
| 学年、クラス数、曜日、時限数を入力できる | `app/index.html` と `main.js` の学校設定フォーム | 合格 |
| 教科ごとの週時数、担当教員、特別教室を入力できる | 授業設定、教員、教室フォーム | 合格 |
| 固定授業、勤務不可時間、必ず守る条件を入力できる | 固定・制約画面、勤務不可グリッド、ハード制約表示 | 合格 |
| 入力不足や矛盾を候補生成前に表示できる | `validation.js` と条件確認パネル | 合格 |
| 時間割候補を生成できる | サンプルデータで3候補を生成 | 合格 |
| ハード制約違反なし候補を表示できる | サンプル生成候補3件すべてハード制約違反0件 | 合格 |
| 候補ごとのスコア、警告、改善候補を表示できる | 候補比較、時間割グリッド、候補詳細パネル | 合格 |
| JSON保存と読込ができる構成である | `import-export.js` | 合格 |

## 実行した検証

### JavaScript構文とHTML参照
結果:

```json
{
  "syntaxChecked": 7,
  "scriptRefs": 7,
  "missing": []
}
```

### サンプル生成
結果:

```json
{
  "requestErrors": 0,
  "candidates": 3,
  "names": ["候補A", "候補B", "候補C"],
  "hard": [0, 0, 0],
  "scores": [85, 85, 47],
  "entries": [150, 150, 150]
}
```

### 外部通信参照
検索対象:
- `fetch(`
- `XMLHttpRequest`
- `http://`
- `https://`
- `cdn.jsdelivr`
- `unpkg`
- `googleapis`
- `apiKey`
- `openai`
- `axios`

結果: 該当なし。

## 未実施または制限
- この環境ではPATH上にEdge/Chrome/Chromiumがなく、Playwrightも依存不足だったため、ブラウザ画面の自動スクリーンショット検証は未実施。
- 代替として、ローカルJS構文、HTML参照、外部通信参照、サンプル生成、ハード制約検証を実施済み。

## 結論
無料ローカルWebアプリの最小試作は実装済みです。`app/index.html` をブラウザで開くことで、入力フォーム、条件確認、候補生成、候補表示、JSON保存/読込を試せます。
