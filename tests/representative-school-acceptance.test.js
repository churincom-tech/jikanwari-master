const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { performance } = require("node:perf_hooks");

const projectRoot = path.resolve(__dirname, "..");
for (const relativePath of [
  "app/scripts/state.js",
  "app/scripts/sample-data.js",
  "app/scripts/validation.js",
  "app/scripts/scoring.js",
  "app/scripts/timetable-core.js"
]) {
  const absolutePath = path.join(projectRoot, relativePath);
  vm.runInThisContext(fs.readFileSync(absolutePath, "utf8"), { filename: absolutePath });
}

const App = globalThis.TimetableApp;
const results = [];
const acceptance = {};

function test(name, run) {
  const started = performance.now();
  try {
    const detail = run() || {};
    results.push({ name, result: "PASS", durationMs: Math.round(performance.now() - started), detail });
    console.log(`PASS ${name}`);
  } catch (error) {
    results.push({ name, result: "FAIL", durationMs: Math.round(performance.now() - started), error: error.message });
    console.error(`FAIL ${name}`);
    console.error(error.stack || error);
  }
}

function sampleState() {
  return App.State.normalizeState(App.SampleData.createSampleState());
}

function clone(value) {
  return App.State.clone(value);
}

function generate(state, count = 3) {
  const started = performance.now();
  const result = App.TimetableCore.generateCandidates(state, count);
  return { result, durationMs: Math.round(performance.now() - started) };
}

function violationIds(state, candidate) {
  return new Set(App.Validation.validateCandidate(state, candidate).map((violation) => violation.id));
}

function candidateWithEntries(candidate, entries) {
  return Object.assign({}, clone(candidate), { entries });
}

function expectCandidateViolation(state, candidate, id) {
  const ids = violationIds(state, candidate);
  assert.ok(ids.has(id), `Expected ${id}; detected ${[...ids].join(", ") || "none"}`);
}

function auditCandidate(state, candidate) {
  const fixedMissing = state.fixedAssignments.filter((fixed) => {
    return !candidate.entries.some((entry) => entry.fixedId === fixed.id
      && entry.lessonId === fixed.lessonId
      && entry.classId === fixed.classId
      && entry.day === fixed.day
      && Number(entry.period) === Number(fixed.period));
  });
  const unavailableAssignments = candidate.entries.filter((entry) => {
    const teacher = App.State.getTeacher(state, entry.teacherId);
    return teacher && (teacher.unavailable || []).includes(`${entry.day}-${entry.period}`);
  });
  const dailyLoads = {};
  let maximumDailyRange = 0;
  for (const klass of App.State.getClasses(state)) {
    const loads = state.school.days.map((day) => candidate.entries.filter((entry) => entry.classId === klass.id && entry.day === day).length);
    dailyLoads[klass.name] = loads;
    maximumDailyRange = Math.max(maximumDailyRange, Math.max(...loads) - Math.min(...loads));
  }
  const majorSubjects = new Set(["国語", "社会", "数学", "理科", "英語"]);
  const majorEntries = candidate.entries.filter((entry) => majorSubjects.has(entry.subject));
  const afternoonMajor = majorEntries.filter((entry) => Number(entry.period) >= 5).length;
  const partTimeAttendanceDays = state.teachers
    .filter((teacher) => teacher.partTime)
    .map((teacher) => ({
      teacher: teacher.name,
      workingDays: (teacher.workingDays || []).length,
      scheduledDays: new Set(candidate.entries.filter((entry) => entry.teacherId === teacher.id).map((entry) => entry.day)).size
    }));
  return {
    fixedMissing: fixedMissing.length,
    unavailableAssignments: unavailableAssignments.length,
    dailyLoads,
    maximumDailyRange,
    majorAfternoonRatio: majorEntries.length ? Number((afternoonMajor / majorEntries.length).toFixed(3)) : 0,
    partTimeAttendanceDays
  };
}

