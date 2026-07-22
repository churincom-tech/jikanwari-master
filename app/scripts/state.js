(function (global) {
  const App = global.TimetableApp = global.TimetableApp || {};

  const DAYS = ["月", "火", "水", "木", "金"];
  const ALL_DAYS = DAYS.concat(["土"]);

  const HARD_CONSTRAINTS = [
    { id: "H-001", label: "同じ教員が同じ時限に複数クラスを担当しない", locked: true },
    { id: "H-002", label: "同じ特別教室が同じ時限に複数授業へ割り当てられない", locked: true },
    { id: "H-003", label: "各クラスの各教科が必要時数を満たす", locked: true },
    { id: "H-004", label: "教員の勤務不可時間には授業を入れない", locked: true },
    { id: "H-005", label: "固定授業枠を変更しない", locked: true },
    { id: "H-006", label: "クラスに同時刻で複数授業を入れない", locked: true },
    { id: "H-007", label: "2時間連続必須の授業は連続する2コマで配置する", locked: true },
    { id: "H-008", label: "クラスの途中時限に空きを作らない", locked: true },
    { id: "H-009", label: "固定授業は授業情報の週時数を超えて置かない", locked: true },
    { id: "H-010", label: "日ごとの授業数を通常の日課として自然な範囲に収める", locked: true },
    { id: "H-011", label: "2時間続きの授業は給食をまたがない", locked: true },
    { id: "H-012", label: "2時間続き設定のない授業を連続させない", locked: true },
    { id: "H-013", label: "学校情報で使わない曜日や時限に授業を置かない", locked: true }
  ];

  const SOFT_CONSTRAINTS = [
    { id: "S-001", label: "主要教科が特定曜日や午後に偏りすぎない", enabled: true },
    { id: "S-002", label: "同じ教科が同じ日に重なりすぎない", enabled: true },
    { id: "S-003", label: "教員の空き時間や連続授業をなるべく平準化する", enabled: true },
    { id: "S-004", label: "特別教室利用をなるべく分散する", enabled: true },
    { id: "S-005", label: "非常勤教員の出勤日をなるべく少なくする", enabled: true },
    { id: "S-006", label: "クラスごとの日々の負荷をなるべく均等にする", enabled: true },
    { id: "S-007", label: "2時間連続が望ましい授業をなるべく連続させる", enabled: true }
  ];

  const DOUBLE_MODES = ["none", "required", "preferred"];

  function createDefaultCurriculum() {
    const subject = (id, name, weeklyByGrade, defaultRoomType, defaultDoubleMode) => ({
      id,
      name,
      active: true,
      defaultRoomType: defaultRoomType || "普通教室",
      defaultDoubleMode: defaultDoubleMode || "none",
      weeklyByGrade: Object.assign({ 1: 0, 2: 0, 3: 0 }, weeklyByGrade || {})
    });
    return {
      name: "現行標準（中学校）",
      hourCheckMode: "combined",
      subjects: [
        subject("japanese", "国語", { 1: 4, 2: 4, 3: 3 }),
        subject("social", "社会", { 1: 3, 2: 3, 3: 4 }),
        subject("math", "数学", { 1: 4, 2: 3, 3: 4 }),
        subject("science", "理科", { 1: 3, 2: 4, 3: 4 }, "理科室"),
        subject("music", "音楽", { 1: 1, 2: 1, 3: 1 }, "音楽室"),
        subject("art", "美術", { 1: 2, 2: 1, 3: 1 }, "美術室", "preferred"),
        subject("pe", "保体", { 1: 3, 2: 3, 3: 3 }, "体育館"),
        subject("technology", "技術", { 1: 1, 2: 1, 3: 0.5 }, "技術室", "preferred"),
        subject("homeEconomics", "家庭科", { 1: 1, 2: 1, 3: 0.5 }, "家庭科室", "preferred"),
        subject("english", "英語", { 1: 4, 2: 4, 3: 4 }),
        subject("moral", "道徳", { 1: 1, 2: 1, 3: 1 }),
        subject("homeroom", "学活", { 1: 1, 2: 1, 3: 1 }),
        subject("integrated", "総合", { 1: 1, 2: 2, 3: 2 })
      ],
      hourGroups: [
        {
          id: "technologyHome",
          name: "技術・家庭",
          active: true,
          subjectNames: ["技術", "家庭科"],
          weeklyByGrade: { 1: 2, 2: 2, 3: 1 }
        }
      ]
    };
  }

  function uid(prefix) {
    const random = Math.random().toString(36).slice(2, 8);
    return `${prefix}-${Date.now().toString(36)}-${random}`;
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function createBlankState() {
    return {
      school: {
        name: "新規時間割",
        days: DAYS.slice(),
        periodsPerDay: 6,
        dayPeriodLimits: ALL_DAYS.reduce((limits, day) => {
          limits[day] = 6;
          return limits;
        }, {}),
        gradeCount: 3,
        classCounts: [2, 2, 2]
      },
      teachers: [],
      rooms: [
        { id: "room-normal", name: "普通教室", type: "普通教室", count: 99 },
        { id: "room-science", name: "理科室", type: "理科室", count: 1 },
        { id: "room-gym", name: "体育館", type: "体育館", count: 1 },
        { id: "room-music", name: "音楽室", type: "音楽室", count: 1 },
        { id: "room-art", name: "美術室", type: "美術室", count: 1 },
        { id: "room-tech", name: "技術室", type: "技術室", count: 1 },
        { id: "room-home", name: "家庭科室", type: "家庭科室", count: 1 }
      ],
      lessons: [],
      fixedAssignments: [],
      curriculum: createDefaultCurriculum(),
      constraints: {
        hard: HARD_CONSTRAINTS.map((item) => ({ id: item.id, enabled: true })),
        soft: SOFT_CONSTRAINTS.map((item) => ({ id: item.id, enabled: item.enabled }))
      },
      candidates: [],
      selectedCandidateId: null,
      validation: { errors: [], warnings: [], info: [] }
    };
  }

  function getClasses(state) {
    const classes = [];
    const gradeCount = Number(state.school.gradeCount) || 0;
    for (let gradeIndex = 0; gradeIndex < gradeCount; gradeIndex += 1) {
      const count = Number(state.school.classCounts[gradeIndex]) || 0;
      for (let classIndex = 1; classIndex <= count; classIndex += 1) {
        const grade = gradeIndex + 1;
        classes.push({
          id: `g${grade}-${classIndex}`,
          grade,
          name: `${grade}年${classIndex}組`
        });
      }
    }
    return classes;
  }

  function getSlots(state) {
    const slots = [];
    state.school.days.forEach((day) => {
      const periods = getDayPeriodLimit(state, day);
      for (let period = 1; period <= periods; period += 1) {
        slots.push({ day, period, id: `${day}-${period}` });
      }
    });
    return slots;
  }

  function getDayPeriodLimit(state, day) {
    const maxPeriods = Math.min(8, Math.max(1, Number(state.school.periodsPerDay || 6)));
    const limits = state.school.dayPeriodLimits || {};
    const value = Number(limits[day]);
    return Math.min(maxPeriods, Math.max(1, value || maxPeriods));
  }

  function normalizeDayPeriodLimits(school) {
    const maxPeriods = Math.min(8, Math.max(1, Number(school.periodsPerDay || 6)));
    const source = school.dayPeriodLimits || {};
    return ALL_DAYS.reduce((limits, day) => {
      const value = Number(source[day]);
      limits[day] = Math.min(maxPeriods, Math.max(1, value || maxPeriods));
      return limits;
    }, {});
  }

  function getTeacher(state, teacherId) {
    return state.teachers.find((teacher) => teacher.id === teacherId);
  }

  function getLesson(state, lessonId) {
    return state.lessons.find((lesson) => lesson.id === lessonId);
  }

  function getRoomTypes(state) {
    return [...new Set(state.rooms.map((room) => room.type).filter(Boolean))];
  }

  function getDoubleMode(lesson) {
    if (!lesson) return "none";
    if (DOUBLE_MODES.includes(lesson.doubleMode)) return lesson.doubleMode;
    return lesson.allowDouble ? "preferred" : "none";
  }

  function normalizeState(raw) {
    const next = Object.assign(createBlankState(), clone(raw || {}));
    next.school = Object.assign(createBlankState().school, next.school || {});
    next.school.periodsPerDay = Math.min(8, Math.max(1, Number(next.school.periodsPerDay || 6)));
    next.school.gradeCount = Math.min(9, Math.max(1, Number(next.school.gradeCount || 3)));
    next.school.days = Array.isArray(next.school.days) && next.school.days.length ? next.school.days.filter((day) => ALL_DAYS.includes(day)) : DAYS.slice();
    if (!next.school.days.length) next.school.days = DAYS.slice();
    next.school.dayPeriodLimits = normalizeDayPeriodLimits(next.school);
    next.school.classCounts = Array.isArray(next.school.classCounts) ? next.school.classCounts : [2, 2, 2];
    while (next.school.classCounts.length < Number(next.school.gradeCount || 0)) {
      next.school.classCounts.push(1);
    }
    next.teachers = Array.isArray(next.teachers) ? next.teachers.map((teacher) => normalizeTeacher(teacher, next.school)) : [];
    next.rooms = Array.isArray(next.rooms) ? next.rooms : [];
    next.lessons = Array.isArray(next.lessons) ? next.lessons : [];
    next.curriculum = normalizeCurriculum(next.curriculum);
    next.lessons = next.lessons.map((lesson) => {
      const migrated = migrateLessonSubject(lesson);
      const doubleMode = getDoubleMode(lesson);
      return Object.assign({}, migrated, {
        doubleMode,
        allowDouble: doubleMode !== "none",
        sameDayLimit: doubleMode === "required" ? Math.max(Number(migrated.sameDayLimit || 1), 2) : migrated.sameDayLimit
      });
    });
    next.fixedAssignments = Array.isArray(next.fixedAssignments) ? next.fixedAssignments : [];
    next.candidates = Array.isArray(next.candidates) ? next.candidates : [];
    next.validation = next.validation || { errors: [], warnings: [], info: [] };
    next.constraints = next.constraints || createBlankState().constraints;
    return next;
  }

  function normalizeTeacher(teacher, school) {
    const schoolDays = Array.isArray(school.days) && school.days.length ? school.days : DAYS.slice();
    const hasWorkingDays = Object.prototype.hasOwnProperty.call(teacher || {}, "workingDays");
    const next = Object.assign({
      id: uid("teacher"),
      name: "",
      subjects: [],
      unavailable: [],
      partTime: false,
      workingDays: [],
      autoUnavailable: []
    }, teacher || {});
    next.subjects = Array.isArray(next.subjects)
      ? next.subjects
      : String(next.subjects || "").split(",").map((item) => item.trim()).filter(Boolean);
    next.unavailable = Array.isArray(next.unavailable) ? next.unavailable : [];
    next.autoUnavailable = Array.isArray(next.autoUnavailable) ? next.autoUnavailable : [];
    next.workingDays = Array.isArray(next.workingDays) ? next.workingDays.filter((day) => ALL_DAYS.includes(day)) : [];
    if (next.partTime && !hasWorkingDays) next.workingDays = schoolDays.slice();
    return next;
  }

  function normalizeCurriculum(curriculum) {
    const base = createDefaultCurriculum();
    const next = Object.assign({}, base, clone(curriculum || {}));
    next.subjects = Array.isArray(next.subjects) && next.subjects.length ? next.subjects : base.subjects;
    next.subjects = next.subjects.map((subject) => Object.assign({
      id: uid("subject"),
      name: "",
      active: true,
      defaultRoomType: "普通教室",
      defaultDoubleMode: "none",
      weeklyByGrade: { 1: 0, 2: 0, 3: 0 }
    }, subject, {
      weeklyByGrade: Object.assign({ 1: 0, 2: 0, 3: 0 }, subject.weeklyByGrade || {})
    }));
    next.hourGroups = Array.isArray(next.hourGroups) ? next.hourGroups : base.hourGroups;
    next.hourGroups = next.hourGroups.map((group) => Object.assign({
      id: uid("hour-group"),
      name: "",
      active: true,
      subjectNames: [],
      weeklyByGrade: { 1: 0, 2: 0, 3: 0 }
    }, group, {
      subjectNames: Array.isArray(group.subjectNames) ? group.subjectNames : String(group.subjectNames || "").split(",").map((item) => item.trim()).filter(Boolean),
      weeklyByGrade: Object.assign({ 1: 0, 2: 0, 3: 0 }, group.weeklyByGrade || {})
    }));
    if (!["combined", "separate"].includes(next.hourCheckMode)) next.hourCheckMode = "combined";
    return next;
  }

  function migrateLessonSubject(lesson) {
    const next = Object.assign({}, lesson);
    if (next.subject === "技術・家庭（技術）") {
      next.subject = "技術";
      if (!next.roomType || next.roomType === "分野教室") next.roomType = "技術室";
    }
    if (next.subject === "技術・家庭（家庭）") {
      next.subject = "家庭科";
      if (!next.roomType || next.roomType === "分野教室") next.roomType = "家庭科室";
    }
    return next;
  }

  function getClassDayTargets(state) {
    const targets = new Map();
    const days = state.school.days || [];
    const dayCaps = days.map((day) => getDayPeriodLimit(state, day));
    if (!days.length || !dayCaps.some(Boolean)) return targets;

    getClasses(state).forEach((klass) => {
      const total = state.lessons
        .filter((lesson) => lesson.classId === klass.id)
        .reduce((sum, lesson) => sum + Number(lesson.weeklyCount || 0), 0);
      const fixedMaxByDay = new Map(days.map((day) => [day, 0]));
      state.fixedAssignments
        .filter((fixed) => fixed.classId === klass.id)
        .forEach((fixed) => {
          const current = fixedMaxByDay.get(fixed.day) || 0;
          fixedMaxByDay.set(fixed.day, Math.max(current, Number(fixed.period || 0)));
        });

      const lengths = balancedDayLengths(total, dayCaps);
      days.forEach((day, index) => {
        lengths[index] = Math.max(lengths[index] || 0, fixedMaxByDay.get(day) || 0);
      });

      let overflow = lengths.reduce((sum, value) => sum + value, 0) - total;
      while (overflow > 0) {
        let changed = false;
        for (const index of centerOutOrder(days.length)) {
          if (overflow <= 0) break;
          const minLength = fixedMaxByDay.get(days[index]) || 0;
          if (lengths[index] > minLength && lengths[index] > 0) {
            lengths[index] -= 1;
            overflow -= 1;
            changed = true;
          }
        }
        if (!changed) break;
      }

      let shortage = total - lengths.reduce((sum, value) => sum + value, 0);
      while (shortage > 0) {
        let changed = false;
        for (let index = 0; index < days.length && shortage > 0; index += 1) {
          if (lengths[index] < dayCaps[index]) {
            lengths[index] += 1;
            shortage -= 1;
            changed = true;
          }
        }
        if (!changed) break;
      }

      days.forEach((day, index) => {
        targets.set(`${klass.id}|${day}`, Math.min(lengths[index] || 0, dayCaps[index]));
      });
    });
    return targets;
  }

  function balancedDayLengths(total, dayCaps) {
    const caps = dayCaps.map((value) => Math.max(0, Number(value || 0)));
    const lengths = caps.slice();
    let surplus = Math.max(0, caps.reduce((sum, value) => sum + value, 0) - Math.max(0, Number(total || 0)));
    while (surplus > 0) {
      let changed = false;
      for (const index of centerOutOrder(caps.length)) {
        if (surplus <= 0) break;
        if (lengths[index] > 0) {
          lengths[index] -= 1;
          surplus -= 1;
          changed = true;
        }
      }
      if (!changed) break;
    }
    let shortage = Math.max(0, Number(total || 0)) - lengths.reduce((sum, value) => sum + value, 0);
    while (shortage > 0) {
      let changed = false;
      for (let index = 0; index < caps.length && shortage > 0; index += 1) {
        if (lengths[index] < caps[index]) {
          lengths[index] += 1;
          shortage -= 1;
          changed = true;
        }
      }
      if (!changed) break;
    }
    return lengths;
  }

  function centerOutOrder(count) {
    const center = (count - 1) / 2;
    return Array.from({ length: count }, (_, index) => index)
      .sort((left, right) => Math.abs(left - center) - Math.abs(right - center) || left - right);
  }

  function getTeacherDeletionImpact(state, teacherId) {
    const teacher = getTeacher(state, teacherId);
    const lessons = state.lessons.filter((lesson) => lesson.teacherId === teacherId);
    const lessonIds = new Set(lessons.map((lesson) => lesson.id));
    const fixedAssignments = state.fixedAssignments.filter((fixed) => {
      return fixed.teacherId === teacherId || lessonIds.has(fixed.lessonId);
    });
    return {
      teacherId,
      teacherName: teacher ? teacher.name : teacherId,
      lessonCount: lessons.length,
      fixedAssignmentCount: fixedAssignments.length
    };
  }

  function removeTeacher(state, teacherId) {
    const next = normalizeState(clone(state));
    next.teachers = next.teachers.filter((teacher) => teacher.id !== teacherId);
    next.lessons = next.lessons.map((lesson) => {
      return lesson.teacherId === teacherId ? Object.assign({}, lesson, { teacherId: "" }) : lesson;
    });
    next.fixedAssignments = next.fixedAssignments.map((fixed) => {
      return fixed.teacherId === teacherId ? Object.assign({}, fixed, { teacherId: "" }) : fixed;
    });
    next.candidates = [];
    next.selectedCandidateId = null;
    return next;
  }

  function getLessonDeletionImpact(state, lessonId) {
    const lesson = getLesson(state, lessonId);
    const klass = lesson ? getClasses(state).find((item) => item.id === lesson.classId) : null;
    return {
      lessonId,
      subject: lesson ? lesson.subject : lessonId,
      className: klass ? klass.name : (lesson ? lesson.classId : ""),
      fixedAssignmentCount: state.fixedAssignments.filter((fixed) => fixed.lessonId === lessonId).length
    };
  }

  function removeLesson(state, lessonId) {
    const next = normalizeState(clone(state));
    next.lessons = next.lessons.filter((lesson) => lesson.id !== lessonId);
    next.fixedAssignments = next.fixedAssignments.filter((fixed) => fixed.lessonId !== lessonId);
    next.candidates = [];
    next.selectedCandidateId = null;
    return next;
  }

  function getCurriculumSubjects(state) {
    return normalizeCurriculum(state.curriculum).subjects.filter((subject) => subject.active !== false && subject.name);
  }

  App.Constants = {
    DAYS,
    ALL_DAYS,
    HARD_CONSTRAINTS,
    SOFT_CONSTRAINTS
  };

  App.State = {
    uid,
    clone,
    createBlankState,
    createDefaultCurriculum,
    normalizeState,
    normalizeCurriculum,
    getClasses,
    getSlots,
    getDayPeriodLimit,
    getTeacher,
    getLesson,
    getRoomTypes,
    getDoubleMode,
    getClassDayTargets,
    getTeacherDeletionImpact,
    removeTeacher,
    getLessonDeletionImpact,
    removeLesson,
    getCurriculumSubjects
  };
})(globalThis);
