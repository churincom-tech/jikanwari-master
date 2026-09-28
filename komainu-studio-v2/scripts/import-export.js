(function (global) {
  const App = global.TimetableApp = global.TimetableApp || {};
  const APP_ID = "komainu-studio-v2";
  const LEGACY_APP_IDS = ["local-timetable-prototype", "komainu-studio"];
  const CURRENT_VERSION = 5;
  const SUPPORTED_VERSIONS = [1, 2, 3, 4, 5];
  const STORAGE_KEY = `${APP_ID}-state`;
  let recoveryRaw = null;

  function exportJson(state) {
    const payload = {
      exportedAt: new Date().toISOString(),
      app: APP_ID,
      version: CURRENT_VERSION,
      state
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `komainu-studio-v2-${dateStamp()}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function importJson(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const parsed = JSON.parse(reader.result);
          resolve(inspectImportPayload(parsed));
        } catch (error) {
          reject(normalizeImportError(error));
        }
      };
      reader.onerror = () => reject(importError("FILE_READ_ERROR", "ファイルを読み取れませんでした。"));
      reader.readAsText(file);
    });
  }

  function inspectImportPayload(parsed, options = {}) {
    if (!isPlainObject(parsed)) {
      throw importError("INVALID_ROOT", "JSONの最上位はオブジェクトである必要があります。");
    }

    const warnings = [];
    const hasEnvelope = Object.prototype.hasOwnProperty.call(parsed, "state");
    let source;
    let version;
    let legacy = false;

    if (hasEnvelope) {
      if (parsed.app !== APP_ID && !LEGACY_APP_IDS.includes(parsed.app)) {
        throw importError("APP_MISMATCH", "この時間割アプリで保存したJSONではありません。");
      }
      if (LEGACY_APP_IDS.includes(parsed.app)) {
        warnings.push("従来版コマいぬの保存データです。Studio用へ安全に変換して読み込みます。");
      }
      version = Number(parsed.version);
      if (!Number.isInteger(version) || !SUPPORTED_VERSIONS.includes(version)) {
        throw importError("UNSUPPORTED_VERSION", `対応していない保存形式です（version: ${String(parsed.version)}）。`);
      }
      source = parsed.state;
    } else {
      source = parsed;
      version = 0;
      legacy = true;
      warnings.push("旧形式のJSONです。読込後に保存し直すと現在の形式へ更新されます。");
    }

    validateStateShape(source);
    const checkSource = App.State.clone(source);
    if (options.draft) {
      checkSource.lessons.forEach((l) => { if (l.subject === "") l.subject = "未入力"; });
      checkSource.rooms.forEach((r) => { if (r.type === "") r.type = "未入力"; });
    }
    const shapeErrors = App.V2.structuralErrors(checkSource);
    if (shapeErrors.length) throw importError("INVALID_DATA", shapeErrors[0].text);
    let next = App.State.normalizeState(source);
    if (App.CurriculumEvolution) {
      next = App.CurriculumEvolution.normalizeState(next);
      if (version < 4) warnings.push("教育課程データを、版・年間時数・週パターンに対応した形式へ変換しました。");
    }
    next.candidates = sanitizeCandidates(next, source.candidates, warnings);
    next.selectedCandidateId = next.candidates.some((candidate) => candidate.id === source.selectedCandidateId)
      ? source.selectedCandidateId
      : (next.candidates[0] ? next.candidates[0].id : null);
    next.validation = App.Validation && App.Validation.validateRequest
      ? App.Validation.validateRequest(next)
      : { errors: [], warnings: [], info: [] };

    return {
      state: next,
      warnings,
      summary: {
        version,
        legacy,
        schoolName: String(next.school.name || "名称未設定"),
        teachers: next.teachers.length,
        rooms: next.rooms.length,
        lessons: next.lessons.length,
        fixedAssignments: next.fixedAssignments.length,
        candidates: next.candidates.length,
        candidateHardViolations: next.candidates.reduce((sum, candidate) => sum + candidate.hardViolations.length, 0),
        validationErrors: (next.validation.errors || []).length,
        validationWarnings: (next.validation.warnings || []).length
      }
    };
  }

  function validateStateShape(source) {
    if (!isPlainObject(source)) {
      throw importError("INVALID_STATE", "時間割データ本体が見つかりません。");
    }
    if (!isPlainObject(source.school)) {
      throw importError("MISSING_SCHOOL", "必須項目「school」がありません。");
    }
    if (!Array.isArray(source.school.days) || !Array.isArray(source.school.classCounts)) {
      throw importError("INVALID_SCHOOL", "学校情報の曜日またはクラス数の形式が正しくありません。");
    }

    const periodsPerDay = Number(source.school.periodsPerDay);
    const gradeCount = Number(source.school.gradeCount);
    const allowedDays = new Set(App.Constants.ALL_DAYS);
    if (!Number.isInteger(periodsPerDay) || periodsPerDay < 1 || periodsPerDay > 8
      || !Number.isInteger(gradeCount) || gradeCount < 1 || gradeCount > 9) {
      throw importError("INVALID_SCHOOL", "学校情報の時限数または学年数が利用可能な範囲ではありません。");
    }
    if (!source.school.days.length
      || source.school.days.some((day) => !allowedDays.has(day))
      || new Set(source.school.days).size !== source.school.days.length) {
      throw importError("INVALID_SCHOOL", "学校情報の曜日が空、重複、または未対応の値になっています。");
    }
    if (source.school.classCounts.length < gradeCount
      || source.school.classCounts.slice(0, gradeCount).some((count) => !Number.isInteger(Number(count)) || Number(count) < 1)) {
      throw importError("INVALID_SCHOOL", "学年ごとのクラス数が不足しているか、正しい数値ではありません。");
    }

    ["teachers", "rooms", "lessons", "fixedAssignments"].forEach((field) => {
      if (!Array.isArray(source[field])) {
        throw importError("MISSING_REQUIRED_ARRAY", `必須項目「${field}」が配列ではありません。`);
      }
      if (source[field].some((item) => !isPlainObject(item))) {
        throw importError("INVALID_ARRAY_ITEM", `「${field}」に正しくないデータが含まれています。`);
      }
      validateEntityIds(source[field], field);
    });
  }

  function validateEntityIds(items, field) {
    const ids = items.map((item) => item.id);
    if (ids.some((id) => typeof id !== "string" || !id.trim()) || new Set(ids).size !== ids.length) {
      throw importError("INVALID_ENTITY_ID", `「${field}」にID未設定または重複したデータがあります。`);
    }
  }

  function sanitizeCandidates(state, rawCandidates, warnings) {
    if (rawCandidates === undefined) return [];
    if (!Array.isArray(rawCandidates)) {
      warnings.push("候補データの形式が正しくないため、候補だけ破棄しました。");
      return [];
    }

    const candidates = [];
    const usedIds = new Set();
    rawCandidates.forEach((rawCandidate, index) => {
      const candidate = sanitizeCandidate(state, rawCandidate, index, usedIds);
      if (!candidate) {
        warnings.push(`候補${index + 1}は形式が正しくないため破棄しました。`);
        return;
      }
      if (candidate.hardViolations.length) {
        warnings.push(`候補${index + 1}は現在の必須条件を満たさないため破棄しました。`);
        return;
      }
      if (candidates.some((other) => App.V2.signature(other) === App.V2.signature(candidate))) return;
      candidates.push(candidate);
    });
    return candidates;
  }

  function sanitizeCandidate(state, rawCandidate, index, usedIds) {
    if (!isPlainObject(rawCandidate) || !Array.isArray(rawCandidate.entries)) return null;
    const entries = [];

    for (const rawEntry of rawCandidate.entries) {
      if (!isPlainObject(rawEntry)) return null;
      const lesson = App.State.getLesson(state, rawEntry.lessonId);
      const period = Number(rawEntry.period);
      if (!lesson
        || rawEntry.classId !== lesson.classId
        || !state.school.days.includes(rawEntry.day)
        || !Number.isInteger(period)
        || period < 1
        || period > App.State.getDayPeriodLimit(state, rawEntry.day)) {
        return null;
      }
      entries.push(Object.assign({}, rawEntry, {
        id: typeof rawEntry.id === "string" && rawEntry.id ? rawEntry.id : App.State.uid("entry"),
        lessonId: lesson.id,
        classId: lesson.classId,
        subject: lesson.subject,
        teacherId: lesson.teacherId || "",
        roomType: lesson.roomType || "普通教室",
        day: rawEntry.day,
        period,
        fixed: Boolean(rawEntry.fixed),
        fixedId: typeof rawEntry.fixedId === "string" ? rawEntry.fixedId : ""
      }));
    }

    let id = typeof rawCandidate.id === "string" && rawCandidate.id ? rawCandidate.id : `imported-candidate-${index + 1}`;
    while (usedIds.has(id)) id = `${id}-${index + 1}`;
    usedIds.add(id);

    const candidate = {
      id,
      name: typeof rawCandidate.name === "string" && rawCandidate.name ? rawCandidate.name : `読込候補${index + 1}`,
      entries,
      hardViolations: [],
      score: 0,
      breakdown: {},
      warnings: [],
      improvements: [],
      curriculumContext: sanitizeCurriculumContext(rawCandidate.curriculumContext)
    };
    candidate.hardViolations = App.Validation && App.Validation.validateCandidate
      ? App.Validation.validateCandidate(state, candidate)
      : [];
    addMissingFixedAssignmentViolations(state, candidate);
    if (App.Scoring && App.Scoring.scoreCandidate) {
      Object.assign(candidate, App.Scoring.scoreCandidate(state, candidate));
    }
    return candidate;
  }

  function addMissingFixedAssignmentViolations(state, candidate) {
    state.fixedAssignments.forEach((fixed) => {
      const found = candidate.entries.some((entry) => {
        return entry.fixedId === fixed.id
          && entry.lessonId === fixed.lessonId
          && entry.classId === fixed.classId
          && entry.day === fixed.day
          && Number(entry.period) === Number(fixed.period);
      });
      if (!found) {
        candidate.hardViolations.push({
          id: "H-005",
          text: "固定授業枠が候補に反映されていません。",
          ref: fixed.id
        });
      }
    });
  }

  function formatImportSummary(plan) {
    const summary = plan.summary;
    const lines = [
      `学校名: ${summary.schoolName}`,
      `教員 ${summary.teachers}名 / 教室 ${summary.rooms}件 / 授業 ${summary.lessons}件`,
      `固定授業 ${summary.fixedAssignments}件 / 保存済み候補 ${summary.candidates}件`,
      `候補内のハード制約違反 ${summary.candidateHardViolations}件`,
      `読込後の入力チェック: エラー ${summary.validationErrors}件 / 注意 ${summary.validationWarnings}件`
    ];
    if (plan.warnings.length) {
      lines.push("", "読込時の注意:", ...plan.warnings.map((warning) => `・${warning}`));
    }
    lines.push("", "現在の入力内容をこのデータで置き換えますか？");
    return lines.join("\n");
  }

  function saveLocal(state) {
    if (recoveryRaw !== null) return { ok: false, message: "以前の保存内容を読み込めません。復旧用JSONを保存するか、確認して白紙から開始してください。" };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      return { ok: true };
    } catch (error) {
      return { ok: false, message: "自動保存できません。JSON保存でバックアップしてください。" };
    }
  }

  function loadLocal() {
    let raw = null;
    try {
      raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      return inspectImportPayload({app: APP_ID, version: CURRENT_VERSION, state: JSON.parse(raw)}, {draft:true}).state;
    } catch (error) {
      if (raw !== null) recoveryRaw = raw;
      return null;
    }
  }

  function exportRecovery() {
    if (recoveryRaw === null) return;
    const url = URL.createObjectURL(new Blob([recoveryRaw], {type:"application/json"}));
    const link = document.createElement("a"); link.href = url; link.download = `komainu-studio-v2-recovery-${dateStamp()}.json`;
    document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(url);
  }

  function sanitizeCurriculumContext(value) {
    if (!isPlainObject(value)) return null;
    return {
      profileId: String(value.profileId || ""),
      profileName: String(value.profileName || ""),
      effectiveYear: value.effectiveYear === "" ? "" : Number(value.effectiveYear || 0),
      status: String(value.status || ""),
      patternId: String(value.patternId || ""),
      patternName: String(value.patternName || ""),
      patternWeeks: Number(value.patternWeeks || 0)
    };
  }

  function isPlainObject(value) {
    return Boolean(value) && typeof value === "object" && !Array.isArray(value);
  }

  function importError(code, message) {
    const error = new Error(message);
    error.code = code;
    error.userMessage = message;
    return error;
  }

  function normalizeImportError(error) {
    if (error && error.userMessage) return error;
    if (error instanceof SyntaxError) return importError("INVALID_JSON", "JSONの文法が正しくありません。");
    return importError("IMPORT_FAILED", "JSONを安全に読み込めませんでした。ファイル内容を確認してください。");
  }

  function dateStamp() {
    const now = new Date();
    const pad = (value) => String(value).padStart(2, "0");
    return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`;
  }

  App.ImportExport = {
    APP_ID,
    CURRENT_VERSION,
    hasRecovery: () => recoveryRaw !== null,
    confirmReplacement: () => { recoveryRaw = null; },
    exportRecovery,
    exportJson,
    importJson,
    inspectImportPayload,
    formatImportSummary,
    saveLocal,
    loadLocal
  };
})(globalThis);