function createConstrainedScenario(baseState, knownFeasibleCandidate) {
  const state = clone(baseState);
  const existingFixed = new Set(state.fixedAssignments.map((fixed) => `${fixed.lessonId}|${fixed.day}|${fixed.period}`));
  const addedFixed = [];
  for (const klass of App.State.getClasses(state)) {
    const entries = knownFeasibleCandidate.entries.filter((entry) => {
      const lesson = App.State.getLesson(state, entry.lessonId);
      return entry.classId === klass.id && !entry.fixed && App.State.getDoubleMode(lesson) === "none";
    });
    const selected = [
      entries.find((entry) => entry.roomType !== "普通教室"),
      entries.find((entry) => entry.roomType === "普通教室")
    ].filter(Boolean);
    for (const entry of selected) {
      const key = `${entry.lessonId}|${entry.day}|${entry.period}`;
      if (existingFixed.has(key)) continue;
      existingFixed.add(key);
      addedFixed.push({
        id: `accept-fixed-${addedFixed.length + 1}`,
        lessonId: entry.lessonId,
        classId: entry.classId,
        day: entry.day,
        period: entry.period,
        teacherId: entry.teacherId,
        roomType: entry.roomType
      });
    }
  }
  state.fixedAssignments.push(...addedFixed);

  const busyByTeacher = new Map();
  for (const entry of knownFeasibleCandidate.entries) {
    const busy = busyByTeacher.get(entry.teacherId) || new Set();
    busy.add(`${entry.day}-${entry.period}`);
    busyByTeacher.set(entry.teacherId, busy);
  }
  const unavailableAdded = [];
  const busiestTeachers = state.teachers
    .slice()
    .sort((left, right) => (busyByTeacher.get(right.id)?.size || 0) - (busyByTeacher.get(left.id)?.size || 0))
    .slice(0, 8);
  for (const teacher of busiestTeachers) {
    const openSlot = App.State.getSlots(state).find((slot) => !(busyByTeacher.get(teacher.id) || new Set()).has(slot.id));
    if (!openSlot) continue;
    teacher.unavailable = [...new Set([...(teacher.unavailable || []), openSlot.id])];
    unavailableAdded.push({ teacher: teacher.name, slot: openSlot.id });
  }
  state.validation = App.Validation.validateRequest(state);
  return { state, addedFixed, unavailableAdded };
}

function fixedFromLesson(lesson, id, day, period) {
  return {
    id,
    lessonId: lesson.id,
    classId: lesson.classId,
    day,
    period,
    teacherId: lesson.teacherId,
    roomType: lesson.roomType
  };
}

test("baseline representative school input and generation", () => {
  const state = sampleState();
  const validation = App.Validation.validateRequest(state);
  assert.equal(validation.errors.length, 0);
  const generated = generate(state, 3);
  assert.equal(generated.result.candidates.length, 3);
  const expectedEntries = state.lessons.reduce((sum, lesson) => sum + Number(lesson.weeklyCount || 0), 0);
  const audits = generated.result.candidates.map((candidate) => {
    assert.equal(candidate.entries.length, expectedEntries);
    assert.equal(candidate.hardViolations.length, 0);
    assert.equal(App.Validation.validateCandidate(state, candidate).length, 0);
    const audit = auditCandidate(state, candidate);
    assert.equal(audit.fixedMissing, 0);
    assert.equal(audit.unavailableAssignments, 0);
    assert.ok(audit.maximumDailyRange <= 1);
    return audit;
  });
  assert.deepEqual(generated.result.candidates.map((candidate) => candidate.score), [68, 57, 41]);
  acceptance.baseline = {
    school: "3 grades x 2 classes, 5 days x 6 periods",
    teachers: state.teachers.length,
    partTimeTeachers: state.teachers.filter((teacher) => teacher.partTime).length,
    rooms: state.rooms.length,
    lessons: state.lessons.length,
    fixedAssignments: state.fixedAssignments.length,
    weeklyEntries: expectedEntries,
    durationMs: generated.durationMs,
    signature: generated.result.candidates.map((candidate) => ({ id: candidate.id, score: candidate.score, entries: candidate.entries.length })),
    candidates: generated.result.candidates.map((candidate, index) => ({
      score: candidate.score,
      warnings: candidate.warnings.length,
      improvements: candidate.improvements.length,
      breakdown: candidate.breakdown,
      audit: audits[index]
    }))
  };
  acceptance.baselineCandidate = clone(generated.result.candidates[0]);
  acceptance.baselineState = clone(state);
  return acceptance.baseline;
});

