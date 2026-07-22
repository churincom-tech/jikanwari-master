(function (global) {
  const App = global.TimetableApp = global.TimetableApp || {};
  const APP_ID = "local-timetable-prototype";
  const CURRENT_VERSION = 2;
  const SUPPORTED_VERSIONS = [1, 2];
  const STORAGE_KEY = APP_ID;

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
    link.download = `timetable-${dateStamp()}.json`;
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

  function inspectImportPayload(parsed) {
    if (!isPlainObject(parsed)) {
      throw importError("INVALID_ROOT", "JSONの最上位はオブジェクトである必要があります。");
    }

    const warnings = [];
    const hasEnvelope = Object.prototype.hasOwnProperty.call(parsed, "state");
    let source;
    let version;
    let legacy = false;

    if (hasEnvelope) {
      if (parsed.app !== APP_ID) {
        throw importError("APP_MISMATCH", "この時間割アプリで保存したJSONではありません。");
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
    const next = App.State.normalizeState(source);
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
      improvements: []
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
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (error) {
      // localStorage may be unavailable when opened in some restricted contexts.
    }
  }

  function loadLocal() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? App.State.normalizeState(JSON.parse(raw)) : null;
    } catch (error) {
      return null;
    }
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
    exportJson,
    importJson,
    inspectImportPayload,
    formatImportSummary,
    saveLocal,
    loadLocal
  };
})(globalThis);
