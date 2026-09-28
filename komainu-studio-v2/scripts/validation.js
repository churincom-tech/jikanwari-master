(function (global) {
  const App = global.TimetableApp = global.TimetableApp || {};

  function makeMessage(type, text, ref) {
    return { type, text, ref: ref || "" };
  }

  function slotKey(day, period) {
    return `${day}-${period}`;
  }

  function lessonKey(lesson) {
    return `${lesson.classId}|${lesson.subject}|${lesson.teacherId}|${lesson.roomType}`;
  }

  function validateRequest(state) {
    const errors = [];
    const warnings = [];
    const info = [];
    const classes = App.State.getClasses(state);
    const slots = App.State.getSlots(state);
    const teacherIds = new Set(state.teachers.map((teacher) => teacher.id));
    const roomTypes = new Set(state.rooms.map((room) => room.type));

    if (!state.school.days.length) errors.push(makeMessage("error", "曜日を1つ以上選択してください。", "school.days"));
    if (!Number(state.school.periodsPerDay)) errors.push(makeMessage("error", "1日の時限数を入力してください。", "school.periodsPerDay"));
    if (!classes.length) errors.push(makeMessage("error", "学年とクラス数を入力してください。", "classes"));
    if (!state.lessons.length) errors.push(makeMessage("error", "授業情報を1件以上入力してください。", "lessons"));

    state.lessons.forEach((lesson) => {
      if (!lesson.classId) errors.push(makeMessage("error", "授業情報に対象クラスが未設定の行があります。", lesson.id));
      if (!lesson.subject) errors.push(makeMessage("error", "授業情報に教科名が未設定の行があります。", lesson.id));
      if (!Number(lesson.weeklyCount)) errors.push(makeMessage("error", `${lesson.subject || "未設定教科"}の週時数を1以上にしてください。`, lesson.id));
      if (!lesson.teacherId || !teacherIds.has(lesson.teacherId)) errors.push(makeMessage("error", `${lesson.subject || "未設定教科"}の担当教員を設定してください。`, lesson.id));
      if (lesson.roomType && !roomTypes.has(lesson.roomType)) warnings.push(makeMessage("warning", `${lesson.subject}で使う教室種別「${lesson.roomType}」が教室設定にありません。`, lesson.id));
      const teacherCapacity = lessonTeacherCapacity(state, lesson);
      if (teacherCapacity && teacherCapacity.capacity < Number(lesson.weeklyCount || 0)) {
        const message = makeMessage(
          "error",
          teacherCapacityMessage(state, lesson, teacherCapacity),
          lesson.id
        );
        message.fixTab = "teachers";
        errors.push(message);
      }
      const doubleMode = App.State.getDoubleMode(lesson);
      if (doubleMode === "preferred" && Number(lesson.weeklyCount || 0) >= 2 && Number(lesson.sameDayLimit || 1) < 2) {
        warnings.push(makeMessage("warning", `${lesson.subject || "未設定教科"}で連続配置を優先するには、同じ日に入れる上限を2以上にしてください。`, lesson.id));
      }
      if (doubleMode === "required") {
        if (Number(lesson.weeklyCount || 0) < 2) {
          errors.push(makeMessage("error", `${lesson.subject || "未設定教科"}は2時間連続必須のため、週時数を2以上にしてください。`, lesson.id));
        }
        if (Number(lesson.weeklyCount || 0) % 2 !== 0) {
          errors.push(makeMessage("error", `${lesson.subject || "未設定教科"}は2時間連続必須のため、週時数を偶数にしてください。`, lesson.id));
        }
        if (Number(lesson.sameDayLimit || 1) < 2) {
          warnings.push(makeMessage("warning", `${lesson.subject || "未設定教科"}は2時間連続必須のため、1日上限は2以上が必要です。`, lesson.id));
        }
        if (!hasPotentialDoubleSlot(state, lesson)) {
          const detail = doubleSlotBlockDetail(state, lesson);
          const message = makeMessage(
            "error",
            `${getClassName(state, lesson.classId)} ${lesson.subject || "未設定教科"}は2時間連続で置ける候補枠が見つかりません。${detail.text}`,
            lesson.id
          );
          message.fixTab = detail.tab;
          errors.push(message);
        }
      }
    });

    classes.forEach((klass) => {
      const required = state.lessons
        .filter((lesson) => lesson.classId === klass.id)
        .reduce((sum, lesson) => sum + Number(lesson.weeklyCount || 0), 0);
      if (required > slots.length) {
        errors.push(makeMessage("error", `${klass.name} の必要授業数 ${required} が利用可能時限 ${slots.length} を超えています。`, klass.id));
      } else {
        info.push(makeMessage("info", `${klass.name}: 必要授業数 ${required} / 利用可能時限 ${slots.length}`, klass.id));
      }
    });

    validateCurriculumHours(state, warnings, info);

    const fixedClassSlots = new Map();
    const fixedTeacherSlots = new Map();
    const fixedRoomSlots = new Map();
    state.fixedAssignments.forEach((fixed) => {
      const lesson = App.State.getLesson(state, fixed.lessonId);
      const teacherId = fixed.teacherId || (lesson && lesson.teacherId);
      const roomType = fixed.roomType || (lesson && lesson.roomType);
      const key = slotKey(fixed.day, Number(fixed.period));
      if (!fixed.classId || !fixed.day || !Number(fixed.period) || !fixed.lessonId) {
        errors.push(makeMessage("error", "固定授業に未入力の項目があります。", fixed.id));
        return;
      }
      if (!state.school.days.includes(fixed.day) || Number(fixed.period) > App.State.getDayPeriodLimit(state, fixed.day)) {
        errors.push(makeMessage("error", "固定授業が、学校情報で使わない曜日または時限に入っています。", fixed.id));
      }
      if (!lesson) {
        errors.push(makeMessage("error", "固定授業に対応する授業情報が見つかりません。", fixed.id));
      }
      const classKey = `${fixed.classId}|${key}`;
      if (fixedClassSlots.has(classKey)) {
        errors.push(makeMessage("error", "同じクラスの同じ時限に固定授業が複数あります。", fixed.id));
      }
      fixedClassSlots.set(classKey, fixed.id);
      if (teacherId) {
        const teacherKey = `${teacherId}|${key}`;
        if (fixedTeacherSlots.has(teacherKey)) {
          errors.push(makeMessage("error", "同じ教員の同じ時限に固定授業が複数あります。", fixed.id));
        }
        fixedTeacherSlots.set(teacherKey, fixed.id);
        const teacher = App.State.getTeacher(state, teacherId);
        if (teacher && (teacher.unavailable || []).includes(key)) {
          errors.push(makeMessage("error", `${teacher.name} の勤務不可時間に固定授業があります。`, fixed.id));
        }
      }
      if (roomType && roomType !== "普通教室") {
        const roomKey = `${roomType}|${key}`;
        const roomCount = getRoomCount(state, roomType);
        const used = (fixedRoomSlots.get(roomKey) || 0) + 1;
        fixedRoomSlots.set(roomKey, used);
        if (used > roomCount) {
          errors.push(makeMessage("error", `${roomType} の同じ時限に固定授業が多すぎます。`, fixed.id));
        }
      }
    });

    validateFixedCounts(state, errors);
    validateFixedDoubleInputs(state, errors);

    if (!errors.length) {
      info.unshift(makeMessage("ok", "候補作成に進めます。"));
    }
    return { errors, warnings, info };
  }

  function lessonTeacherCapacity(state, lesson) {
    const teacher = App.State.getTeacher(state, lesson.teacherId);
    if (!teacher) return null;
    const sameDayLimit = Math.max(1, Number(lesson.sameDayLimit || 1));
    const unavailable = new Set(teacher.unavailable || []);
    const workingDays = teacher.partTime ? new Set(teacher.workingDays || []) : null;
    const usableDays = [];
    let capacity = 0;
    state.school.days.forEach((day) => {
      if (workingDays && !workingDays.has(day)) return;
      const dayLimit = App.State.getDayPeriodLimit(state, day);
      let usablePeriods = 0;
      for (let period = 1; period <= dayLimit; period += 1) {
        if (!unavailable.has(slotKey(day, period))) usablePeriods += 1;
      }
      const dayCapacity = Math.min(sameDayLimit, usablePeriods);
      if (dayCapacity > 0) {
        usableDays.push(day);
        capacity += dayCapacity;
      }
    });
    return {
      teacher,
      capacity,
      usableDays,
      sameDayLimit
    };
  }

  function teacherCapacityMessage(state, lesson, detail) {
    const required = Number(lesson.weeklyCount || 0);
    const className = getClassName(state, lesson.classId);
    const teacherName = detail.teacher.name || "担当教員";
    const dayText = detail.usableDays.length ? detail.usableDays.join("・") : "なし";
    if (detail.teacher.partTime) {
      return `${className} ${lesson.subject}は週${required}コマ必要ですが、担当の ${teacherName} の勤務日は ${dayText} で、1日上限${detail.sameDayLimit}コマのため最大${detail.capacity}コマまでしか置けません。勤務日を増やす、担当教員を分ける、または授業の1日上限を見直してください。`;
    }
    return `${className} ${lesson.subject}は週${required}コマ必要ですが、担当の ${teacherName} の勤務不可時間が多く、最大${detail.capacity}コマまでしか置けません。教員の勤務不可時間、担当教員、または授業の1日上限を見直してください。`;
  }

  function validateCurriculumHours(state, warnings, info) {
    const curriculum = App.State.normalizeCurriculum(state.curriculum);
    const subjects = (curriculum.subjects || []).filter((subject) => subject.active !== false && subject.name);
    if (!subjects.length) return;
    const knownNames = new Set(subjects.map((subject) => subject.name));
    const groupedNames = new Set();
    const checks = [];

    state.lessons.forEach((lesson) => {
      if (lesson.subject && !knownNames.has(lesson.subject)) {
        const message = makeMessage("warning", `${lesson.subject} は教育課程マスタにありません。地域独自教科の場合はマスタに追加できます。`, lesson.id);
        message.fixTab = "lessons";
        warnings.push(message);
      }
    });

    if (curriculum.hourCheckMode === "combined") {
      (curriculum.hourGroups || [])
        .filter((group) => group.active !== false && group.name && (group.subjectNames || []).length)
        .forEach((group) => {
          group.subjectNames.forEach((name) => groupedNames.add(name));
          checks.push({
            name: group.name,
            subjectNames: group.subjectNames,
            weeklyByGrade: group.weeklyByGrade || {}
          });
        });
      subjects
        .filter((subject) => !groupedNames.has(subject.name))
        .forEach((subject) => checks.push({
          name: subject.name,
          subjectNames: [subject.name],
          weeklyByGrade: subject.weeklyByGrade || {}
        }));
    } else {
      subjects.forEach((subject) => checks.push({
        name: subject.name,
        subjectNames: [subject.name],
        weeklyByGrade: subject.weeklyByGrade || {}
      }));
    }

    App.State.getClasses(state).forEach((klass) => {
      const classLessons = state.lessons.filter((lesson) => lesson.classId === klass.id);
      checks.forEach((check) => {
        const expected = Number(check.weeklyByGrade?.[klass.grade] || 0);
        if (!expected) return;
        const actual = classLessons
          .filter((lesson) => check.subjectNames.includes(lesson.subject))
          .reduce((sum, lesson) => sum + Number(lesson.weeklyCount || 0), 0);
        if (Math.abs(actual - expected) > 0.75) {
          const message = makeMessage(
            "warning",
            `${klass.name} ${check.name}: 基準 ${formatHours(expected)}コマに対して、実際に生成で使う授業情報は ${formatHours(actual)}コマです。基準を使う場合は、教育課程マスタの教科行で「授業情報へ反映」を押してください。`,
            klass.id
          );
          message.fixTab = "lessons";
          warnings.push(message);
        }
      });
    });
    info.push(makeMessage("info", `教育課程マスタ「${curriculum.name || "未設定"}」で標準時数を確認しています。`, "curriculum"));
  }

  function formatHours(value) {
    return Number(value).toLocaleString("ja-JP", { maximumFractionDigits: 1 });
  }

  function getRoomCount(state, roomType) {
    const total = state.rooms
      .filter((room) => room.type === roomType)
      .reduce((sum, room) => sum + Number(room.count || 0), 0);
    return Math.max(total, 0);
  }

  function hasPotentialDoubleSlot(state, lesson) {
    if (Number(state.school.periodsPerDay || 0) < 2) return false;
    const teacher = App.State.getTeacher(state, lesson.teacherId);
    const unavailable = teacher ? teacher.unavailable || [] : [];
    const workingDays = teacher && teacher.partTime ? new Set(teacher.workingDays || []) : null;
    const lunchBreakAfter = Number(state.school.lunchBreakAfterPeriod || 4);
    return state.school.days.some((day) => {
      if (workingDays && !workingDays.has(day)) return false;
      const dayLimit = App.State.getDayPeriodLimit(state, day);
      for (let period = 1; period < dayLimit; period += 1) {
        if (period === lunchBreakAfter) continue;
        const first = slotKey(day, period);
        const second = slotKey(day, period + 1);
        if (unavailable.includes(first) || unavailable.includes(second)) continue;
        if (lesson.roomType && lesson.roomType !== "普通教室" && getRoomCount(state, lesson.roomType) < 1) continue;
        return true;
      }
      return false;
    });
  }

  function doubleSlotBlockDetail(state, lesson) {
    const teacher = App.State.getTeacher(state, lesson.teacherId);
    const hasTwoPeriodDay = state.school.days.some((day) => App.State.getDayPeriodLimit(state, day) >= 2);
    if (!hasTwoPeriodDay) {
      return {
        tab: "school",
        text: "曜日ごとの使用時限数が少なく、同じ日に連続2コマを置けません。学校情報を確認してください。"
      };
    }
    const roomMissing = lesson.roomType && lesson.roomType !== "普通教室" && getRoomCount(state, lesson.roomType) < 1;
    if (roomMissing) {
      return {
        tab: "rooms",
        text: `「${lesson.roomType}」が教室設定にないか、使える教室数が0です。教室情報を確認してください。`
      };
    }
    if (teacher && teacher.partTime && (!teacher.workingDays || !teacher.workingDays.length)) {
      return {
        tab: "teachers",
        text: `担当の ${teacher.name} は非常勤ですが勤務日が選ばれていません。教員情報で勤務日を選んでください。`
      };
    }
    if (teacher) {
      const unavailable = teacher.unavailable || [];
      const lunchBreakAfter = Number(state.school.lunchBreakAfterPeriod || 4);
      let checkedPair = false;
      const hasTeacherBlockedPair = state.school.days.every((day) => {
        const dayLimit = App.State.getDayPeriodLimit(state, day);
        for (let period = 1; period < dayLimit; period += 1) {
          if (period === lunchBreakAfter) continue;
          checkedPair = true;
          if (!unavailable.includes(slotKey(day, period)) && !unavailable.includes(slotKey(day, period + 1))) return false;
        }
        return true;
      });
      if (checkedPair && hasTeacherBlockedPair) {
        return {
          tab: "teachers",
          text: `担当の ${teacher.name} の勤務日または勤務不可時間が、連続できる2コマをすべてふさいでいます。`
        };
      }
    }
    return {
      tab: "lessons",
      text: "給食をまたがない2コマ、担当教員の勤務時間、教室の空き、曜日ごとの使用時限数を確認してください。"
    };
  }

  function validateFixedCounts(state, errors) {
    state.lessons.forEach((lesson) => {
      const actual = state.fixedAssignments.filter((fixed) => fixed.lessonId === lesson.id).length;
      const expected = Number(lesson.weeklyCount || 0);
      if (actual > expected) {
        errors.push(makeMessage(
          "error",
          `${getClassName(state, lesson.classId)} ${lesson.subject}の固定授業が ${actual} コマあります。授業情報の週時数 ${expected} コマを超えて固定できません。`,
          lesson.id
        ));
      }
    });
  }

  function validateFixedDoubleInputs(state, errors) {
    state.lessons
      .filter((lesson) => App.State.getDoubleMode(lesson) === "required")
      .forEach((lesson) => {
        const fixedEntries = state.fixedAssignments
          .filter((fixed) => fixed.lessonId === lesson.id)
          .map((fixed) => ({ day: fixed.day, period: Number(fixed.period), lesson }));
        if (!fixedEntries.length) return;
        const unpaired = findUnpairedDoubleEntries(state, fixedEntries);
        if (unpaired.length) {
          errors.push(makeMessage(
            "error",
            `${getClassName(state, lesson.classId)} ${lesson.subject}の固定授業は、連続する2コマを両方固定してください。`,
            lesson.id
          ));
        }
      });
  }

  function validateCandidate(state, candidate) {
    const hardViolations = [];
    const classSlots = new Map();
    const teacherSlots = new Map();
    const roomSlots = new Map();
    const counts = new Map();
    const fixedById = new Map(state.fixedAssignments.map((fixed) => [fixed.id, fixed]));

    candidate.entries.forEach((entry) => {
      const key = slotKey(entry.day, entry.period);
      const period = Number(entry.period);
      if (!state.school.days.includes(entry.day)
        || !Number.isInteger(period)
        || period < 1
        || period > App.State.getDayPeriodLimit(state, entry.day)) {
        hardViolations.push(makeViolation("H-013", "学校情報で使わない曜日または時限に授業があります。", entry));
      }
      const classKey = `${entry.classId}|${key}`;
      if (classSlots.has(classKey)) {
        hardViolations.push(makeViolation("H-006", "同じクラスの同じ時限に複数授業があります。", entry));
      }
      classSlots.set(classKey, entry);

      if (entry.teacherId) {
        const teacherKey = `${entry.teacherId}|${key}`;
        if (teacherSlots.has(teacherKey)) {
          hardViolations.push(makeViolation("H-001", "同じ教員が同じ時限に複数クラスを担当しています。", entry));
        }
        teacherSlots.set(teacherKey, entry);
        const teacher = App.State.getTeacher(state, entry.teacherId);
        if (teacher && (teacher.unavailable || []).includes(key)) {
          hardViolations.push(makeViolation("H-004", "教員の勤務不可時間に授業があります。", entry));
        }
      }

      if (entry.roomType && entry.roomType !== "普通教室") {
        const roomKey = `${entry.roomType}|${key}`;
        const nextCount = (roomSlots.get(roomKey) || 0) + 1;
        roomSlots.set(roomKey, nextCount);
        if (nextCount > getRoomCount(state, entry.roomType)) {
          hardViolations.push(makeViolation("H-002", "同じ特別教室が同じ時限に複数授業へ割り当てられています。", entry));
        }
      }

      if (entry.lessonId) {
        counts.set(entry.lessonId, (counts.get(entry.lessonId) || 0) + 1);
      }

      if (entry.fixedId) {
        const fixed = fixedById.get(entry.fixedId);
        if (!fixed || fixed.classId !== entry.classId || fixed.day !== entry.day || Number(fixed.period) !== Number(entry.period)) {
          hardViolations.push(makeViolation("H-005", "固定授業枠が変更されています。", entry));
        }
      }
    });

    state.lessons.forEach((lesson) => {
      const actual = counts.get(lesson.id) || 0;
      const expected = Number(lesson.weeklyCount || 0);
      if (actual !== expected) {
        hardViolations.push({
          id: "H-003",
          text: `${getClassName(state, lesson.classId)} ${lesson.subject}: 必要時数 ${expected} に対して配置 ${actual} です。`,
          ref: lesson.id
        });
      }
    });

    validateClassDayTargets(state, candidate, hardViolations);
    validateRequiredDoublePeriods(state, candidate, hardViolations);
    validateLunchBreakCrossing(state, candidate, hardViolations);
    validateUnexpectedAdjacentLessons(state, candidate, hardViolations);
    validateClassMiddleGaps(state, candidate, hardViolations);

    return hardViolations;
  }

  function validateClassDayTargets(state, candidate, hardViolations) {
    const targets = App.State.getClassDayTargets(state);
    App.State.getClasses(state).forEach((klass) => {
      state.school.days.forEach((day) => {
        const expected = targets.get(`${klass.id}|${day}`);
        if (typeof expected !== "number") return;
        const actual = candidate.entries.filter((entry) => entry.classId === klass.id && entry.day === day).length;
        if (actual !== expected) {
          hardViolations.push({
            id: "H-010",
            text: `${klass.name} ${day}: 通常日課の目標 ${expected} コマに対して配置 ${actual} コマです。`,
            ref: `${klass.id} ${day}`
          });
        }
      });
    });
  }

  function validateRequiredDoublePeriods(state, candidate, hardViolations) {
    state.lessons
      .filter((lesson) => App.State.getDoubleMode(lesson) === "required")
      .forEach((lesson) => {
        const entries = candidate.entries
          .filter((entry) => entry.lessonId === lesson.id)
          .sort((a, b) => slotSortValue(state, a) - slotSortValue(state, b));
        findUnpairedDoubleEntries(state, entries).forEach((entry) => {
          hardViolations.push({
            id: "H-007",
            text: `${getClassName(state, lesson.classId)} ${lesson.subject}: 2時間連続必須ですが、${entry.day}${entry.period}限が連続枠になっていません。`,
            ref: lesson.id
          });
        });
      });
  }

  function validateClassMiddleGaps(state, candidate, hardViolations) {
    const classes = App.State.getClasses(state);
    classes.forEach((klass) => {
      state.school.days.forEach((day) => {
        const periods = candidate.entries
          .filter((entry) => entry.classId === klass.id && entry.day === day)
          .map((entry) => Number(entry.period))
          .filter(Boolean)
          .sort((a, b) => a - b);
        if (!periods.length) return;
        const used = new Set(periods);
        const lastPeriod = Math.max(...periods);
        for (let period = 1; period < lastPeriod; period += 1) {
          if (!used.has(period)) {
            hardViolations.push({
              id: "H-008",
              text: `${klass.name} ${day}${period}限が空きのまま、後ろの時限に授業があります。空きはその日の末尾に寄せてください。`,
              ref: `${klass.id} ${day}${period}`
            });
            return;
          }
        }
      });
    });
  }

  function validateLunchBreakCrossing(state, candidate, hardViolations) {
    const lunchBreakAfter = Number(state.school.lunchBreakAfterPeriod || 4);
    state.lessons.forEach((lesson) => {
      state.school.days.forEach((day) => {
        const entries = candidate.entries
          .filter((entry) => entry.lessonId === lesson.id && entry.day === day)
          .map((entry) => Number(entry.period));
        if (entries.includes(lunchBreakAfter) && entries.includes(lunchBreakAfter + 1)) {
          hardViolations.push({
            id: "H-011",
            text: `${getClassName(state, lesson.classId)} ${lesson.subject}: 2時間続きが給食をまたぐ ${day}${lunchBreakAfter}-${lunchBreakAfter + 1}限 に配置されています。`,
            ref: lesson.id
          });
        }
      });
    });
  }

  function validateUnexpectedAdjacentLessons(state, candidate, hardViolations) {
    state.lessons
      .filter((lesson) => App.State.getDoubleMode(lesson) === "none")
      .forEach((lesson) => {
        state.school.days.forEach((day) => {
          const periods = candidate.entries
            .filter((entry) => entry.lessonId === lesson.id && entry.day === day)
            .map((entry) => Number(entry.period))
            .sort((a, b) => a - b);
          for (let index = 0; index < periods.length - 1; index += 1) {
            if (periods[index + 1] === periods[index] + 1) {
              hardViolations.push({
                id: "H-012",
                text: `${getClassName(state, lesson.classId)} ${lesson.subject}: 2時間続き設定ではない授業が ${day}${periods[index]}-${periods[index + 1]}限 に連続しています。`,
                ref: lesson.id
              });
              return;
            }
          }
        });
      });
  }

  function findUnpairedDoubleEntries(state, entries) {
    const sorted = entries.slice().sort((a, b) => slotSortValue(state, a) - slotSortValue(state, b));
    const used = new Set();
    const unpaired = [];
    sorted.forEach((entry, index) => {
      if (used.has(index)) return;
      const pairIndex = sorted.findIndex((other, otherIndex) => {
        return !used.has(otherIndex)
          && otherIndex !== index
          && other.day === entry.day
          && Math.abs(Number(other.period) - Number(entry.period)) === 1;
      });
      if (pairIndex >= 0) {
        used.add(index);
        used.add(pairIndex);
        return;
      }
      unpaired.push(entry);
    });
    return unpaired;
  }

  function slotSortValue(state, entry) {
    const dayIndex = state.school.days.indexOf(entry.day);
    return dayIndex * 10 + Number(entry.period || 0);
  }

  function makeViolation(id, text, entry) {
    return {
      id,
      text,
      ref: entry ? `${entry.classId} ${entry.day}${entry.period}` : ""
    };
  }

  function getClassName(state, classId) {
    const klass = App.State.getClasses(state).find((item) => item.id === classId);
    return klass ? klass.name : classId;
  }

  App.Validation = {
    validateRequest,
    validateCandidate,
    getRoomCount,
    slotKey,
    lessonKey
  };
})(globalThis);
