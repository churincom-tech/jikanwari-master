(function (global) {
  const App = global.TimetableApp = global.TimetableApp || {};

  function generateCandidates(state, count) {
    const requestValidation = App.Validation.validateRequest(state);
    if (requestValidation.errors.length) {
      return {
        candidates: [],
        validation: requestValidation,
        generationErrors: requestValidation.errors.map((item) => item.text)
      };
    }

    const candidates = [];
    const errors = [];
    for (let seed = 1; seed <= 600 && candidates.length < (count || 3); seed += 1) {
      const attempt = buildCandidate(state, seed);
      if (attempt.hardViolations.length === 0) {
        const scored = App.Scoring.scoreCandidate(state, attempt);
        candidates.push(Object.assign(attempt, scored));
      } else {
        errors.push(...attempt.hardViolations.map((item) => item.text));
      }
    }

    candidates.sort((a, b) => {
      if (a.hardViolations.length !== b.hardViolations.length) {
        return a.hardViolations.length - b.hardViolations.length;
      }
      return b.score - a.score;
    });

    const selected = candidates.slice(0, count || 3).map((candidate, index) => {
      candidate.name = `候補${String.fromCharCode(65 + index)}`;
      return candidate;
    });

    return {
      candidates: selected,
      validation: requestValidation,
      generationErrors: [...new Set(errors)].slice(0, 8)
    };
  }

  function buildCandidate(state, seed) {
    const entries = [];
    const hardViolations = [];
    const occupied = createOccupancy(buildClassDayTargets(state));
    const slots = App.State.getSlots(state);
    const rng = createRng(seed);

    const fixedSorted = state.fixedAssignments.slice().sort((a, b) => {
      return slotSortValue(a) - slotSortValue(b);
    });

    fixedSorted.forEach((fixed) => {
      const lesson = App.State.getLesson(state, fixed.lessonId);
      if (!lesson) {
        hardViolations.push({ id: "H-005", text: "固定授業に対応する授業情報が見つかりません。", ref: fixed.id });
        return;
      }
      const entry = createEntryFromLesson(lesson, fixed.day, Number(fixed.period), true, fixed.id);
      const reason = canPlace(state, entry, occupied);
      if (reason) {
        hardViolations.push({ id: reason.id, text: reason.text, ref: fixed.id });
      } else {
        place(entry, occupied, entries);
      }
    });

    placeClassSchedules(state, entries, occupied, hardViolations, rng, seed);

    const candidate = {
      id: `candidate-${seed}`,
      name: `候補${String.fromCharCode(64 + seed)}`,
      entries,
      hardViolations,
      score: 0,
      breakdown: {},
      warnings: [],
      improvements: []
    };
    candidate.hardViolations = candidate.hardViolations.concat(App.Validation.validateCandidate(state, candidate));
    return candidate;
  }

  function createOccupancy(targetDayLengths) {
    return {
      classSlots: new Set(),
      teacherSlots: new Set(),
      roomSlots: new Map(),
      lessonCounts: new Map(),
      lessonDayPeriods: new Map(),
      teacherDayPeriods: new Map(),
      classDayPeriods: new Map(),
      targetDayLengths: targetDayLengths || new Map()
    };
  }

  function createEntryFromLesson(lesson, day, period, fixed, fixedId) {
    return {
      id: App.State.uid("entry"),
      lessonId: lesson.id,
      classId: lesson.classId,
      subject: lesson.subject,
      teacherId: lesson.teacherId,
      roomType: lesson.roomType || "普通教室",
      day,
      period: Number(period),
      fixed: Boolean(fixed),
      fixedId: fixedId || ""
    };
  }

  function buildTasks(state, existingEntries) {
    const fixedCounts = new Map();
    existingEntries.forEach((entry) => {
      fixedCounts.set(entry.lessonId, (fixedCounts.get(entry.lessonId) || 0) + 1);
    });
    const tasks = [];
    state.lessons.forEach((lesson) => {
      let remaining = Number(lesson.weeklyCount || 0) - (fixedCounts.get(lesson.id) || 0);
      let index = 0;
      if (App.State.getDoubleMode(lesson) === "required") {
        while (remaining >= 2) {
          tasks.push({ lesson, index, size: 2 });
          index += 1;
          remaining -= 2;
        }
      }
      while (remaining > 0) {
        tasks.push({ lesson, index, size: 1 });
        index += 1;
        remaining -= 1;
      }
    });
    return tasks;
  }

  function sortTasks(state, tasks, seed) {
    tasks.sort((a, b) => {
      if ((a.size || 1) !== (b.size || 1)) return (b.size || 1) - (a.size || 1);
      const roomA = a.lesson.roomType && a.lesson.roomType !== "普通教室" ? 1 : 0;
      const roomB = b.lesson.roomType && b.lesson.roomType !== "普通教室" ? 1 : 0;
      if (roomA !== roomB) return roomB - roomA;
      const unavailableA = (App.State.getTeacher(state, a.lesson.teacherId)?.unavailable || []).length;
      const unavailableB = (App.State.getTeacher(state, b.lesson.teacherId)?.unavailable || []).length;
      if (unavailableA !== unavailableB) return unavailableB - unavailableA;
      const weeklyA = Number(a.lesson.weeklyCount || 0);
      const weeklyB = Number(b.lesson.weeklyCount || 0);
      if (weeklyA !== weeklyB) return weeklyB - weeklyA;
      return seededHash(`${a.lesson.id}-${a.index}-${seed}`) - seededHash(`${b.lesson.id}-${b.index}-${seed}`);
    });
  }

  function placeClassSchedules(state, entries, occupied, hardViolations, rng, seed) {
    const classes = App.State.getClasses(state).slice().sort((a, b) => {
      return seededHash(`${a.id}-${seed}`) - seededHash(`${b.id}-${seed}`);
    });

    classes.forEach((klass) => {
      const remaining = remainingLessonCounts(state, klass.id, entries);
      const targetSlots = targetSlotsForClass(state, occupied, klass.id);

      targetSlots.forEach((slot) => {
        if (occupied.classSlots.has(`${klass.id}|${slot.day}-${slot.period}`)) return;
        const choice = chooseLessonForSlot(state, klass.id, slot, remaining, occupied, rng, seed);
        if (!choice) return;
        const blockId = choice.entries.length === 2 ? App.State.uid("block") : "";
        choice.entries.forEach((entry) => {
          if (blockId) {
            entry.blockId = blockId;
            entry.doubleBlock = true;
          }
          place(entry, occupied, entries);
        });
        remaining.set(choice.lesson.id, remaining.get(choice.lesson.id) - choice.entries.length);
      });

      remaining.forEach((count, lessonId) => {
        if (count <= 0) return;
        const lesson = App.State.getLesson(state, lessonId);
        hardViolations.push({
          id: "H-003",
          text: placementFailureText(state, klass, lesson),
          ref: lessonId
        });
      });
    });
  }

  function placementFailureText(state, klass, lesson) {
    if (!lesson) return `${klass.name} 未設定授業 を配置できませんでした。`;
    const teacher = App.State.getTeacher(state, lesson.teacherId);
    if (teacher && teacher.partTime) {
      const workingDays = teacher.workingDays || [];
      const sameDayLimit = Number(lesson.sameDayLimit || 1);
      const capacity = Math.max(0, workingDays.length * sameDayLimit);
      if (capacity < Number(lesson.weeklyCount || 0)) {
        const dayText = workingDays.length ? workingDays.join("・") : "未設定";
        return `${klass.name} ${lesson.subject} を配置できませんでした。担当の ${teacher.name} の勤務日は ${dayText} で、週${lesson.weeklyCount}コマに足りません。`;
      }
    }
    return `${klass.name} ${lesson.subject} を配置できませんでした。担当教員の勤務時間、同じ曜日の上限、固定授業、教室の空きを確認してください。`;
  }

  function remainingLessonCounts(state, classId, entries) {
    const fixedCounts = new Map();
    entries
      .filter((entry) => entry.classId === classId)
      .forEach((entry) => {
        fixedCounts.set(entry.lessonId, (fixedCounts.get(entry.lessonId) || 0) + 1);
      });
    const remaining = new Map();
    state.lessons
      .filter((lesson) => lesson.classId === classId)
      .forEach((lesson) => {
        remaining.set(lesson.id, Math.max(0, Number(lesson.weeklyCount || 0) - (fixedCounts.get(lesson.id) || 0)));
      });
    return remaining;
  }

  function targetSlotsForClass(state, occupied, classId) {
    const slots = [];
    state.school.days.forEach((day) => {
      const length = occupied.targetDayLengths.get(`${classId}|${day}`) || 0;
      for (let period = 1; period <= length; period += 1) {
        slots.push({ day, period, id: `${day}-${period}` });
      }
    });
    return slots;
  }

  function chooseLessonForSlot(state, classId, slot, remaining, occupied, rng, seed) {
    const choices = [];
    const requiredDoubleChoices = [];
    const preferredDoubleChoices = [];
    remaining.forEach((count, lessonId) => {
      if (count <= 0) return;
      const lesson = App.State.getLesson(state, lessonId);
      if (!lesson || lesson.classId !== classId) return;
      const mode = App.State.getDoubleMode(lesson);

      if (mode === "required") {
        if (count < 2) return;
        const targetLength = occupied.targetDayLengths.get(`${classId}|${slot.day}`) || 0;
        if (Number(slot.period) >= targetLength) return;
        const entries = createDoubleEntries(lesson, slot.day, slot.period);
        const reason = canPlaceBlock(state, entries, occupied);
        if (!reason) {
          requiredDoubleChoices.push({
            lesson,
            entries,
            score: choiceScore(state, lesson, slot, occupied, count, rng, seed, 2)
          });
        }
        return;
      }

      if (mode === "preferred" && count >= 2) {
        const targetLength = occupied.targetDayLengths.get(`${classId}|${slot.day}`) || 0;
        if (Number(slot.period) < targetLength) {
          const entries = createDoubleEntries(lesson, slot.day, slot.period);
          const reason = canPlaceBlock(state, entries, occupied);
          if (!reason) {
            preferredDoubleChoices.push({
              lesson,
              entries,
              score: choiceScore(state, lesson, slot, occupied, count, rng, seed, 2) - 36
            });
          }
        }
      }

      const entry = createEntryFromLesson(lesson, slot.day, slot.period, false, "");
      const reason = canPlace(state, entry, occupied);
      if (!reason) {
        choices.push({
          lesson,
          entries: [entry],
          score: choiceScore(state, lesson, slot, occupied, count, rng, seed, 1)
        });
      }
    });

    if (requiredDoubleChoices.length) {
      requiredDoubleChoices.sort((a, b) => a.score - b.score);
      return requiredDoubleChoices[0];
    }
    if (preferredDoubleChoices.length) {
      preferredDoubleChoices.sort((a, b) => a.score - b.score);
      return preferredDoubleChoices[0];
    }
    choices.sort((a, b) => a.score - b.score);
    return choices[0] || null;
  }

  function choiceScore(state, lesson, slot, occupied, remainingCount, rng, seed, size) {
    const sameSubjectDay = occupied.lessonCounts.get(`${lesson.classId}|${lesson.subject}|${slot.day}`) || 0;
    const limit = Number(lesson.sameDayLimit || 1);
    let score = slotPenalty(state, lesson, slot, occupied);
    if (sameSubjectDay >= limit) score += 400 + sameSubjectDay * 40;
    if (size === 2) {
      score += slotPenalty(state, lesson, { day: slot.day, period: Number(slot.period) + 1, id: `${slot.day}-${Number(slot.period) + 1}` }, occupied);
      score -= 24;
    }
    score -= Number(remainingCount || 0) * 12;
    score += seededHash(`${lesson.id}-${slot.day}-${slot.period}-${seed}`) % 29;
    score += rng() * 5;
    return score;
  }

  function rankSlots(state, lesson, slots, occupied, rng, seed) {
    return slots
      .map((slot) => {
        const entry = createEntryFromLesson(lesson, slot.day, slot.period, false, "");
        const reason = canPlace(state, entry, occupied);
        const base = reason ? 9999 : 0;
        return {
          day: slot.day,
          period: slot.period,
          score: base + slotPenalty(state, lesson, slot, occupied) + rng() * 3 + seededHash(`${lesson.id}-${slot.id}-${seed}`) % 5
        };
      })
      .sort((a, b) => a.score - b.score);
  }

  function rankDoubleSlots(state, lesson, slots, occupied, rng, seed) {
    return slots
      .filter((slot) => Number(slot.period) < App.State.getDayPeriodLimit(state, slot.day))
      .map((slot) => {
        const entries = createDoubleEntries(lesson, slot.day, slot.period);
        const reason = canPlaceBlock(state, entries, occupied);
        const base = reason ? 9999 : 0;
        const nextSlot = { day: slot.day, period: Number(slot.period) + 1, id: `${slot.day}-${Number(slot.period) + 1}` };
        return {
          day: slot.day,
          period: slot.period,
          score: base
            + slotPenalty(state, lesson, slot, occupied)
            + slotPenalty(state, lesson, nextSlot, occupied)
            + rng() * 3
            + seededHash(`${lesson.id}-${slot.id}-double-${seed}`) % 5
        };
      })
      .sort((a, b) => a.score - b.score);
  }

  function slotPenalty(state, lesson, slot, occupied) {
    let penalty = 0;
    const sameSubjectDay = occupied.lessonCounts.get(`${lesson.classId}|${lesson.subject}|${slot.day}`) || 0;
    const limit = Number(lesson.sameDayLimit || 1);
    if (sameSubjectDay >= limit) penalty += 22 + sameSubjectDay * 4;
    if (Number(slot.period) >= 5 && ["国語", "数学", "英語"].includes(lesson.subject)) penalty += 4;
    if (lesson.roomType && lesson.roomType !== "普通教室") {
      const roomKey = `${lesson.roomType}|${slot.day}-${slot.period}`;
      const used = occupied.roomSlots.get(roomKey) || 0;
      penalty += used * 20;
    }
    const teacherDayPeriods = occupied.teacherDayPeriods?.get(`${lesson.teacherId}|${slot.day}`) || [];
    if (teacherDayPeriods.includes(Number(slot.period) - 1) || teacherDayPeriods.includes(Number(slot.period) + 1)) {
      penalty += 1;
    }
    if (App.State.getDoubleMode(lesson) === "preferred") {
      const lessonDayPeriods = occupied.lessonDayPeriods?.get(`${lesson.id}|${slot.day}`) || [];
      const hasAdjacent = lessonDayPeriods.includes(Number(slot.period) - 1) || lessonDayPeriods.includes(Number(slot.period) + 1);
      penalty += hasAdjacent ? -10 : 4;
    }
    penalty += classMiddleGapPenalty(lesson.classId, slot.day, slot.period, occupied);
    return penalty;
  }

  function classMiddleGapPenalty(classId, day, period, occupied) {
    const periods = occupied.classDayPeriods?.get(`${classId}|${day}`) || [];
    const used = new Set(periods.map(Number));
    let firstOpen = 1;
    while (used.has(firstOpen)) firstOpen += 1;
    const numericPeriod = Number(period);
    if (numericPeriod <= firstOpen) return 0;
    return (numericPeriod - firstOpen) * 350;
  }

  function buildClassDayTargets(state) {
    return App.State.getClassDayTargets(state);
  }

  function createDoubleEntries(lesson, day, period) {
    return [
      createEntryFromLesson(lesson, day, Number(period), false, ""),
      createEntryFromLesson(lesson, day, Number(period) + 1, false, "")
    ];
  }

  function canPlaceBlock(state, blockEntries, occupied) {
    if (crossesLunchBreak(state, blockEntries)) {
      return { id: "H-011", text: "2時間続きの授業は4限と5限をまたげません。" };
    }
    const draft = cloneOccupancy(occupied);
    for (const entry of blockEntries) {
      const reason = canPlace(state, entry, draft);
      if (reason) return reason;
      place(entry, draft, []);
    }
    return null;
  }

  function cloneOccupancy(occupied) {
    return {
      classSlots: new Set(occupied.classSlots),
      teacherSlots: new Set(occupied.teacherSlots),
      roomSlots: new Map(occupied.roomSlots),
      lessonCounts: new Map(occupied.lessonCounts),
      lessonDayPeriods: clonePeriodMap(occupied.lessonDayPeriods),
      teacherDayPeriods: clonePeriodMap(occupied.teacherDayPeriods),
      classDayPeriods: clonePeriodMap(occupied.classDayPeriods),
      targetDayLengths: occupied.targetDayLengths
    };
  }

  function clonePeriodMap(map) {
    const next = new Map();
    (map || new Map()).forEach((value, key) => {
      next.set(key, value.slice());
    });
    return next;
  }

  function canPlace(state, entry, occupied) {
    const key = `${entry.day}-${entry.period}`;
    const lesson = App.State.getLesson(state, entry.lessonId);
    if (occupied.classSlots.has(`${entry.classId}|${key}`)) {
      return { id: "H-006", text: `${getClassName(state, entry.classId)} の ${entry.day}${entry.period}限が重複しています。` };
    }
    const targetLength = occupied.targetDayLengths?.get(`${entry.classId}|${entry.day}`);
    if (typeof targetLength === "number" && Number(entry.period) > targetLength) {
      return { id: "H-010", text: `${getClassName(state, entry.classId)} の ${entry.day} は ${targetLength}限までに収めます。` };
    }
    if (!entry.fixed) {
      const classDayKey = `${entry.classId}|${entry.day}`;
      const periods = occupied.classDayPeriods?.get(classDayKey) || [];
      const used = new Set(periods.map(Number));
      let firstOpen = 1;
      while (used.has(firstOpen)) firstOpen += 1;
      if (Number(entry.period) > firstOpen) {
        return { id: "H-008", text: `${getClassName(state, entry.classId)} の ${entry.day}${firstOpen}限が空いたまま後ろに授業を置くことはできません。` };
      }
    }
    if (lesson && App.State.getDoubleMode(lesson) === "none") {
      const lessonPeriods = occupied.lessonDayPeriods?.get(`${entry.lessonId}|${entry.day}`) || [];
      if (lessonPeriods.includes(Number(entry.period) - 1) || lessonPeriods.includes(Number(entry.period) + 1)) {
        return { id: "H-012", text: `${getClassName(state, entry.classId)} ${entry.subject} は2時間続き設定ではないため連続配置できません。` };
      }
    }
    if (entry.teacherId) {
      if (occupied.teacherSlots.has(`${entry.teacherId}|${key}`)) {
        return { id: "H-001", text: `${getTeacherName(state, entry.teacherId)} が ${entry.day}${entry.period}限で重複しています。` };
      }
      const teacher = App.State.getTeacher(state, entry.teacherId);
      if (teacher && (teacher.unavailable || []).includes(key)) {
        return { id: "H-004", text: `${teacher.name} は ${entry.day}${entry.period}限に勤務不可です。` };
      }
    }
    if (entry.roomType && entry.roomType !== "普通教室") {
      const roomKey = `${entry.roomType}|${key}`;
      const used = occupied.roomSlots.get(roomKey) || 0;
      const count = App.Validation.getRoomCount(state, entry.roomType);
      if (used >= count) {
        return { id: "H-002", text: `${entry.roomType} が ${entry.day}${entry.period}限で不足しています。` };
      }
    }
    return null;
  }

  function crossesLunchBreak(state, entries) {
    const lunchBreakAfter = Number(state.school.lunchBreakAfterPeriod || 4);
    const byDay = new Map();
    entries.forEach((entry) => {
      const periods = byDay.get(entry.day) || [];
      periods.push(Number(entry.period));
      byDay.set(entry.day, periods);
    });
    for (const periods of byDay.values()) {
      if (periods.includes(lunchBreakAfter) && periods.includes(lunchBreakAfter + 1)) return true;
    }
    return false;
  }

  function place(entry, occupied, entries) {
    const key = `${entry.day}-${entry.period}`;
    occupied.classSlots.add(`${entry.classId}|${key}`);
    if (entry.teacherId) occupied.teacherSlots.add(`${entry.teacherId}|${key}`);
    if (entry.roomType && entry.roomType !== "普通教室") {
      const roomKey = `${entry.roomType}|${key}`;
      occupied.roomSlots.set(roomKey, (occupied.roomSlots.get(roomKey) || 0) + 1);
    }
    const lessonDayKey = `${entry.classId}|${entry.subject}|${entry.day}`;
    occupied.lessonCounts.set(lessonDayKey, (occupied.lessonCounts.get(lessonDayKey) || 0) + 1);
    occupied.lessonDayPeriods = occupied.lessonDayPeriods || new Map();
    const lessonPeriodKey = `${entry.lessonId}|${entry.day}`;
    const lessonPeriods = occupied.lessonDayPeriods.get(lessonPeriodKey) || [];
    lessonPeriods.push(entry.period);
    occupied.lessonDayPeriods.set(lessonPeriodKey, lessonPeriods);
    occupied.teacherDayPeriods = occupied.teacherDayPeriods || new Map();
    const teacherDayKey = `${entry.teacherId}|${entry.day}`;
    const periods = occupied.teacherDayPeriods.get(teacherDayKey) || [];
    periods.push(entry.period);
    occupied.teacherDayPeriods.set(teacherDayKey, periods);
    occupied.classDayPeriods = occupied.classDayPeriods || new Map();
    const classDayKey = `${entry.classId}|${entry.day}`;
    const classPeriods = occupied.classDayPeriods.get(classDayKey) || [];
    classPeriods.push(entry.period);
    occupied.classDayPeriods.set(classDayKey, classPeriods);
    entries.push(entry);
  }

  function slotSortValue(fixed) {
    const dayIndex = App.Constants.DAYS.indexOf(fixed.day);
    return dayIndex * 10 + Number(fixed.period || 0);
  }

  function createRng(seed) {
    let value = seed * 9301 + 49297;
    return function () {
      value = (value * 233280 + 49297) % 2147483647;
      return value / 2147483647;
    };
  }

  function seededHash(text) {
    let hash = 0;
    for (let index = 0; index < text.length; index += 1) {
      hash = (hash * 31 + text.charCodeAt(index)) >>> 0;
    }
    return hash;
  }

  function getClassName(state, classId) {
    const klass = App.State.getClasses(state).find((item) => item.id === classId);
    return klass ? klass.name : classId;
  }

  function getTeacherName(state, teacherId) {
    const teacher = App.State.getTeacher(state, teacherId);
    return teacher ? teacher.name : teacherId;
  }

  App.TimetableCore = {
    generateCandidates,
    buildCandidate
  };
})(globalThis);
