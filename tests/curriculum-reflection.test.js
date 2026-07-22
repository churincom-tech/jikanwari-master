const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const projectRoot = path.resolve(__dirname, "..");
[
  "app/scripts/state.js",
  "app/scripts/sample-data.js",
  "app/scripts/validation.js",
  "app/scripts/scoring.js",
  "app/scripts/timetable-core.js"
].forEach((relativePath) => {
  const absolutePath = path.join(projectRoot, relativePath);
  vm.runInThisContext(fs.readFileSync(absolutePath, "utf8"), { filename: absolutePath });
});

const App = globalThis.TimetableApp;
let passed = 0;
let failed = 0;

function test(name, run) {
  try {
    run();
    passed += 1;
    console.log(`PASS ${name}`);
  } catch (error) {
    failed += 1;
    console.error(`FAIL ${name}`);
    console.error(error.stack || error);
  }
}

function sampleState() {
  return App.State.normalizeState(App.SampleData.createSampleState());
}

function artMaster(state) {
  return state.curriculum.subjects.find((subject) => subject.id === "art");
}

function artLessons(state) {
  return state.lessons.filter((lesson) => lesson.curriculumSubjectId === "art");
}

function configureReportedArtCase(state) {
  const art = artMaster(state);
  art.weeklyByGrade[1] = 2;
  art.weeklyByGrade[2] = 2;
  art.weeklyByGrade[3] = 2;
  art.defaultRoomType = "美術室";
  art.defaultDoubleMode = "required";
}

test("reported grade 2 and 3 Art mismatch is reproduced before sync", () => {
  const state = sampleState();
  configureReportedArtCase(state);
  const upperGradeLessons = artLessons(state).filter((lesson) => lesson.classId.startsWith("g2-") || lesson.classId.startsWith("g3-"));
  assert.equal(upperGradeLessons.length, 4);
  assert.ok(upperGradeLessons.every((lesson) => Number(lesson.weeklyCount) === 1));
  assert.ok(upperGradeLessons.every((lesson) => App.State.getDoubleMode(lesson) === "none"));
  const warnings = App.Validation.validateRequest(state).warnings.filter((message) => message.text.includes("美術"));
  assert.equal(warnings.length, 4);
  assert.ok(warnings.every((message) => message.fixTab === "lessons"));
  assert.ok(warnings.every((message) => message.text.includes("授業情報へ反映")));
});

test("curriculum Art settings sync to all existing class lessons and generate adjacent pairs", () => {
  const state = sampleState();
  configureReportedArtCase(state);
  state.candidates = [{ id: "stale-candidate" }];
  state.selectedCandidateId = "stale-candidate";
  const teacherIdsBefore = artLessons(state).map((lesson) => lesson.teacherId);
  const plan = App.State.getCurriculumSubjectSyncPlan(state, "art");
  assert.equal(plan.lessonCount, 6);
  assert.equal(plan.changeCount, 4);
  assert.deepEqual(plan.blockers, []);

  const applied = App.State.applyCurriculumSubjectToLessons(state, "art").state;
  assert.equal(applied.candidates.length, 0);
  assert.equal(applied.selectedCandidateId, null);
  assert.deepEqual(artLessons(applied).map((lesson) => lesson.teacherId), teacherIdsBefore);
  artLessons(applied).forEach((lesson) => {
    assert.equal(Number(lesson.weeklyCount), 2);
    assert.equal(lesson.roomType, "美術室");
    assert.equal(App.State.getDoubleMode(lesson), "required");
    assert.ok(Number(lesson.sameDayLimit) >= 2);
  });

  const requestValidation = App.Validation.validateRequest(applied);
  assert.equal(requestValidation.errors.length, 0);
  assert.equal(requestValidation.warnings.filter((message) => message.text.includes("美術")).length, 0);
  const generated = App.TimetableCore.generateCandidates(applied, 3);
  assert.equal(generated.candidates.length, 3);
  generated.candidates.forEach((candidate) => {
    assert.equal(candidate.entries.length, 178);
    assert.equal(candidate.hardViolations.length, 0);
    assert.equal(App.Validation.validateCandidate(applied, candidate).length, 0);
    artLessons(applied)
      .filter((lesson) => lesson.classId.startsWith("g2-") || lesson.classId.startsWith("g3-"))
      .forEach((lesson) => {
        const entries = candidate.entries.filter((entry) => entry.lessonId === lesson.id);
        assert.equal(entries.length, 2);
        assert.equal(entries[0].day, entries[1].day);
        assert.equal(Math.abs(Number(entries[0].period) - Number(entries[1].period)), 1);
      });
  });
});

