(function (global) {
  const App = global.TimetableApp = global.TimetableApp || {};
  const MAJOR_SUBJECTS = new Set(["国語", "社会", "数学", "理科", "英語"]);

  function scoreCandidate(state, candidate) {
    const warnings = [];
    const improvements = [];
    const breakdown = {
      majorSubjectBias: 0,
      sameDaySubject: 0,
      teacherGaps: 0,
      teacherConsecutive: 0,
      specialRoomSpread: 0,
      partTimeAttendance: 0,
      classDailyLoad: 0,
      doublePreferred: 0
    };

    if (softConstraintEnabled(state, "S-001")) scoreMajorSubjectBias(state, candidate, breakdown, warnings, improvements);
    if (softConstraintEnabled(state, "S-005")) scorePartTimeAttendance(state, candidate, breakdown, warnings, improvements);
    if (softConstraintEnabled(state, "S-002")) scoreSameDaySubjects(state, candidate, breakdown, warnings, improvements);
    if (softConstraintEnabled(state, "S-003")) scoreTeacherLoad(state, candidate, breakdown, warnings, improvements);
    if (softConstraintEnabled(state, "S-004")) scoreSpecialRoomSpread(candidate, breakdown, warnings, improvements);
    if (softConstraintEnabled(state, "S-006")) scoreClassDailyLoad(state, candidate, breakdown, warnings, improvements);
    if (softConstraintEnabled(state, "S-007")) scorePreferredDoublePeriods(state, candidate, breakdown, warnings, improvements);

    const penalty = Object.values(breakdown).reduce((sum, value) => sum + value, 0);
    const hardPenalty = (candidate.hardViolations || []).length * 100;
    const score = Math.max(0, Math.round(100 - penalty - hardPenalty));
    return { score, breakdown, warnings, improvements };
  }

  function softConstraintEnabled(state, id) {
    const saved = state.constraints && Array.isArray(state.constraints.soft)
      ? state.constraints.soft.find((item) => item.id === id)
      : null;
    return saved ? saved.enabled !== false : true;
  }

  function scoreMajorSubjectBias(state, candidate, breakdown, warnings, improvements) {
    const days = state.school.days || [];
    if (!days.length) return;
    const lunchBreakAfter = Number(state.school.lunchBreakAfterPeriod || 4);
    const totalAvailableSlots = days.reduce((sum, day) => sum + App.State.getDayPeriodLimit(state, day), 0);
    const afternoonAvailableSlots = days.reduce((sum, day) => {
      return sum + Math.max(0, App.State.getDayPeriodLimit(state, day) - lunchBreakAfter);
    }, 0);
    const normalAfternoonShare = totalAvailableSlots ? afternoonAvailableSlots / totalAvailableSlots : 0;

    App.State.getClasses(state).forEach((klass) => {
      const entries = candidate.entries.filter((entry) => entry.classId === klass.id && MAJOR_SUBJECTS.has(entry.subject));
      if (!entries.length) return;
      const dayCounts = days.map((day) => entries.filter((entry) => entry.day === day).length);
      const dayLimit = Math.ceil(entries.length / days.length) + 1;
      const dayOver = dayCounts.reduce((sum, count) => sum + Math.max(0, count - dayLimit), 0);
      const afternoonCount = entries.filter((entry) => Number(entry.period) > lunchBreakAfter).length;
      const allowedAfternoon = Math.ceil(entries.length * Math.min(1, normalAfternoonShare + 0.1));
      const afternoonOver = Math.max(0, afternoonCount - allowedAfternoon);

      if (dayOver > 0) {
        breakdown.majorSubjectBias += dayOver * 2;
        warnings.push(`${klass.name} は主要教科が特定曜日に偏っています（最多 ${Math.max(...dayCounts)} コマ）。`);
        improvements.push(`${klass.name} の主要教科を別の曜日へ分散すると学習負荷が整います。`);
      }
      if (afternoonOver > 0) {
        breakdown.majorSubjectBias += afternoonOver * 2;
        warnings.push(`${klass.name} は主要教科が${lunchBreakAfter + 1}限以降に ${afternoonCount} コマあり、午後へ偏っています。`);
        improvements.push(`${klass.name} の主要教科を午前にも移すと時間帯の偏りが下がります。`);
      }
    });
  }

  function scoreSameDaySubjects(state, candidate, breakdown, warnings, improvements) {
    const grouped = new Map();
    candidate.entries.forEach((entry) => {
      const lesson = App.State.getLesson(state, entry.lessonId);
      const limit = lesson ? Number(lesson.sameDayLimit || 1) : 1;
      const key = `${entry.classId}|${entry.subject}|${entry.day}`;
      const list = grouped.get(key) || { count: 0, limit, entry };
      list.count += 1;
      grouped.set(key, list);
    });
    grouped.forEach((value) => {
      if (value.count > value.limit) {
        const over = value.count - value.limit;
        breakdown.sameDaySubject += over * 4;
        warnings.push(`${getClassName(state, value.entry.classId)} の ${value.entry.subject} が ${value.entry.day} に ${value.count} 回あります。`);
        improvements.push(`${value.entry.subject} の一部を別日に移すと偏りが下がります。`);
      }
    });
  }

  function scoreTeacherLoad(state, candidate, breakdown, warnings, improvements) {
    const byTeacherDay = new Map();
    candidate.entries.forEach((entry) => {
      const key = `${entry.teacherId}|${entry.day}`;
      const periods = byTeacherDay.get(key) || [];
      periods.push(Number(entry.period));
      byTeacherDay.set(key, periods);
    });
    byTeacherDay.forEach((periods, key) => {
      periods.sort((a, b) => a - b);
      const [teacherId, day] = key.split("|");
      const teacher = App.State.getTeacher(state, teacherId);
      let maxRun = 1;
      let run = 1;
      for (let index = 1; index < periods.length; index += 1) {
        if (periods[index] === periods[index - 1] + 1) {
          run += 1;
          maxRun = Math.max(maxRun, run);
        } else {
          run = 1;
        }
      }
      const span = periods[periods.length - 1] - periods[0] + 1;
      const gaps = Math.max(0, span - periods.length);
      if (gaps >= 3) {
        breakdown.teacherGaps += gaps;
        warnings.push(`${teacher ? teacher.name : teacherId} の ${day} は空き時間が ${gaps} あります。`);
      }
      if (maxRun >= 4) {
        breakdown.teacherConsecutive += (maxRun - 3) * 3;
        warnings.push(`${teacher ? teacher.name : teacherId} の ${day} は ${maxRun} 連続授業です。`);
        improvements.push(`${teacher ? teacher.name : teacherId} の連続授業を分散すると負荷が下がります。`);
      }
    });
  }

  function scoreSpecialRoomSpread(candidate, breakdown, warnings, improvements) {
    const byRoomDay = new Map();
    candidate.entries
      .filter((entry) => entry.roomType && entry.roomType !== "普通教室")
      .forEach((entry) => {
        const key = `${entry.roomType}|${entry.day}`;
        byRoomDay.set(key, (byRoomDay.get(key) || 0) + 1);
      });
    byRoomDay.forEach((count, key) => {
      if (count >= 5) {
        const [roomType, day] = key.split("|");
        breakdown.specialRoomSpread += count - 4;
        warnings.push(`${day} に ${roomType} の利用が集中しています。`);
        improvements.push(`${roomType} 利用を別日に分散すると調整しやすくなります。`);
      }
    });
  }

  function scorePartTimeAttendance(state, candidate, breakdown, warnings, improvements) {
    state.teachers
      .filter((teacher) => teacher.partTime)
      .forEach((teacher) => {
        const entries = candidate.entries.filter((entry) => entry.teacherId === teacher.id);
        if (!entries.length) return;
        const scheduledDays = new Set(entries.map((entry) => entry.day)).size;
        const dailyCapacity = Math.max(1, ...state.school.days.map((day) => App.State.getDayPeriodLimit(state, day)));
        const minimumByCapacity = Math.ceil(entries.length / dailyCapacity);
        const lessonCounts = new Map();
        entries.forEach((entry) => lessonCounts.set(entry.lessonId, (lessonCounts.get(entry.lessonId) || 0) + 1));
        let minimumByLesson = 1;
        lessonCounts.forEach((count, lessonId) => {
          const lesson = App.State.getLesson(state, lessonId);
          const sameDayLimit = Math.max(1, Number(lesson && lesson.sameDayLimit || 1));
          minimumByLesson = Math.max(minimumByLesson, Math.ceil(count / sameDayLimit));
        });
        const minimumDays = Math.max(1, minimumByCapacity, minimumByLesson);
        const excessDays = Math.max(0, scheduledDays - minimumDays);
        if (excessDays > 0) {
          breakdown.partTimeAttendance += excessDays * 2;
          warnings.push(`${teacher.name || "非常勤教員"} は週 ${scheduledDays} 日出勤で、授業数からは ${minimumDays} 日まで集約できる可能性があります。`);
          improvements.push(`${teacher.name || "非常勤教員"} の授業を同じ曜日へ寄せると出勤日を減らせます。`);
        }
      });
  }

  function scoreClassDailyLoad(state, candidate, breakdown, warnings, improvements) {
    const classes = App.State.getClasses(state);
    classes.forEach((klass) => {
      const loads = state.school.days.map((day) => {
        return candidate.entries.filter((entry) => entry.classId === klass.id && entry.day === day).length;
      });
      const max = Math.max(...loads);
      const min = Math.min(...loads);
      if (max - min >= 3) {
        breakdown.classDailyLoad += (max - min) * 2;
        warnings.push(`${klass.name} は曜日ごとの授業数に偏りがあります。`);
        improvements.push(`${klass.name} の重い曜日から軽い曜日へ授業を移すと均等になります。`);
      }
    });
  }

  function scorePreferredDoublePeriods(state, candidate, breakdown, warnings, improvements) {
    state.lessons
      .filter((lesson) => App.State.getDoubleMode(lesson) === "preferred")
      .forEach((lesson) => {
        const entries = candidate.entries
          .filter((entry) => entry.lessonId === lesson.id)
          .sort((a, b) => slotSortValue(state, a) - slotSortValue(state, b));
        let pairs = 0;
        const used = new Set();
        entries.forEach((entry, index) => {
          if (used.has(index)) return;
          const pairIndex = entries.findIndex((other, otherIndex) => {
            return !used.has(otherIndex)
              && otherIndex !== index
              && other.day === entry.day
              && Number(other.period) === Number(entry.period) + 1;
          });
          if (pairIndex >= 0) {
            used.add(index);
            used.add(pairIndex);
            pairs += 1;
          }
        });
        const desiredPairs = Math.floor(entries.length / 2);
        const missingPairs = Math.max(0, desiredPairs - pairs);
        if (missingPairs > 0) {
          breakdown.doublePreferred += missingPairs * 2;
          warnings.push(`${getClassName(state, lesson.classId)} の ${lesson.subject} は2時間連続が望ましい設定ですが、連続枠が不足しています。`);
          improvements.push(`${lesson.subject} を連続する2コマへ寄せると実技・実験の運用がしやすくなります。`);
        }
      });
  }

  function slotSortValue(state, entry) {
    const dayIndex = state.school.days.indexOf(entry.day);
    return dayIndex * 10 + Number(entry.period || 0);
  }

  function getClassName(state, classId) {
    const klass = App.State.getClasses(state).find((item) => item.id === classId);
    return klass ? klass.name : classId;
  }

  App.Scoring = {
    scoreCandidate
  };
})(globalThis);
