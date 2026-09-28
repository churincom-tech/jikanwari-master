(function (global) {
  const App = global.TimetableApp = global.TimetableApp || {};

  function findEntryAt(candidate, slot) {
    if (!candidate || !Array.isArray(candidate.entries) || !slot) return null;
    return candidate.entries.find((entry) => {
      return entry.classId === slot.classId
        && entry.day === slot.day
        && Number(entry.period) === Number(slot.period);
    }) || null;
  }

  function createSafeSwap(state, candidate, fromSlot, toSlot) {
    if (!state || !candidate || !fromSlot || !toSlot) {
      return failure("入れ替える2つの時限を選んでください。");
    }
    if (fromSlot.classId !== toSlot.classId) {
      return failure("安全な入れ替えは同じクラス内で行ってください。");
    }
    if (sameSlot(fromSlot, toSlot)) {
      return failure("同じ時限が選ばれています。別のマスを選んでください。");
    }

    const fromEntry = findEntryAt(candidate, fromSlot);
    const toEntry = findEntryAt(candidate, toSlot);
    if (!fromEntry) return failure("最初に授業が入っているマスを選んでください。");
    if (fromEntry.fixed || (toEntry && toEntry.fixed)) {
      return failure("固定授業は移動できません。条件設定で固定を解除してから作り直してください。");
    }
    if (toEntry && fromEntry.lessonId === toEntry.lessonId) {
      return failure("同じ授業同士を入れ替えても時間割は変わりません。別の授業または空きマスを選んでください。");
    }

    const next = App.State.clone(candidate);
    const nextFrom = next.entries.find((entry) => entry.id === fromEntry.id);
    const nextTo = toEntry ? next.entries.find((entry) => entry.id === toEntry.id) : null;
    nextFrom.day = toSlot.day;
    nextFrom.period = Number(toSlot.period);
    if (nextTo) {
      nextTo.day = fromSlot.day;
      nextTo.period = Number(fromSlot.period);
    }

    next.hardViolations = App.Validation.validateCandidate(state, next);
    if (next.hardViolations.length) {
      return {
        ok: false,
        message: "この入れ替えは必須条件を守れないため取り消しました。",
        violations: next.hardViolations.slice(0, 4)
      };
    }

    Object.assign(next, App.Scoring.scoreCandidate(state, next), {
      manualAdjusted: true,
      manualRevision: Number(candidate.manualRevision || 0) + 1,
      manualAdjustedAt: new Date().toISOString()
    });
    return {
      ok: true,
      candidate: next,
      message: toEntry
        ? `${fromEntry.subject} と ${toEntry.subject} を入れ替えました。`
        : `${fromEntry.subject} を空きマスへ移動しました。`
    };
  }

  function sameSlot(left, right) {
    return left.classId === right.classId
      && left.day === right.day
      && Number(left.period) === Number(right.period);
  }

  function failure(message) {
    return { ok: false, message, violations: [] };
  }

  function normalizeStudioProgress(state) {
    const source = state && state.studioProgress && typeof state.studioProgress === "object"
      ? state.studioProgress
      : {};
    const inferred = inferStudioProgress(state);
    return {
      schoolConfirmed: typeof source.schoolConfirmed === "boolean"
        ? source.schoolConfirmed
        : inferred.schoolConfirmed,
      roomsConfirmed: typeof source.roomsConfirmed === "boolean"
        ? source.roomsConfirmed
        : inferred.roomsConfirmed
    };
  }

  function inferStudioProgress(state) {
    if (!state) return { schoolConfirmed: false, roomsConfirmed: false };
    const blank = App.State.createBlankState();
    const hasSubstantiveWork = Boolean(
      (state.teachers || []).length
      || (state.lessons || []).length
      || (state.fixedAssignments || []).length
      || (state.candidates || []).length
    );
    return {
      schoolConfirmed: hasSubstantiveWork || JSON.stringify(state.school || {}) !== JSON.stringify(blank.school),
      roomsConfirmed: hasSubstantiveWork || JSON.stringify(state.rooms || []) !== JSON.stringify(blank.rooms)
    };
  }

  function getReadinessStatus(state, validation) {
    const safeState = state || App.State.createBlankState();
    const progress = normalizeStudioProgress(safeState);
    const classes = App.State.getClasses(safeState);
    const schoolStructureValid = Boolean(
      safeState.school
      && Array.isArray(safeState.school.days)
      && safeState.school.days.length
      && Number(safeState.school.periodsPerDay) > 0
      && classes.length
    );
    const hasSchool = progress.schoolConfirmed && schoolStructureValid;
    const hasTeachers = Boolean((safeState.teachers || []).length);
    const hasRooms = progress.roomsConfirmed && Boolean((safeState.rooms || []).length);
    const hasLessons = Boolean((safeState.lessons || []).length);
    const checkedValidation = validation || safeState.validation || { errors: [] };
    const hasErrors = Boolean(checkedValidation.errors && checkedValidation.errors.length);
    const candidates = safeState.candidates || [];
    const items = [hasSchool, hasTeachers, hasRooms, hasLessons, hasLessons && !hasErrors, candidates.length > 0];
    return {
      hasSchool,
      hasTeachers,
      hasRooms,
      hasLessons,
      hasErrors,
      candidates,
      percent: Math.round(items.filter(Boolean).length / items.length * 100)
    };
  }

  App.StudioCore = {
    findEntryAt,
    createSafeSwap,
    normalizeStudioProgress,
    getReadinessStatus
  };
})(globalThis);