test("curriculum subject identity survives a master rename", () => {
  const state = sampleState();
  const art = artMaster(state);
  art.name = "芸術";
  const plan = App.State.getCurriculumSubjectSyncPlan(state, "art");
  assert.equal(plan.lessonCount, 6);
  const applied = App.State.applyCurriculumSubjectToLessons(state, "art").state;
  assert.ok(artLessons(applied).every((lesson) => lesson.subject === "芸術"));
});

test("room sync preserves teacher and fixed time while updating the fixed room", () => {
  const state = sampleState();
  const art = artMaster(state);
  art.defaultRoomType = "第2美術室";
  state.rooms.push({ id: "room-art-2", name: "第2美術室", type: "第2美術室", count: 1 });
  const lesson = artLessons(state).find((item) => item.classId === "g2-1");
  const teacherId = lesson.teacherId;
  state.fixedAssignments.push({
    id: "fixed-art-room-sync",
    classId: lesson.classId,
    day: "火",
    period: 3,
    lessonId: lesson.id,
    teacherId,
    roomType: "美術室"
  });

  const applied = App.State.applyCurriculumSubjectToLessons(state, "art").state;
  const appliedLesson = App.State.getLesson(applied, lesson.id);
  const appliedFixed = applied.fixedAssignments.find((fixed) => fixed.id === "fixed-art-room-sync");
  assert.equal(appliedLesson.teacherId, teacherId);
  assert.equal(appliedLesson.roomType, "第2美術室");
  assert.ok(Number(appliedLesson.sameDayLimit) >= 2);
  assert.equal(appliedFixed.teacherId, teacherId);
  assert.equal(appliedFixed.roomType, "第2美術室");
  assert.equal(appliedFixed.day, "火");
  assert.equal(appliedFixed.period, 3);
});

test("preferred double placement keeps a usable same-day limit", () => {
  const state = sampleState();
  const lesson = artLessons(state).find((item) => item.classId === "g2-1");
  lesson.weeklyCount = 2;
  lesson.doubleMode = "preferred";
  lesson.allowDouble = true;
  lesson.sameDayLimit = 1;
  const warnings = App.Validation.validateRequest(state).warnings;
  assert.ok(warnings.some((message) => message.text.includes("同じ日に入れる上限を2以上")));
  const normalized = App.State.normalizeState(state);
  const normalizedLesson = App.State.getLesson(normalized, lesson.id);
  assert.equal(normalizedLesson.sameDayLimit, 2);
});

test("unsafe fractional or duplicate lesson sync is blocked without mutation", () => {
  const fractionalState = sampleState();
  artMaster(fractionalState).weeklyByGrade[3] = 0.5;
  const before = JSON.stringify(fractionalState);
  const fractionalPlan = App.State.getCurriculumSubjectSyncPlan(fractionalState, "art");
  assert.ok(fractionalPlan.blockers.some((message) => message.includes("週0.5コマ")));
  assert.throws(
    () => App.State.applyCurriculumSubjectToLessons(fractionalState, "art"),
    (error) => error && error.code === "CURRICULUM_SYNC_BLOCKED"
  );
  assert.equal(JSON.stringify(fractionalState), before);

  const duplicateState = sampleState();
  const duplicate = App.State.clone(artLessons(duplicateState)[0]);
  duplicate.id = "duplicate-art";
  duplicateState.lessons.push(duplicate);
  const duplicatePlan = App.State.getCurriculumSubjectSyncPlan(duplicateState, "art");
  assert.ok(duplicatePlan.blockers.some((message) => message.includes("授業情報が2件")));

  const inactiveState = sampleState();
  artMaster(inactiveState).active = false;
  const inactivePlan = App.State.getCurriculumSubjectSyncPlan(inactiveState, "art");
  assert.ok(inactivePlan.blockers.some((message) => message.includes("自動削除しません")));
  assert.equal(artLessons(inactiveState).length, 6);
});

test("combined curriculum groups are not flattened into unsafe per-subject hours", () => {
  const state = sampleState();
  const technologyPlan = App.State.getCurriculumSubjectSyncPlan(state, "technology");
  assert.ok(technologyPlan.blockers.some((message) => message.includes("技術・家庭")));
  assert.throws(
    () => App.State.applyCurriculumSubjectToLessons(state, "technology"),
    (error) => error && error.code === "CURRICULUM_SYNC_BLOCKED"
  );
});

console.log(`SUMMARY ${passed} passed / ${failed} failed`);
if (failed) process.exitCode = 1;