test("known-feasible constrained school scenario", () => {
  assert.ok(acceptance.baselineState && acceptance.baselineCandidate);
  const scenario = createConstrainedScenario(acceptance.baselineState, acceptance.baselineCandidate);
  assert.equal(scenario.addedFixed.length, 12);
  assert.equal(scenario.unavailableAdded.length, 8);
  assert.equal(scenario.state.validation.errors.length, 0);
  const generated = generate(scenario.state, 3);
  assert.equal(generated.result.candidates.length, 3);
  const audits = generated.result.candidates.map((candidate) => {
    assert.equal(candidate.entries.length, 174);
    assert.equal(candidate.hardViolations.length, 0);
    assert.equal(App.Validation.validateCandidate(scenario.state, candidate).length, 0);
    const audit = auditCandidate(scenario.state, candidate);
    assert.equal(audit.fixedMissing, 0);
    assert.equal(audit.unavailableAssignments, 0);
    assert.ok(audit.maximumDailyRange <= 1);
    return audit;
  });
  acceptance.constrained = {
    totalFixedAssignments: scenario.state.fixedAssignments.length,
    addedFixedAssignments: scenario.addedFixed.length,
    addedUnavailableSlots: scenario.unavailableAdded.length,
    durationMs: generated.durationMs,
    scores: generated.result.candidates.map((candidate) => candidate.score),
    warnings: generated.result.candidates.map((candidate) => candidate.warnings.length),
    maximumDailyRanges: audits.map((audit) => audit.maximumDailyRange)
  };
  return acceptance.constrained;
});

