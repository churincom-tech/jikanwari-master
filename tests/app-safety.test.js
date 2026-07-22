const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const projectRoot = path.resolve(__dirname, "..");
const scriptFiles = [
  "app/scripts/state.js",
  "app/scripts/sample-data.js",
  "app/scripts/validation.js",
  "app/scripts/scoring.js",
  "app/scripts/timetable-core.js",
  "app/scripts/import-export.js"
];

for (const relativePath of scriptFiles) {
  const absolutePath = path.join(projectRoot, relativePath);
  vm.runInThisContext(fs.readFileSync(absolutePath, "utf8"), { filename: absolutePath });
}

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

function envelope(state, version = 2) {
  return {
    app: App.ImportExport.APP_ID,
    version,
    exportedAt: "2026-07-17T00:00:00.000Z",
    state
  };
}

function expectImportError(payload, code) {
  assert.throws(
    () => App.ImportExport.inspectImportPayload(payload),
    (error) => error && error.code === code
  );
}

test("empty object is rejected instead of replacing the current state", () => {
  expectImportError({}, "MISSING_SCHOOL");
});

test("another application's JSON is rejected", () => {
  expectImportError({ app: "another-app", version: 2, state: sampleState() }, "APP_MISMATCH");
});

test("unsupported versions are rejected", () => {
  expectImportError(envelope(sampleState(), 99), "UNSUPPORTED_VERSION");
});

test("missing required arrays are rejected", () => {
  const state = sampleState();
  delete state.rooms;
  expectImportError(envelope(state), "MISSING_REQUIRED_ARRAY");
});

test("duplicate entity IDs are rejected", () => {
  const state = sampleState();
  state.teachers[1].id = state.teachers[0].id;
  expectImportError(envelope(state), "INVALID_ENTITY_ID");
});

test("empty, duplicate, or unsupported school days are rejected", () => {
  const state = sampleState();
  state.school.days = ["月", "月"];
  expectImportError(envelope(state), "INVALID_SCHOOL");
});

test("version 1 exports remain readable and produce a preview summary", () => {
  const state = sampleState();
  state.candidates = [];
  state.selectedCandidateId = null;
  const plan = App.ImportExport.inspectImportPayload(envelope(state, 1));
  assert.equal(plan.summary.version, 1);
  assert.equal(plan.summary.teachers, state.teachers.length);
  assert.equal(plan.summary.lessons, state.lessons.length);
  assert.match(App.ImportExport.formatImportSummary(plan), /現在の入力内容をこのデータで置き換えますか/);
});

test("legacy raw state remains readable with a migration warning", () => {
  const state = sampleState();
  const plan = App.ImportExport.inspectImportPayload(state);
  assert.equal(plan.summary.legacy, true);
  assert.ok(plan.warnings.some((warning) => warning.includes("旧形式")));
});

test("inspection is transactional and does not mutate the source payload", () => {
  const state = sampleState();
  const before = JSON.stringify(state);
  const plan = App.ImportExport.inspectImportPayload(envelope(state));
  plan.state.school.name = "変更後";
  assert.equal(JSON.stringify(state), before);
});

test("malformed saved candidates are discarded without losing input data", () => {
  const state = sampleState();
  state.candidates = [{
    id: "broken-candidate",
    name: "壊れた候補",
    entries: [{ lessonId: "missing", classId: "g1-1", day: "月", period: 1 }]
  }];
  state.selectedCandidateId = "broken-candidate";
  const plan = App.ImportExport.inspectImportPayload(envelope(state));
  assert.equal(plan.state.candidates.length, 0);
  assert.equal(plan.state.selectedCandidateId, null);
  assert.equal(plan.state.lessons.length, state.lessons.length);
  assert.ok(plan.warnings.some((warning) => warning.includes("破棄")));
});

test("valid saved candidates are preserved and revalidated", () => {
  const state = sampleState();
  const generated = App.TimetableCore.generateCandidates(state, 1);
  assert.equal(generated.candidates.length, 1);
  state.candidates = generated.candidates;
  state.selectedCandidateId = generated.candidates[0].id;
  const plan = App.ImportExport.inspectImportPayload(envelope(state, 1));
  assert.equal(plan.state.candidates.length, 1);
  assert.equal(plan.state.candidates[0].entries.length, generated.candidates[0].entries.length);
  assert.equal(plan.state.candidates[0].hardViolations.length, 0);
  assert.equal(typeof plan.state.candidates[0].score, "number");
});

test("teacher deletion reports impact, clears references, and keeps the source immutable", () => {
  const state = sampleState();
  const targetLesson = state.lessons.find((lesson) => lesson.teacherId);
  assert.ok(targetLesson);
  const teacherId = targetLesson.teacherId;
  state.fixedAssignments.push({
    id: "test-fixed-teacher",
    lessonId: targetLesson.id,
    classId: targetLesson.classId,
    day: state.school.days[0],
    period: 1,
    teacherId
  });
  state.candidates = [{ id: "old", entries: [] }];
  state.selectedCandidateId = "old";
  const before = JSON.stringify(state);
  const expectedLessonCount = state.lessons.filter((lesson) => lesson.teacherId === teacherId).length;
  const impact = App.State.getTeacherDeletionImpact(state, teacherId);
  const next = App.State.removeTeacher(state, teacherId);

  assert.equal(impact.lessonCount, expectedLessonCount);
  assert.ok(impact.fixedAssignmentCount >= 1);
  assert.equal(JSON.stringify(state), before);
  assert.equal(next.teachers.some((teacher) => teacher.id === teacherId), false);
  assert.equal(next.lessons.some((lesson) => lesson.teacherId === teacherId), false);
  assert.equal(next.fixedAssignments.some((fixed) => fixed.teacherId === teacherId), false);
  assert.equal(next.candidates.length, 0);
  assert.equal(next.selectedCandidateId, null);
});

test("lesson deletion reports impact, removes fixed slots, and keeps the source immutable", () => {
  const state = sampleState();
  const lesson = state.lessons[0];
  state.fixedAssignments.push({
    id: "test-fixed-lesson",
    lessonId: lesson.id,
    classId: lesson.classId,
    day: state.school.days[0],
    period: 1,
    teacherId: lesson.teacherId
  });
  state.candidates = [{ id: "old", entries: [] }];
  state.selectedCandidateId = "old";
  const before = JSON.stringify(state);
  const impact = App.State.getLessonDeletionImpact(state, lesson.id);
  const next = App.State.removeLesson(state, lesson.id);

  assert.ok(impact.fixedAssignmentCount >= 1);
  assert.equal(JSON.stringify(state), before);
  assert.equal(next.lessons.some((item) => item.id === lesson.id), false);
  assert.equal(next.fixedAssignments.some((fixed) => fixed.lessonId === lesson.id), false);
  assert.equal(next.candidates.length, 0);
  assert.equal(next.selectedCandidateId, null);
});

test("existing sample generation still yields three valid complete candidates", () => {
  const state = sampleState();
  const expectedEntries = state.lessons.reduce((sum, lesson) => sum + Number(lesson.weeklyCount || 0), 0);
  const result = App.TimetableCore.generateCandidates(state, 3);
  assert.equal(result.candidates.length, 3);
  result.candidates.forEach((candidate) => {
    assert.equal(candidate.entries.length, expectedEntries);
    assert.equal(candidate.hardViolations.length, 0);
    assert.equal(App.Validation.validateCandidate(state, candidate).length, 0);
  });
});

console.log(`\nRESULT ${passed} passed, ${failed} failed`);
if (failed > 0) process.exitCode = 1;
