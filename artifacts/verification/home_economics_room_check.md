# Home Economics Room Check

## Scope
- `app/scripts/state.js`
- `app/scripts/sample-data.js`
- `artifacts/verification/home_economics_room_browser.png`

## Change
- Added `家庭科室` to the default blank room list.
- Added `家庭科室` to the sample room list.
- Split the sample `技術・家庭` lessons into:
  - `技術・家庭（技術）` using `技術室`
  - `技術・家庭（家庭）` using `家庭科室`
- Kept the grade 1 and grade 2 technology/home economics entries as required double-period lessons.

## Verification
- JavaScript syntax check passed for all `app/scripts/*.js`.
- Local model check passed:
  - blank room types include `家庭科室`
  - sample room types include `家庭科室`
  - sample home economics lessons: 3
  - sample technology lessons: 3
  - required double-period home economics lessons: 2
  - required double-period technology lessons: 2
  - generated candidates: 3
  - hard violations: 0, 0, 0
  - candidate scores: 58, 34, 32
- Browser check passed at `http://127.0.0.1:8794/`:
  - `まず試す` loaded the sample.
  - `教室` tab showed 7 room rows including `家庭科室` and `技術室`.
  - `授業` data contained `技術・家庭（家庭）` with `家庭科室`.
  - `授業` data contained `技術・家庭（技術）` with `技術室`.
  - console errors: 0
- Blank reset check passed:
  - `白紙から` returned to an empty lesson list.
  - default room rows remained 7.
  - blank room defaults included `美術室`, `技術室`, and `家庭科室`.