test("H-001 through H-013 detection probes", () => {
  const state = clone(acceptance.baselineState);
  const valid = clone(acceptance.baselineCandidate);
  const sameSlot = valid.entries.reduce((groups, entry) => {
    const key = `${entry.day}|${entry.period}`;
    const list = groups.get(key) || [];
    list.push(entry);
    groups.set(key, list);
    return groups;
  }, new Map());
  const slotGroup = [...sameSlot.values()].find((entries) => entries.length >= 2 && entries[0].classId !== entries[1].classId);
  assert.ok(slotGroup);

  let entries = clone(valid.entries);
  const firstIndex = entries.findIndex((entry) => entry.id === slotGroup[0].id);
  const secondIndex = entries.findIndex((entry) => entry.id === slotGroup[1].id);
  entries[secondIndex].teacherId = entries[firstIndex].teacherId;
  expectCandidateViolation(state, candidateWithEntries(valid, entries), "H-001");

  entries = clone(valid.entries);
  entries[firstIndex].roomType = "理科室";
  entries[secondIndex].roomType = "理科室";
  expectCandidateViolation(state, candidateWithEntries(valid, entries), "H-002");

  entries = clone(valid.entries);
  entries.splice(0, 1);
  expectCandidateViolation(state, candidateWithEntries(valid, entries), "H-003");

  const unavailableState = clone(state);
  const unavailableEntry = valid.entries.find((entry) => entry.teacherId);
  const unavailableTeacher = App.State.getTeacher(unavailableState, unavailableEntry.teacherId);
  unavailableTeacher.unavailable = [...new Set([...(unavailableTeacher.unavailable || []), `${unavailableEntry.day}-${unavailableEntry.period}`])];
  expectCandidateViolation(unavailableState, valid, "H-004");

  entries = clone(valid.entries);
  const fixedEntry = entries.find((entry) => entry.fixedId);
  assert.ok(fixedEntry);
  fixedEntry.day = state.school.days.find((day) => day !== fixedEntry.day);
  expectCandidateViolation(state, candidateWithEntries(valid, entries), "H-005");

  entries = clone(valid.entries);
  entries.push(Object.assign({}, entries[0], { id: "accept-duplicate-entry" }));
  expectCandidateViolation(state, candidateWithEntries(valid, entries), "H-006");

  entries = clone(valid.entries);
  const requiredLesson = state.lessons.find((lesson) => App.State.getDoubleMode(lesson) === "required");
  const requiredEntries = entries.filter((entry) => entry.lessonId === requiredLesson.id);
  assert.ok(requiredEntries.length >= 2);
  requiredEntries[1].day = state.school.days.find((day) => day !== requiredEntries[0].day);
  requiredEntries[1].period = 1;
  expectCandidateViolation(state, candidateWithEntries(valid, entries), "H-007");

  entries = clone(valid.entries);
  const classDayGroup = [...new Set(entries.map((entry) => `${entry.classId}|${entry.day}`))]
    .map((key) => {
      const [classId, day] = key.split("|");
      return { classId, day, entries: entries.filter((entry) => entry.classId === classId && entry.day === day) };
    })
    .find((group) => group.entries.length < App.State.getDayPeriodLimit(state, group.day) && group.entries.some((entry) => Number(entry.period) === 1));
  assert.ok(classDayGroup);
  const firstPeriod = classDayGroup.entries.find((entry) => Number(entry.period) === 1);
  firstPeriod.period = App.State.getDayPeriodLimit(state, classDayGroup.day);
  expectCandidateViolation(state, candidateWithEntries(valid, entries), "H-008");

  const overflowState = clone(state);
  const overflowLesson = overflowState.lessons[0];
  overflowState.fixedAssignments = overflowState.fixedAssignments.filter((fixed) => fixed.lessonId !== overflowLesson.id);
  const overflowSlots = App.State.getSlots(overflowState).slice(0, Number(overflowLesson.weeklyCount) + 1);
  overflowSlots.forEach((slot, index) => overflowState.fixedAssignments.push(fixedFromLesson(overflowLesson, `overflow-${index}`, slot.day, slot.period)));
  assert.ok(App.Validation.validateRequest(overflowState).errors.some((error) => /超えて|週時数/.test(error.text)));

  entries = clone(valid.entries);
  const targets = App.State.getClassDayTargets(state);
  let dayMove = null;
  for (const klass of App.State.getClasses(state)) {
    const orderedDays = state.school.days
      .map((day) => ({ day, target: targets.get(`${klass.id}|${day}`) }))
      .sort((left, right) => left.target - right.target);
    const shortDay = orderedDays[0];
    const longDay = orderedDays[orderedDays.length - 1];
    if (shortDay.target >= longDay.target) continue;
    const movable = entries.find((entry) => entry.classId === klass.id && entry.day === longDay.day && !entry.fixed);
    if (movable) {
      dayMove = { movable, shortDay, longDay };
      break;
    }
  }
  assert.ok(dayMove);
  dayMove.movable.day = dayMove.shortDay.day;
  dayMove.movable.period = dayMove.shortDay.target + 1;
  expectCandidateViolation(state, candidateWithEntries(valid, entries), "H-010");

  entries = clone(valid.entries);
  entries[0].period = App.State.getDayPeriodLimit(state, entries[0].day) + 1;
  expectCandidateViolation(state, candidateWithEntries(valid, entries), "H-013");

  entries = clone(valid.entries);
  const lunchPair = entries.filter((entry) => entry.lessonId === requiredLesson.id).slice(0, 2);
  lunchPair[0].day = state.school.days[0];
  lunchPair[0].period = 4;
  lunchPair[1].day = state.school.days[0];
  lunchPair[1].period = 5;
  expectCandidateViolation(state, candidateWithEntries(valid, entries), "H-011");

  entries = clone(valid.entries);
  const ordinaryLesson = state.lessons.find((lesson) => App.State.getDoubleMode(lesson) === "none" && Number(lesson.weeklyCount) >= 2);
  const ordinaryEntries = entries.filter((entry) => entry.lessonId === ordinaryLesson.id).slice(0, 2);
  ordinaryEntries[0].day = state.school.days[0];
  ordinaryEntries[0].period = 1;
  ordinaryEntries[1].day = state.school.days[0];
  ordinaryEntries[1].period = 2;
  expectCandidateViolation(state, candidateWithEntries(valid, entries), "H-012");

  acceptance.hardConstraintCoverage = ["H-001", "H-002", "H-003", "H-004", "H-005", "H-006", "H-007", "H-008", "H-009", "H-010", "H-011", "H-012", "H-013"];
  return { covered: acceptance.hardConstraintCoverage.length };
});

