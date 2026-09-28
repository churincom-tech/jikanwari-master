(function (global) {
  const App = global.TimetableApp = global.TimetableApp || {};
  const DEFAULT_WEEKS = 35;
  const PROFILE_STATUSES = ["current", "proposal", "school", "archived"];

  function normalizeState(rawState) {
    const next = App.State.normalizeState(App.State.clone(rawState || {}));
    const gradeCount = Number(next.school.gradeCount || 3);
    const sourceProfiles = Array.isArray(next.curriculumProfiles) ? next.curriculumProfiles : [];

    if (!sourceProfiles.length) {
      const profile = createProfile(next.curriculum, gradeCount, next.curriculum.name || "現行教育課程");
      next.curriculumProfiles = [profile];
      next.activeCurriculumProfileId = profile.id;
      next.curriculum = projectActivePattern(profile, gradeCount);
      return next;
    }

    const activeId = sourceProfiles.some((profile) => profile && profile.id === next.activeCurriculumProfileId)
      ? next.activeCurriculumProfileId
      : sourceProfiles[0].id;
    next.curriculumProfiles = sourceProfiles.map((profile) => {
      const fallback = profile && profile.id === activeId ? next.curriculum : profile && profile.curriculum;
      return normalizeProfile(profile, fallback, gradeCount, profile && profile.id === activeId);
    });
    next.activeCurriculumProfileId = activeId;
    const active = getActiveProfile(next);
    next.curriculum = projectActivePattern(active, gradeCount);
    return next;
  }

  function createProfile(curriculum, gradeCount, name) {
    const normalizedCurriculum = App.State.normalizeCurriculum(curriculum);
    const patternId = App.State.uid("pattern");
    const weekly = weeklyMap(normalizedCurriculum, gradeCount);
    return {
      id: App.State.uid("curriculum-profile"),
      name: name || "教育課程案",
      effectiveYear: new Date().getFullYear(),
      status: "current",
      curriculum: App.State.clone(normalizedCurriculum),
      patterns: [{ id: patternId, name: "通常週", weeks: DEFAULT_WEEKS }],
      activePatternId: patternId,
      patternWeekly: { [patternId]: weekly },
      annualTargets: annualTargetsFromPatterns([{ id: patternId, weeks: DEFAULT_WEEKS }], { [patternId]: weekly }, normalizedCurriculum, gradeCount)
    };
  }

  function normalizeProfile(rawProfile, fallbackCurriculum, gradeCount, captureLive) {
    const fallback = App.State.normalizeCurriculum(fallbackCurriculum || App.State.createDefaultCurriculum());
    const profile = Object.assign({
      id: App.State.uid("curriculum-profile"),
      name: fallback.name || "教育課程案",
      effectiveYear: new Date().getFullYear(),
      status: "proposal",
      curriculum: fallback,
      patterns: [],
      activePatternId: "",
      patternWeekly: {},
      annualTargets: {}
    }, App.State.clone(rawProfile || {}));
    profile.curriculum = App.State.normalizeCurriculum(captureLive ? fallback : (profile.curriculum || fallback));
    profile.name = String(profile.name || profile.curriculum.name || "教育課程案");
    profile.effectiveYear = clampYear(profile.effectiveYear);
    if (!PROFILE_STATUSES.includes(profile.status)) profile.status = "proposal";
    profile.patterns = Array.isArray(profile.patterns) && profile.patterns.length
      ? profile.patterns.map(normalizePattern)
      : [{ id: App.State.uid("pattern"), name: "通常週", weeks: DEFAULT_WEEKS }];
    profile.activePatternId = profile.patterns.some((pattern) => pattern.id === profile.activePatternId)
      ? profile.activePatternId
      : profile.patterns[0].id;
    profile.patternWeekly = isPlainObject(profile.patternWeekly) ? profile.patternWeekly : {};
    profile.patterns.forEach((pattern) => {
      const source = isPlainObject(profile.patternWeekly[pattern.id])
        ? profile.patternWeekly[pattern.id]
        : weeklyMap(profile.curriculum, gradeCount);
      profile.patternWeekly[pattern.id] = normalizeWeeklyMap(source, profile.curriculum, gradeCount);
    });
    if (captureLive) {
      profile.patternWeekly[profile.activePatternId] = weeklyMap(profile.curriculum, gradeCount);
    }
    profile.annualTargets = normalizeAnnualTargets(profile.annualTargets, profile, gradeCount);
    profile.curriculum.name = profile.name;
    return profile;
  }

  function captureActiveProfile(rawState) {
    let next = App.State.clone(rawState || {});
    if (!Array.isArray(next.curriculumProfiles) || !next.curriculumProfiles.length) {
      return normalizeState(next);
    }
    next.curriculum = App.State.normalizeCurriculum(next.curriculum);
    const gradeCount = Number(next.school && next.school.gradeCount || 3);
    const index = next.curriculumProfiles.findIndex((profile) => profile.id === next.activeCurriculumProfileId);
    if (index < 0) return normalizeState(next);
    const profile = normalizeProfile(next.curriculumProfiles[index], next.curriculum, gradeCount, true);
    profile.name = String(next.curriculum.name || profile.name || "教育課程案");
    profile.curriculum = App.State.clone(next.curriculum);
    profile.curriculum.name = profile.name;
    profile.patternWeekly[profile.activePatternId] = weeklyMap(next.curriculum, gradeCount);
    profile.annualTargets = normalizeAnnualTargets(profile.annualTargets, profile, gradeCount);
    next.curriculumProfiles[index] = profile;
    return next;
  }

  function getActiveProfile(state) {
    const profiles = state && Array.isArray(state.curriculumProfiles) ? state.curriculumProfiles : [];
    return profiles.find((profile) => profile.id === state.activeCurriculumProfileId) || profiles[0] || null;
  }

  function getActivePattern(profile) {
    if (!profile) return null;
    return (profile.patterns || []).find((pattern) => pattern.id === profile.activePatternId)
      || (profile.patterns || [])[0]
      || null;
  }

  function getActiveContext(rawState) {
    const state = normalizeState(rawState);
    const profile = getActiveProfile(state);
    const pattern = getActivePattern(profile);
    return {
      profileId: profile ? profile.id : "",
      profileName: profile ? profile.name : "",
      effectiveYear: profile ? profile.effectiveYear : "",
      status: profile ? profile.status : "",
      patternId: pattern ? pattern.id : "",
      patternName: pattern ? pattern.name : "",
      patternWeeks: pattern ? Number(pattern.weeks || 0) : 0
    };
  }

  function duplicateActiveProfile(rawState) {
    const next = normalizeState(rawState);
    const source = getActiveProfile(next);
    if (!source) return next;
    const duplicate = App.State.clone(source);
    duplicate.id = App.State.uid("curriculum-profile");
    duplicate.name = `${source.name} コピー`;
    duplicate.status = "proposal";
    const idMap = new Map();
    duplicate.patterns = duplicate.patterns.map((pattern) => {
      const newId = App.State.uid("pattern");
      idMap.set(pattern.id, newId);
      return Object.assign({}, pattern, { id: newId });
    });
    const nextWeekly = {};
    Object.entries(duplicate.patternWeekly || {}).forEach(([oldId, value]) => {
      if (idMap.has(oldId)) nextWeekly[idMap.get(oldId)] = value;
    });
    duplicate.patternWeekly = nextWeekly;
    duplicate.activePatternId = idMap.get(source.activePatternId) || duplicate.patterns[0].id;
    next.curriculumProfiles.push(duplicate);
    next.activeCurriculumProfileId = duplicate.id;
    next.curriculum = projectActivePattern(duplicate, Number(next.school.gradeCount || 3));
    clearCandidates(next);
    return next;
  }

  function compareProfileActivation(rawState, targetId) {
    const state = normalizeState(rawState);
    const current = getActiveProfile(state);
    const target = state.curriculumProfiles.find((profile) => profile.id === targetId);
    const result = { found: Boolean(target), added: [], removed: [], changed: [], annualChanged: 0 };
    if (!current || !target) return result;
    const currentById = new Map(current.curriculum.subjects.map((subject) => [subject.id, subject]));
    const targetById = new Map(target.curriculum.subjects.map((subject) => [subject.id, subject]));
    target.curriculum.subjects.forEach((subject) => {
      if (!currentById.has(subject.id)) result.added.push(subject.name);
    });
    current.curriculum.subjects.forEach((subject) => {
      if (!targetById.has(subject.id)) result.removed.push(subject.name);
    });
    targetById.forEach((subject, subjectId) => {
      const before = currentById.get(subjectId);
      if (!before) return;
      if (before.name !== subject.name || JSON.stringify(before.weeklyByGrade) !== JSON.stringify(subject.weeklyByGrade)) {
        result.changed.push(subject.name);
      }
      for (let grade = 1; grade <= Number(state.school.gradeCount || 3); grade += 1) {
        const left = Number(current.annualTargets?.[subjectId]?.[grade] || 0);
        const right = Number(target.annualTargets?.[subjectId]?.[grade] || 0);
        if (left !== right) result.annualChanged += 1;
      }
    });
    return result;
  }

  function activateProfile(rawState, profileId) {
    const next = normalizeState(rawState);
    const target = next.curriculumProfiles.find((profile) => profile.id === profileId);
    if (!target || target.id === next.activeCurriculumProfileId) return next;
    next.activeCurriculumProfileId = target.id;
    next.curriculum = projectActivePattern(target, Number(next.school.gradeCount || 3));
    clearCandidates(next);
    return next;
  }

  function updateProfileMeta(rawState, profileId, updates) {
    const next = normalizeState(rawState);
    const profile = next.curriculumProfiles.find((item) => item.id === profileId);
    if (!profile) return next;
    if (Object.prototype.hasOwnProperty.call(updates || {}, "name")) profile.name = String(updates.name || "教育課程案");
    if (Object.prototype.hasOwnProperty.call(updates || {}, "effectiveYear")) profile.effectiveYear = clampYear(updates.effectiveYear);
    if (PROFILE_STATUSES.includes(updates && updates.status)) profile.status = updates.status;
    profile.curriculum.name = profile.name;
    if (profile.id === next.activeCurriculumProfileId) next.curriculum.name = profile.name;
    clearCandidates(next);
    return next;
  }

  function deleteProfile(rawState, profileId) {
    const next = normalizeState(rawState);
    if (profileId === next.activeCurriculumProfileId || next.curriculumProfiles.length <= 1) return next;
    next.curriculumProfiles = next.curriculumProfiles.filter((profile) => profile.id !== profileId);
    return next;
  }

  function addPattern(rawState, name, weeks) {
    const next = captureActiveProfile(normalizeState(rawState));
    const profile = getActiveProfile(next);
    const active = getActivePattern(profile);
    const pattern = normalizePattern({ id: App.State.uid("pattern"), name: name || "追加パターン", weeks: weeks || 1 });
    profile.patterns.push(pattern);
    profile.patternWeekly[pattern.id] = App.State.clone(profile.patternWeekly[active.id]);
    clearCandidates(next);
    return next;
  }

  function splitAlternatingPattern(rawState) {
    const next = captureActiveProfile(normalizeState(rawState));
    const profile = getActiveProfile(next);
    if (!profile || profile.patterns.length !== 1) return next;
    const first = profile.patterns[0];
    const total = Math.max(2, Number(first.weeks || DEFAULT_WEEKS));
    first.name = "A週";
    first.weeks = Math.ceil(total / 2);
    const second = { id: App.State.uid("pattern"), name: "B週", weeks: Math.floor(total / 2) };
    profile.patterns.push(second);
    profile.patternWeekly[second.id] = App.State.clone(profile.patternWeekly[first.id]);
    clearCandidates(next);
    return next;
  }

  function updatePattern(rawState, patternId, updates) {
    const next = normalizeState(rawState);
    const profile = getActiveProfile(next);
    const pattern = profile && profile.patterns.find((item) => item.id === patternId);
    if (!pattern) return next;
    if (Object.prototype.hasOwnProperty.call(updates || {}, "name")) pattern.name = String(updates.name || "週パターン");
    if (Object.prototype.hasOwnProperty.call(updates || {}, "weeks")) pattern.weeks = clampWeeks(updates.weeks);
    clearCandidates(next);
    return next;
  }

  function deletePattern(rawState, patternId) {
    const next = normalizeState(rawState);
    const profile = getActiveProfile(next);
    if (!profile || profile.patterns.length <= 1 || patternId === profile.activePatternId) return next;
    profile.patterns = profile.patterns.filter((pattern) => pattern.id !== patternId);
    delete profile.patternWeekly[patternId];
    clearCandidates(next);
    return next;
  }

  function activatePattern(rawState, patternId) {
    const next = captureActiveProfile(normalizeState(rawState));
    const profile = getActiveProfile(next);
    if (!profile || !profile.patterns.some((pattern) => pattern.id === patternId)) return next;
    profile.activePatternId = patternId;
    next.curriculum = projectActivePattern(profile, Number(next.school.gradeCount || 3));
    clearCandidates(next);
    return next;
  }

  function updatePatternSubjectPeriods(rawState, patternId, subjectId, grade, value) {
    const next = normalizeState(rawState);
    const profile = getActiveProfile(next);
    if (!profile || !profile.patternWeekly[patternId] || !profile.patternWeekly[patternId][subjectId]) return next;
    const numeric = Math.max(0, Number(value || 0));
    profile.patternWeekly[patternId][subjectId][grade] = numeric;
    if (patternId === profile.activePatternId) {
      const subject = next.curriculum.subjects.find((item) => item.id === subjectId);
      if (subject) subject.weeklyByGrade[grade] = numeric;
      profile.curriculum = App.State.clone(next.curriculum);
    }
    clearCandidates(next);
    return next;
  }

  function updateAnnualTarget(rawState, subjectId, grade, value) {
    const next = normalizeState(rawState);
    const profile = getActiveProfile(next);
    if (!profile || !profile.annualTargets[subjectId]) return next;
    profile.annualTargets[subjectId][grade] = Math.max(0, Number(value || 0));
    return next;
  }

  function calculateAnnualPlan(rawState) {
    const state = normalizeState(rawState);
    const profile = getActiveProfile(state);
    const rows = [];
    if (!profile) return { profile: null, patterns: [], rows, differenceCount: 0 };
    profile.curriculum.subjects.filter((subject) => subject.active !== false).forEach((subject) => {
      for (let grade = 1; grade <= Number(state.school.gradeCount || 3); grade += 1) {
        const planned = profile.patterns.reduce((sum, pattern) => {
          return sum + Number(pattern.weeks || 0) * Number(profile.patternWeekly?.[pattern.id]?.[subject.id]?.[grade] || 0);
        }, 0);
        const target = Number(profile.annualTargets?.[subject.id]?.[grade] || 0);
        rows.push({ subjectId: subject.id, subjectName: subject.name, grade, planned, target, difference: planned - target });
      }
    });
    return {
      profile,
      patterns: profile.patterns,
      rows,
      differenceCount: rows.filter((row) => Math.abs(row.difference) > 0.001).length
    };
  }

  function buildSubjectDeploymentPlan(rawState, subjectId) {
    const state = normalizeState(rawState);
    const subject = state.curriculum.subjects.find((item) => item.id === subjectId);
    const plan = {
      subjectId,
      subjectName: subject ? subject.name : "",
      existingLessons: [],
      missingClasses: [],
      changeCount: 0,
      blockers: []
    };
    if (!subject) {
      plan.blockers.push("教育課程マスタの教科が見つかりません。");
      return plan;
    }
    if (subject.active === false) {
      plan.blockers.push("対象外の教科は一括展開できません。");
      return plan;
    }
    const combined = getCombinedGroup(state, subject);
    if (combined) {
      plan.blockers.push(`${subject.name}は「${combined.name}」の合算時数で管理されています。教科別に展開する場合は標準時数チェックを「教科ごと」に変更してください。`);
      return plan;
    }
    if (!state.rooms.some((room) => room.type === (subject.defaultRoomType || "普通教室"))) {
      plan.blockers.push(`標準教室「${subject.defaultRoomType || "普通教室"}」が教室情報にありません。`);
    }
    App.State.getClasses(state).forEach((klass) => {
      const expected = Number(subject.weeklyByGrade?.[klass.grade] || 0);
      if (expected <= 0) return;
      if (!Number.isInteger(expected)) {
        plan.blockers.push(`${klass.name}の週時数 ${expected} は整数ではないため、1週間の時間割へ展開できません。`);
        return;
      }
      if (subject.defaultDoubleMode === "required" && expected % 2 !== 0) {
        plan.blockers.push(`${klass.name}は2時間連続必須ですが、週時数 ${expected} が奇数です。`);
        return;
      }
      const matches = state.lessons.filter((lesson) => lesson.classId === klass.id && lessonMatchesSubject(lesson, subject));
      if (matches.length > 1) {
        plan.blockers.push(`${klass.name}に${subject.name}の授業が${matches.length}件あり、重複しています。`);
        return;
      }
      if (!matches.length) {
        plan.missingClasses.push({ classId: klass.id, className: klass.name, grade: klass.grade, weeklyCount: expected });
        return;
      }
      const lesson = matches[0];
      plan.existingLessons.push({ lessonId: lesson.id, classId: klass.id, className: klass.name });
      if (lesson.subject !== subject.name
        || Number(lesson.weeklyCount || 0) !== expected
        || (lesson.roomType || "普通教室") !== (subject.defaultRoomType || "普通教室")
        || App.State.getDoubleMode(lesson) !== (subject.defaultDoubleMode || "none")
        || lesson.curriculumSubjectId !== subject.id) {
        plan.changeCount += 1;
      }
      const fixedCount = state.fixedAssignments.filter((fixed) => fixed.lessonId === lesson.id).length;
      if (fixedCount > expected) plan.blockers.push(`${klass.name}の固定授業 ${fixedCount}コマが週時数 ${expected} を超えています。`);
    });
    return plan;
  }

  function applySubjectDeployment(rawState, subjectId, teacherByClass) {
    const next = normalizeState(rawState);
    const plan = buildSubjectDeploymentPlan(next, subjectId);
    if (plan.blockers.length) throw new Error(plan.blockers.join("\n"));
    const subject = next.curriculum.subjects.find((item) => item.id === subjectId);
    const assignments = teacherByClass || {};
    plan.missingClasses.forEach((klass) => {
      const teacherId = assignments[klass.classId];
      if (!teacherId || !next.teachers.some((teacher) => teacher.id === teacherId)) {
        throw new Error(`${klass.className}の担当教員を選んでください。`);
      }
    });
    const mode = subject.defaultDoubleMode || "none";
    const roomType = subject.defaultRoomType || "普通教室";
    const existingIds = new Set(plan.existingLessons.map((item) => item.lessonId));
    const classesById = new Map(App.State.getClasses(next).map((klass) => [klass.id, klass]));
    next.lessons = next.lessons.map((lesson) => {
      if (!existingIds.has(lesson.id)) return lesson;
      const klass = classesById.get(lesson.classId);
      return Object.assign({}, lesson, {
        curriculumSubjectId: subject.id,
        subject: subject.name,
        weeklyCount: Number(subject.weeklyByGrade?.[klass.grade] || 0),
        roomType,
        doubleMode: mode,
        allowDouble: mode !== "none",
        sameDayLimit: mode !== "none" ? Math.max(Number(lesson.sameDayLimit || 1), 2) : Math.max(1, Number(lesson.sameDayLimit || 1))
      });
    });
    plan.missingClasses.forEach((klass) => {
      next.lessons.push({
        id: App.State.uid("lesson"),
        classId: klass.classId,
        curriculumSubjectId: subject.id,
        subject: subject.name,
        weeklyCount: klass.weeklyCount,
        teacherId: assignments[klass.classId],
        roomType,
        sameDayLimit: mode === "required" ? 2 : 1,
        allowDouble: mode !== "none",
        doubleMode: mode
      });
    });
    next.fixedAssignments = next.fixedAssignments.map((fixed) => {
      return existingIds.has(fixed.lessonId) ? Object.assign({}, fixed, { roomType }) : fixed;
    });
    clearCandidates(next);
    return { state: next, plan };
  }

  function buildImpactPlan(rawState) {
    const state = normalizeState(rawState);
    const annual = calculateAnnualPlan(state);
    const impact = {
      missingLessons: [],
      changedLessons: [],
      duplicateLessons: [],
      missingTeachers: [],
      missingRooms: [],
      invalidWeeklyCounts: [],
      fixedOverflows: [],
      capacityOverflows: [],
      annualDifferences: annual.rows.filter((row) => Math.abs(row.difference) > 0.001)
    };
    const roomTypes = new Set(state.rooms.map((room) => room.type));
    const teacherIds = new Set(state.teachers.map((teacher) => teacher.id));
    const weeklyCapacity = state.school.days.reduce((sum, day) => sum + App.State.getDayPeriodLimit(state, day), 0);
    const classes = App.State.getClasses(state);
    state.curriculum.subjects.filter((subject) => subject.active !== false && subject.name).forEach((subject) => {
      const combined = getCombinedGroup(state, subject);
      if (!roomTypes.has(subject.defaultRoomType || "普通教室")) impact.missingRooms.push({ subjectId: subject.id, subjectName: subject.name, roomType: subject.defaultRoomType || "普通教室" });
      if (combined) return;
      classes.forEach((klass) => {
        const expected = Number(subject.weeklyByGrade?.[klass.grade] || 0);
        if (expected <= 0) return;
        if (!combined && (!Number.isInteger(expected) || (subject.defaultDoubleMode === "required" && expected % 2 !== 0))) {
          impact.invalidWeeklyCounts.push({ subjectId: subject.id, subjectName: subject.name, className: klass.name, weeklyCount: expected });
        }
        const matches = state.lessons.filter((lesson) => lesson.classId === klass.id && lessonMatchesSubject(lesson, subject));
        if (!matches.length) {
          impact.missingLessons.push({ subjectId: subject.id, subjectName: subject.name, classId: klass.id, className: klass.name });
          return;
        }
        if (matches.length > 1) impact.duplicateLessons.push({ subjectId: subject.id, subjectName: subject.name, className: klass.name, count: matches.length });
        matches.forEach((lesson) => {
          if (!lesson.teacherId || !teacherIds.has(lesson.teacherId)) impact.missingTeachers.push({ lessonId: lesson.id, subjectName: subject.name, className: klass.name });
          if (lesson.subject !== subject.name || Number(lesson.weeklyCount || 0) !== expected || lesson.roomType !== (subject.defaultRoomType || "普通教室") || App.State.getDoubleMode(lesson) !== (subject.defaultDoubleMode || "none")) {
            impact.changedLessons.push({ lessonId: lesson.id, subjectId: subject.id, subjectName: subject.name, className: klass.name });
          }
          const fixedCount = state.fixedAssignments.filter((fixed) => fixed.lessonId === lesson.id).length;
          if (fixedCount > expected) impact.fixedOverflows.push({ lessonId: lesson.id, subjectName: subject.name, className: klass.name, fixedCount, weeklyCount: expected });
        });
      });
    });
    const profile = getActiveProfile(state);
    (profile ? profile.patterns : []).forEach((pattern) => {
      for (let grade = 1; grade <= Number(state.school.gradeCount || 3); grade += 1) {
        const total = profile.curriculum.subjects.filter((subject) => subject.active !== false).reduce((sum, subject) => {
          return sum + Number(profile.patternWeekly?.[pattern.id]?.[subject.id]?.[grade] || 0);
        }, 0);
        if (total > weeklyCapacity) impact.capacityOverflows.push({ patternId: pattern.id, patternName: pattern.name, grade, total, capacity: weeklyCapacity });
      }
    });
    impact.blockerCount = impact.missingLessons.length + impact.duplicateLessons.length + impact.missingTeachers.length
      + impact.missingRooms.length + impact.invalidWeeklyCounts.length + impact.fixedOverflows.length + impact.capacityOverflows.length;
    impact.warningCount = impact.changedLessons.length + impact.annualDifferences.length;
    return impact;
  }

  function projectActivePattern(profile, gradeCount) {
    const curriculum = App.State.normalizeCurriculum(profile && profile.curriculum);
    const active = getActivePattern(profile);
    const map = active && profile.patternWeekly ? profile.patternWeekly[active.id] : null;
    curriculum.name = profile ? profile.name : curriculum.name;
    curriculum.subjects.forEach((subject) => {
      for (let grade = 1; grade <= gradeCount; grade += 1) {
        subject.weeklyByGrade[grade] = Number(map?.[subject.id]?.[grade] || 0);
      }
    });
    return curriculum;
  }

  function weeklyMap(curriculum, gradeCount) {
    const result = {};
    App.State.normalizeCurriculum(curriculum).subjects.forEach((subject) => {
      result[subject.id] = {};
      for (let grade = 1; grade <= gradeCount; grade += 1) result[subject.id][grade] = Math.max(0, Number(subject.weeklyByGrade?.[grade] || 0));
    });
    return result;
  }

  function normalizeWeeklyMap(source, curriculum, gradeCount) {
    const fallback = weeklyMap(curriculum, gradeCount);
    Object.keys(fallback).forEach((subjectId) => {
      for (let grade = 1; grade <= gradeCount; grade += 1) {
        const value = Number(source?.[subjectId]?.[grade]);
        if (Number.isFinite(value) && value >= 0) fallback[subjectId][grade] = value;
      }
    });
    return fallback;
  }

  function normalizeAnnualTargets(source, profile, gradeCount) {
    const calculated = annualTargetsFromPatterns(profile.patterns, profile.patternWeekly, profile.curriculum, gradeCount);
    Object.keys(calculated).forEach((subjectId) => {
      for (let grade = 1; grade <= gradeCount; grade += 1) {
        const value = Number(source?.[subjectId]?.[grade]);
        if (Number.isFinite(value) && value >= 0) calculated[subjectId][grade] = value;
      }
    });
    return calculated;
  }

  function annualTargetsFromPatterns(patterns, patternWeekly, curriculum, gradeCount) {
    const result = {};
    App.State.normalizeCurriculum(curriculum).subjects.forEach((subject) => {
      result[subject.id] = {};
      for (let grade = 1; grade <= gradeCount; grade += 1) {
        result[subject.id][grade] = (patterns || []).reduce((sum, pattern) => {
          return sum + Number(pattern.weeks || 0) * Number(patternWeekly?.[pattern.id]?.[subject.id]?.[grade] || 0);
        }, 0);
      }
    });
    return result;
  }

  function normalizePattern(pattern) {
    return {
      id: String(pattern && pattern.id || App.State.uid("pattern")),
      name: String(pattern && pattern.name || "週パターン"),
      weeks: clampWeeks(pattern && pattern.weeks)
    };
  }

  function getCombinedGroup(state, subject) {
    if (state.curriculum.hourCheckMode !== "combined") return null;
    return state.curriculum.hourGroups.find((group) => group.active !== false && (group.subjectNames || []).includes(subject.name)) || null;
  }

  function lessonMatchesSubject(lesson, subject) {
    return lesson.curriculumSubjectId === subject.id || (!lesson.curriculumSubjectId && lesson.subject === subject.name) || lesson.subject === subject.name;
  }

  function clearCandidates(state) {
    state.candidates = [];
    state.selectedCandidateId = null;
  }

  function clampWeeks(value) {
    return Math.min(60, Math.max(0, Number(value || 0)));
  }

  function clampYear(value) {
    return Math.min(2200, Math.max(2000, Math.round(Number(value || new Date().getFullYear()))));
  }

  function isPlainObject(value) {
    return Boolean(value) && typeof value === "object" && !Array.isArray(value);
  }

  App.CurriculumEvolution = {
    DEFAULT_WEEKS,
    PROFILE_STATUSES,
    normalizeState,
    captureActiveProfile,
    getActiveProfile,
    getActivePattern,
    getActiveContext,
    duplicateActiveProfile,
    compareProfileActivation,
    activateProfile,
    updateProfileMeta,
    deleteProfile,
    addPattern,
    splitAlternatingPattern,
    updatePattern,
    deletePattern,
    activatePattern,
    updatePatternSubjectPeriods,
    updateAnnualTarget,
    calculateAnnualPlan,
    buildImpactPlan,
    buildSubjectDeploymentPlan,
    applySubjectDeployment
  };
})(globalThis);