test("conflicting and incomplete inputs are blocked with diagnostics", () => {
  const base = clone(acceptance.baselineState);
  const byTeacher = new Map();
  for (const lesson of base.lessons) {
    const lessons = byTeacher.get(lesson.teacherId) || [];
    lessons.push(lesson);
    byTeacher.set(lesson.teacherId, lessons);
  }
  const teacherLessons = [...byTeacher.values()].find((lessons) => new Set(lessons.map((lesson) => lesson.classId)).size >= 2);
  assert.ok(teacherLessons);
  const teacherState = clone(base);
  teacherState.fixedAssignments = [
    fixedFromLesson(teacherLessons[0], "teacher-conflict-1", "月", 1),
    fixedFromLesson(teacherLessons.find((lesson) => lesson.classId !== teacherLessons[0].classId), "teacher-conflict-2", "月", 1)
  ];
  const teacherErrors = App.Validation.validateRequest(teacherState).errors.map((error) => error.text);
  assert.ok(teacherErrors.some((text) => /教員|担当/.test(text)));

  const specialLessons = base.lessons.filter((lesson) => lesson.roomType && lesson.roomType !== "普通教室");
  let roomPair = null;
  for (const first of specialLessons) {
    const second = specialLessons.find((lesson) => lesson.id !== first.id && lesson.roomType === first.roomType && lesson.teacherId !== first.teacherId && lesson.classId !== first.classId);
    if (second) { roomPair = [first, second]; break; }
  }
  assert.ok(roomPair);
  const roomState = clone(base);
  roomState.fixedAssignments = [
    fixedFromLesson(roomPair[0], "room-conflict-1", "月", 1),
    fixedFromLesson(roomPair[1], "room-conflict-2", "月", 1)
  ];
  const roomErrors = App.Validation.validateRequest(roomState).errors.map((error) => error.text);
  assert.ok(roomErrors.some((text) => /室/.test(text)));

  const partTimeState = clone(base);
  const partTimeTeacher = partTimeState.teachers.find((teacher) => teacher.partTime);
  assert.ok(partTimeTeacher);
  partTimeTeacher.workingDays = [];
  const partTimeErrors = App.Validation.validateRequest(partTimeState).errors.map((error) => error.text);
  assert.ok(partTimeErrors.some((text) => /非常勤|勤務日/.test(text)));

  acceptance.inputDiagnostics = {
    teacherConflict: teacherErrors[0],
    roomConflict: roomErrors.find((text) => /室/.test(text)),
    partTimeWorkingDays: partTimeErrors.find((text) => /非常勤|勤務日/.test(text))
  };
  return { diagnosticTypes: 3 };
});

test("soft-constraint coverage and independent operational metrics", () => {
  const state = clone(acceptance.baselineState);
  const candidate = clone(acceptance.baselineCandidate);
  const breakdownKeys = new Set(Object.keys(candidate.breakdown));
  const implementationCoverage = {
    "S-001": breakdownKeys.has("majorSubjectBias"),
    "S-002": breakdownKeys.has("sameDaySubject"),
    "S-003": breakdownKeys.has("teacherGaps") && breakdownKeys.has("teacherConsecutive"),
    "S-004": breakdownKeys.has("specialRoomSpread"),
    "S-005": breakdownKeys.has("partTimeAttendance"),
    "S-006": breakdownKeys.has("classDailyLoad"),
    "S-007": breakdownKeys.has("doublePreferred")
  };
  const preferredState = clone(state);
  const preferredLesson = preferredState.lessons.find((lesson) => App.State.getDoubleMode(lesson) === "none" && Number(lesson.weeklyCount) >= 2);
  preferredLesson.doubleMode = "preferred";
  preferredLesson.allowDouble = true;
  const preferredScore = App.Scoring.scoreCandidate(preferredState, candidate);
  assert.ok(preferredScore.breakdown.doublePreferred > 0);

  const biasedCandidate = clone(candidate);
  const firstClassId = App.State.getClasses(state)[0].id;
  biasedCandidate.entries
    .filter((entry) => entry.classId === firstClassId && ["国語", "社会", "数学", "理科", "英語"].includes(entry.subject))
    .forEach((entry, index) => {
      entry.day = state.school.days[0];
      entry.period = Number(state.school.lunchBreakAfterPeriod || 4) + 1 + (index % 2);
    });
  const biasedScore = App.Scoring.scoreCandidate(state, biasedCandidate);
  assert.ok(biasedScore.breakdown.majorSubjectBias > 0);
  assert.ok(candidate.breakdown.partTimeAttendance > 0);

  const disabledState = clone(state);
  disabledState.constraints.soft.find((item) => item.id === "S-001").enabled = false;
  disabledState.constraints.soft.find((item) => item.id === "S-005").enabled = false;
  const disabledScore = App.Scoring.scoreCandidate(disabledState, biasedCandidate);
  assert.equal(disabledScore.breakdown.majorSubjectBias, 0);
  assert.equal(disabledScore.breakdown.partTimeAttendance, 0);

  const audit = auditCandidate(state, candidate);
  assert.ok(audit.majorAfternoonRatio >= 0 && audit.majorAfternoonRatio <= 1);
  assert.ok(audit.partTimeAttendanceDays.length > 0);
  assert.deepEqual(Object.entries(implementationCoverage).filter(([, covered]) => !covered).map(([id]) => id), []);
  acceptance.softConstraints = {
    implementationCoverage,
    uncoveredInAppScoring: [],
    sampleNotExercisedBeforeProbe: ["S-007"],
    majorSubjectProbePenalty: biasedScore.breakdown.majorSubjectBias,
    partTimeBaselinePenalty: candidate.breakdown.partTimeAttendance,
    preferredProbePenalty: preferredScore.breakdown.doublePreferred,
    disabledProbe: { majorSubjectBias: disabledScore.breakdown.majorSubjectBias, partTimeAttendance: disabledScore.breakdown.partTimeAttendance },
    independentMajorAfternoonRatio: audit.majorAfternoonRatio,
    independentPartTimeAttendanceDays: audit.partTimeAttendanceDays
  };
  return acceptance.softConstraints;
});

test("generation is reproducible for the representative sample", () => {
  const state = clone(acceptance.baselineState);
  const rerun = generate(state, 3);
  const signature = (candidates) => candidates.map((candidate) => ({ id: candidate.id, score: candidate.score, entries: candidate.entries.length }));
  assert.deepEqual(signature(rerun.result.candidates), acceptance.baseline.signature);
  acceptance.reproducibility = { durationMs: rerun.durationMs, signature: signature(rerun.result.candidates) };
  return acceptance.reproducibility;
});

const failed = results.filter((result) => result.result === "FAIL");
delete acceptance.baselineCandidate;
delete acceptance.baselineState;
acceptance.verdict = failed.length ? "TEST_FAILURE" : "HARD_AND_SOFT_IMPLEMENTATION_PASS";
acceptance.evidenceBoundary = "Representative scenario derived from project assumptions; not actual-school evidence.";
console.log(`\nRESULT ${results.length - failed.length} passed, ${failed.length} failed`);
console.log(`ACCEPTANCE_SUMMARY ${JSON.stringify({ results, acceptance }, null, 2)}`);
if (failed.length) process.exitCode = 1;
