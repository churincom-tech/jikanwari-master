(function (global) {
  const App = global.TimetableApp = global.TimetableApp || {};
  let state = App.ImportExport.loadLocal() || App.State.createBlankState();
  let activeTab = "school";
  let resultViewMode = "single";
  let fixedBoardClassId = "";
  let fixedBoardLessonId = "";
  let undoSnapshot = null;
  let undoMessage = "";

  const TAB_SEQUENCE = ["school", "teachers", "rooms", "lessons", "fixed", "results"];
  const TAB_META = {
    school: {
      label: "1 学校情報",
      title: "学校の基本情報を入力しましょう",
      text: "時間割の土台になる曜日、時限、学年、クラス数を先に整えます。",
      next: "教員へ",
      stage: "1"
    },
    teachers: {
      label: "2 授業情報: 教員",
      title: "担当教員を入力しましょう",
      text: "教員名と勤務不可時間を入れると、同時担当や勤務不可を避けやすくなります。",
      next: "教室へ",
      stage: "2"
    },
    rooms: {
      label: "2 授業情報: 教室",
      title: "使う教室を確認しましょう",
      text: "理科室、体育館、音楽室など、同時に使える数を設定します。",
      next: "授業へ",
      stage: "2"
    },
    lessons: {
      label: "2 授業情報: 授業",
      title: "クラスごとの授業を入力しましょう",
      text: "教科、週時数、担当教員、必要な教室をそろえると候補作成に進めます。",
      next: "条件へ",
      stage: "2"
    },
    fixed: {
      label: "3 条件設定",
      title: "守りたい条件を確認しましょう",
      text: "固定授業や勤務不可時間を確認してから、候補を作成します。",
      next: "候補作成へ",
      stage: "3"
    },
    results: {
      label: "4 結果確認",
      title: "時間割候補を見比べましょう",
      text: "候補ごとのスコア、違反、警告を見て、採用しやすい案を選びます。",
      next: "条件設定へ戻る",
      stage: "4"
    }
  };

  Object.assign(TAB_META.school, {
    label: "1 学校情報",
    title: "まずは学校情報を入力します",
    text: "曜日、時限、学年、クラス数を決めると、必要な授業枠の全体量が見えてきます。",
    next: "教員情報入力へ進む"
  });
  Object.assign(TAB_META.teachers, {
    label: "2 授業情報・教員",
    title: "担当教員を入力します",
    text: "教員名と勤務できない時間を入れておくと、作成時に重なりを避けられます。",
    next: "教室情報入力へ進む"
  });
  Object.assign(TAB_META.rooms, {
    label: "2 授業情報・教室",
    title: "使う教室を確認します",
    text: "理科室、体育館、音楽室、美術室、技術室、家庭科室などをそろえます。",
    next: "授業情報入力へ進む"
  });
  Object.assign(TAB_META.lessons, {
    label: "2 授業情報・授業",
    title: "授業情報をそろえます",
    text: "教科、週時数、担当教員、教室、配置ルールを選びます。",
    next: "条件設定へ進む"
  });
  Object.assign(TAB_META.fixed, {
    label: "3 条件設定",
    title: "守りたい条件を確認します",
    text: "固定授業は表のマスをクリックして設定できます。必ず守る条件とできれば守る条件もここで確認します。",
    next: "この条件で時間割を作る"
  });
  Object.assign(TAB_META.results, {
    label: "4 結果確認",
    title: "時間割候補を確認します",
    text: "1クラスずつ確認することも、全クラスを並べて印刷やPDF保存をすることもできます。",
    next: "条件設定へ戻る"
  });

  document.addEventListener("DOMContentLoaded", init);

  function init() {
    bindGlobalActions();
    renderAll();
    runValidation();
  }

  function bindGlobalActions() {
    document.querySelectorAll(".tab").forEach((button) => {
      button.addEventListener("click", () => switchTab(button.dataset.tab));
    });
    document.getElementById("loadSampleButton").addEventListener("click", loadSampleAndGenerate);
    const standardSampleButton = document.getElementById("useStandardSampleButton");
    if (standardSampleButton) standardSampleButton.addEventListener("click", loadSampleAndGenerate);
    document.getElementById("resetButton").addEventListener("click", resetToBlank);
    const validateButton = document.getElementById("validateButton");
    if (validateButton) validateButton.addEventListener("click", guidePrimaryAction);
    const generateButton = document.getElementById("generateButton");
    if (generateButton) generateButton.addEventListener("click", generate);
    const railGenerateButton = document.getElementById("railGenerateButton");
    if (railGenerateButton) railGenerateButton.addEventListener("click", generateFromCurrent);
    document.getElementById("nextStepButton").addEventListener("click", goNext);
    document.getElementById("backStepButton").addEventListener("click", goBack);
    document.querySelectorAll("[data-result-view]").forEach((button) => {
      button.addEventListener("click", () => {
        resultViewMode = button.dataset.resultView === "all" ? "all" : "single";
        renderSelectedCandidate();
      });
    });
    document.getElementById("printResultButton").addEventListener("click", printSelectedCandidate);
    document.getElementById("exportButton").addEventListener("click", () => App.ImportExport.exportJson(state));
    document.getElementById("importInput").addEventListener("change", async (event) => {
      const file = event.target.files[0];
      if (!file) return;
      const previousState = App.State.clone(state);
      let replaced = false;
      try {
        const plan = await App.ImportExport.importJson(file);
        if (!confirm(App.ImportExport.formatImportSummary(plan))) return;
        state = plan.state;
        replaced = true;
        renderAll();
        runValidation();
        setUndoSnapshot(previousState, "JSONファイルの読込");
      } catch (error) {
        if (replaced) {
          state = App.State.normalizeState(previousState);
          renderAll();
          runValidation();
        }
        const message = error && (error.userMessage || error.message);
        alert(`JSONを読み込めませんでした。\n${message || "ファイル内容を確認してください。"}`);
      } finally {
        event.target.value = "";
      }
    });
    document.getElementById("addTeacherButton").addEventListener("click", () => {
      state.teachers.push({ id: App.State.uid("teacher"), name: "新規教員", subjects: [], unavailable: [], partTime: false });
      renderTeachers();
      touch();
    });
    document.getElementById("addRoomButton").addEventListener("click", () => {
      state.rooms.push({ id: App.State.uid("room"), name: "新規教室", type: "普通教室", count: 1 });
      renderRooms();
      renderLessons();
      renderFixed();
      touch();
    });
    document.getElementById("addLessonButton").addEventListener("click", () => {
      const firstClass = App.State.getClasses(state)[0];
      const firstTeacher = state.teachers[0];
      const defaultSubject = defaultLessonSubject();
      const doubleMode = defaultSubject.defaultDoubleMode || "none";
      state.lessons.push({
        id: App.State.uid("lesson"),
        classId: firstClass ? firstClass.id : "",
        subject: defaultSubject.name,
        curriculumSubjectId: defaultSubject.id || "",
        weeklyCount: doubleMode === "required" ? 2 : 1,
        teacherId: firstTeacher ? firstTeacher.id : "",
        roomType: defaultSubject.defaultRoomType,
        sameDayLimit: doubleMode !== "none" ? 2 : 1,
        allowDouble: doubleMode !== "none",
        doubleMode
      });
      renderLessons();
      renderFixed();
      touch();
    });
    document.getElementById("addFixedButton").addEventListener("click", () => {
      const firstLesson = state.lessons.find((lesson) => remainingFixedSlots(lesson) > 0);
      if (!firstLesson) {
        alert("固定できる残りコマがある授業がありません。授業情報の週時数を増やすか、既存の固定授業を解除してください。");
        return;
      }
      state.fixedAssignments.push({
        id: App.State.uid("fixed"),
        classId: firstLesson.classId,
        day: state.school.days[0] || "月",
        period: 1,
        lessonId: firstLesson.id,
        teacherId: firstLesson.teacherId,
        roomType: firstLesson.roomType
      });
      renderFixed();
      touch();
    });
  }

  function renderAll() {
    renderSchool();
    renderTeachers();
    renderRooms();
    renderCurriculumPanel();
    renderSubjectSuggestions();
    renderLessons();
    renderFixed();
    renderStatus();
    renderCandidates();
    renderClassSelect();
    renderSelectedCandidate();
    renderGuide();
  }

  function loadSampleAndGenerate() {
    const replacesInput = !isBlankInputState();
    if (replacesInput && !confirm("現在の入力をサンプルデータで置き換えます。必要な場合は先に保存してください。続けますか？")) return;
    clearUndoSnapshot();
    state = App.State.normalizeState(App.SampleData.createSampleState());
    renderAll();
    const validation = runValidation();
    if (!validation.errors.length) {
      generate();
    } else {
      selectTab("school");
      saveLocal();
    }
  }

  function isBlankInputState() {
    const blank = App.State.createBlankState();
    const inputOnly = (source) => ({
      school: source.school,
      teachers: source.teachers,
      rooms: source.rooms,
      lessons: source.lessons,
      fixedAssignments: source.fixedAssignments,
      curriculum: source.curriculum,
      constraints: source.constraints
    });
    return JSON.stringify(inputOnly(state)) === JSON.stringify(inputOnly(blank));
  }

  function resetToBlank() {
    const ok = confirm("入力内容を白紙に戻します。必要な場合は先に保存してください。");
    if (!ok) return;
    clearUndoSnapshot();
    state = App.State.createBlankState();
    renderAll();
    runValidation();
    selectTab("school");
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    saveLocal();
  }

  function guidePrimaryAction() {
    if (activeTab === "fixed") {
      generateFromCurrent();
      return;
    }
    if (activeTab === "results") {
      selectTab("fixed");
      return;
    }
    goNext();
  }

  function goNext() {
    if (activeTab === "results") {
      selectTab("fixed");
      return;
    }
    if (activeTab === "fixed") {
      generateFromCurrent();
      return;
    }
    const currentIndex = TAB_SEQUENCE.indexOf(activeTab);
    const nextTab = TAB_SEQUENCE[Math.min(TAB_SEQUENCE.length - 1, currentIndex + 1)];
    selectTab(nextTab);
  }

  function goBack() {
    const currentIndex = TAB_SEQUENCE.indexOf(activeTab);
    const prevTab = TAB_SEQUENCE[Math.max(0, currentIndex - 1)];
    selectTab(prevTab);
  }

  function generateFromCurrent() {
    const validation = runValidation();
    if (validation.errors.length) {
      selectTab(tabForMessage(validation.errors[0]) || "fixed");
      return;
    }
    generate();
  }

  function renderGuide() {
    const meta = TAB_META[activeTab] || TAB_META.school;
    const currentIndex = TAB_SEQUENCE.indexOf(activeTab);
    setText("guidanceTitle", meta.title);
    setText("guidanceText", meta.text);
    setText("currentStepLabel", meta.label.replace(/^\d+\s*/, ""));
    setText("nextStepButton", meta.next);
    setText("headerSchoolName", state.school.name || "学校名未設定");
    const guideStart = document.querySelector(".guide-start");
    if (guideStart) {
      const eyebrow = guideStart.querySelector(".eyebrow");
      const title = guideStart.querySelector("h2");
      const text = guideStart.querySelector("p:not(.eyebrow)");
      if (eyebrow) eyebrow.textContent = "次の操作";
      if (title) title.textContent = meta.title;
      if (text) text.textContent = meta.text;
    }
    const validateButton = document.getElementById("validateButton");
    if (validateButton) {
      validateButton.textContent = activeTab === "fixed"
        ? "この条件で時間割を作る"
        : (activeTab === "results" ? "最初に戻る" : "次へ進む");
    }

    const backButton = document.getElementById("backStepButton");
    if (backButton) backButton.disabled = currentIndex <= 0;

    document.querySelectorAll("[data-stage-group]").forEach((group) => {
      group.classList.toggle("active", group.dataset.stageGroup === meta.stage);
      group.classList.toggle("complete", Number(group.dataset.stageGroup) < Number(meta.stage));
    });

    document.querySelectorAll("[data-stage]").forEach((button) => {
      const stage = Number(button.dataset.stage);
      const currentStage = Number(meta.stage);
      button.classList.toggle("stage-current", stage === currentStage);
      button.classList.toggle("stage-complete", stage < currentStage);
      if (stage === currentStage) button.setAttribute("aria-current", "step");
      else button.removeAttribute("aria-current");
    });

    const hasErrors = Boolean(state.validation.errors && state.validation.errors.length);
    const warningCount = (state.validation.warnings || []).length;
    const candidateCount = (state.candidates || []).length;
    const footerStatus = hasErrors
      ? `あと ${state.validation.errors.length} 件の修正で作成できます`
      : (activeTab === "results" && candidateCount
        ? `${candidateCount}案の候補を表示しています`
        : (activeTab === "fixed"
          ? (warningCount ? `${warningCount}件の注意を確認して作成できます` : "作成準備ができています")
          : "入力内容は自動保存されます"));
    setText("footerStatus", footerStatus);
    const generateAction = document.getElementById("railGenerateButton");
    if (generateAction) {
      generateAction.disabled = hasErrors;
    }
  }

  function renderSchool() {
    setValue("schoolNameInput", state.school.name);
    setValue("periodsInput", state.school.periodsPerDay);
    setValue("gradeCountInput", state.school.gradeCount);
    bindInput("schoolNameInput", (value) => { state.school.name = value; });
    bindNumber("periodsInput", (value) => {
      state.school.periodsPerDay = clamp(value, 1, 8);
      syncDayPeriodLimits();
      renderSchool();
      refreshStructure();
    });
    bindNumber("gradeCountInput", (value) => {
      state.school.gradeCount = clamp(value, 1, 9);
      while (state.school.classCounts.length < state.school.gradeCount) state.school.classCounts.push(1);
      state.school.classCounts = state.school.classCounts.slice(0, state.school.gradeCount);
      renderSchool();
      refreshStructure();
    });

    const dayRoot = document.getElementById("dayCheckboxes");
    dayRoot.innerHTML = "";
    App.Constants.ALL_DAYS.forEach((day) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `choice-pill ${state.school.days.includes(day) ? "active" : ""}`;
      button.textContent = day;
      button.setAttribute("aria-pressed", String(state.school.days.includes(day)));
      button.addEventListener("click", () => {
        if (state.school.days.includes(day)) {
          state.school.days = state.school.days.filter((item) => item !== day);
        } else {
          state.school.days.push(day);
        }
        state.school.days.sort((a, b) => App.Constants.ALL_DAYS.indexOf(a) - App.Constants.ALL_DAYS.indexOf(b));
        syncDayPeriodLimits();
        renderSchool();
        refreshStructure();
      });
      dayRoot.appendChild(button);
    });
    renderDayPeriodSettings();

    const classRoot = document.getElementById("classCounts");
    classRoot.innerHTML = "";
    for (let index = 0; index < state.school.gradeCount; index += 1) {
      const label = document.createElement("label");
      label.className = "class-count-card";
      label.innerHTML = `<span>${index + 1}年</span><strong>${state.school.classCounts[index] || 1}クラス</strong><input type="number" min="1" max="12" value="${state.school.classCounts[index] || 1}" aria-label="${index + 1}年のクラス数">`;
      label.querySelector("input").addEventListener("change", (event) => {
        state.school.classCounts[index] = clamp(event.target.value, 1, 12);
        refreshStructure();
      });
      classRoot.appendChild(label);
    }
    renderSchoolSummary();
  }

  function syncDayPeriodLimits() {
    const maxPeriods = clamp(state.school.periodsPerDay, 1, 8);
    state.school.dayPeriodLimits = state.school.dayPeriodLimits || {};
    App.Constants.ALL_DAYS.forEach((day) => {
      const current = Number(state.school.dayPeriodLimits[day] || maxPeriods);
      state.school.dayPeriodLimits[day] = Math.min(maxPeriods, Math.max(1, current));
    });
  }

  function renderDayPeriodSettings() {
    const root = document.getElementById("dayPeriodSettings");
    if (!root) return;
    syncDayPeriodLimits();
    root.innerHTML = "";
    if (!state.school.days.length) {
      root.innerHTML = `<div class="empty-state">時間割を設定する曜日を選んでください。</div>`;
      return;
    }
    const maxPeriods = clamp(state.school.periodsPerDay, 1, 8);
    state.school.days.forEach((day) => {
      const item = document.createElement("label");
      item.className = "day-period-item";
      const optionsHtml = Array.from({ length: maxPeriods }, (_, index) => {
        const value = index + 1;
        const selected = App.State.getDayPeriodLimit(state, day) === value ? " selected" : "";
        return `<option value="${value}"${selected}>${value}限まで</option>`;
      }).join("");
      item.innerHTML = `<span>${day}</span><select aria-label="${day}曜日の使用時限数">${optionsHtml}</select>`;
      item.querySelector("select").addEventListener("change", (event) => {
        state.school.dayPeriodLimits[day] = clamp(event.target.value, 1, maxPeriods);
        refreshStructure();
        renderSchoolSummary();
      });
      root.appendChild(item);
    });
  }

  function renderSchoolSummary() {
    const root = document.getElementById("schoolSummary");
    if (!root) return;
    const classes = App.State.getClasses(state);
    const days = state.school.days.length;
    const weeklySlots = state.school.days.reduce((sum, day) => sum + App.State.getDayPeriodLimit(state, day), 0);
    const totalClassSlots = weeklySlots * classes.length;
    root.innerHTML = `
      <strong>学校情報の要約</strong>
      <span>${state.school.gradeCount || 0}学年 / ${classes.length}クラス / 週${weeklySlots}コマ</span>
      <small>全クラス合計では ${totalClassSlots} コマ分の時間割を作ります。</small>
    `;
  }

  function refreshStructure() {
    state.candidates = [];
    state.selectedCandidateId = null;
    renderClassSelect();
    renderTeachers();
    renderLessons();
    renderFixed();
    renderStatus();
    renderCandidates();
    runValidation();
    saveLocal();
  }

  function renderTeachers() {
    state.teachers.forEach(syncPartTimeUnavailable);
    renderTeacherOverview();
    const root = document.getElementById("teachersTable");
    root.innerHTML = "";
    if (!state.teachers.length) {
      root.innerHTML = `<div class="empty-state">教員を追加してください。</div>`;
      return;
    }
    state.teachers.forEach((teacher) => {
      const row = document.createElement("div");
      row.className = "teacher-card";
      row.innerHTML = `
        <div class="teacher-card-fields">
          <label class="teacher-name-field">教員名またはコード<input data-field="name" type="text" value="${escapeAttr(teacher.name)}"></label>
          <label class="teacher-subject-field">担当教科メモ<input data-field="subjects" type="text" value="${escapeAttr((teacher.subjects || []).join(","))}"></label>
          <label class="teacher-status-field">勤務形態<select data-field="partTime"><option value="false">常勤</option><option value="true">非常勤</option></select></label>
          <button class="danger teacher-delete-button" type="button">削除</button>
        </div>
        <div class="working-day-panel ${teacher.partTime ? "" : "is-hidden"}">
          <span>勤務日</span>
          <small>色が付いた曜日を勤務日として扱います。選ばない曜日は自動で勤務不可になります。</small>
          <div class="working-day-row"></div>
        </div>
        <div class="unavailable-panel">
          <div class="unavailable-heading">
            <strong>勤務不可時間</strong>
            <small>授業を入れられないコマを選びます。</small>
          </div>
          <div class="unavailable-grid"></div>
        </div>
      `;
      row.querySelector('[data-field="partTime"]').value = String(Boolean(teacher.partTime));
      row.querySelector('[data-field="name"]').addEventListener("input", (event) => {
        teacher.name = event.target.value;
        renderTeacherOverview();
        touch();
      });
      row.querySelector('[data-field="subjects"]').addEventListener("input", (event) => {
        teacher.subjects = event.target.value.split(",").map((item) => item.trim()).filter(Boolean);
        renderTeacherOverview();
        touch();
      });
      row.querySelector('[data-field="partTime"]').addEventListener("change", (event) => {
        teacher.partTime = event.target.value === "true";
        if (teacher.partTime && !Array.isArray(teacher.workingDays)) {
          teacher.workingDays = [];
        }
        syncPartTimeUnavailable(teacher);
        renderTeachers();
        touch();
      });
      row.querySelector(".teacher-delete-button").addEventListener("click", () => {
        const impact = App.State.getTeacherDeletionImpact(state, teacher.id);
        const message = [
          `教員「${impact.teacherName || "名称未設定"}」を削除します。`,
          `担当している授業 ${impact.lessonCount}件は「担当未設定」になります。`,
          `関連する固定授業 ${impact.fixedAssignmentCount}件の担当情報も解除されます。`,
          "保存済みの時間割候補は破棄されます。続けますか？"
        ].join("\n");
        if (!confirm(message)) return;
        const previousState = App.State.clone(state);
        state = App.State.removeTeacher(state, teacher.id);
        renderAll();
        runValidation();
        setUndoSnapshot(previousState, `教員「${impact.teacherName || "名称未設定"}」の削除`);
      });
      renderWorkingDaySelector(row.querySelector(".working-day-row"), teacher);
      renderUnavailableGrid(row.querySelector(".unavailable-grid"), teacher);
      root.appendChild(row);
    });
  }

  function renderTeacherOverview() {
    const root = document.getElementById("teacherOverview");
    if (!root) return;
    if (!state.teachers.length) {
      root.innerHTML = "";
      return;
    }
    const subjectByTeacher = new Map();
    state.lessons.forEach((lesson) => {
      if (!lesson.teacherId) return;
      const subjects = subjectByTeacher.get(lesson.teacherId) || new Set();
      if (lesson.subject) subjects.add(lesson.subject);
      subjectByTeacher.set(lesson.teacherId, subjects);
    });
    root.innerHTML = `
      <details class="teacher-overview-panel">
        <summary>
          <span>教員一覧を表示</span>
          <span class="teacher-overview-summary-actions">
            <small>${state.teachers.length}名の担当教科と勤務日を表で確認します</small>
            <span class="teacher-overview-close">一覧を閉じる</span>
          </span>
        </summary>
        <div class="teacher-table-wrap">
          <table class="teacher-overview-table">
            <thead>
              <tr>
                <th>教員</th>
                <th>担当教科</th>
                <th>勤務形態</th>
                <th>勤務日</th>
                <th>勤務不可</th>
              </tr>
            </thead>
            <tbody>
              ${state.teachers.map((teacher) => {
                const lessonSubjects = [...(subjectByTeacher.get(teacher.id) || new Set())];
                const subjects = lessonSubjects.length ? lessonSubjects : (teacher.subjects || []);
                const workingDays = teacher.partTime
                  ? ((teacher.workingDays || []).length ? teacher.workingDays.join("・") : "勤務日未設定")
                  : "全日";
                const autoCount = (teacher.autoUnavailable || []).length;
                const manualCount = (teacher.unavailable || []).filter((key) => !(teacher.autoUnavailable || []).includes(key)).length;
                return `
                  <tr>
                    <td><strong>${escapeHtml(teacher.name || "未設定")}</strong></td>
                    <td>${escapeHtml(subjects.length ? subjects.join("・") : "担当教科未設定")}</td>
                    <td><span class="teacher-status-badge ${teacher.partTime ? "part-time" : ""}">${teacher.partTime ? "非常勤" : "常勤"}</span></td>
                    <td>${escapeHtml(workingDays)}</td>
                    <td>${manualCount ? `個別${manualCount}コマ` : "個別なし"}${autoCount ? ` / 自動${autoCount}コマ` : ""}</td>
                  </tr>
                `;
              }).join("")}
            </tbody>
          </table>
        </div>
      </details>
    `;
  }

  function renderWorkingDaySelector(root, teacher) {
    if (!root) return;
    root.innerHTML = "";
    state.school.days.forEach((day) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `choice-pill compact ${teacher.workingDays?.includes(day) ? "active" : ""}`;
      button.textContent = day;
      button.setAttribute("aria-pressed", String(teacher.workingDays?.includes(day)));
      button.addEventListener("click", () => {
        teacher.workingDays = teacher.workingDays || [];
        if (teacher.workingDays.includes(day)) {
          teacher.workingDays = teacher.workingDays.filter((item) => item !== day);
        } else {
          teacher.workingDays.push(day);
        }
        teacher.workingDays.sort((a, b) => App.Constants.ALL_DAYS.indexOf(a) - App.Constants.ALL_DAYS.indexOf(b));
        syncPartTimeUnavailable(teacher);
        renderTeachers();
        touch();
      });
      root.appendChild(button);
    });
  }

  function syncPartTimeUnavailable(teacher) {
    teacher.unavailable = Array.isArray(teacher.unavailable) ? teacher.unavailable : [];
    teacher.autoUnavailable = Array.isArray(teacher.autoUnavailable) ? teacher.autoUnavailable : [];
    const previousAuto = new Set(teacher.autoUnavailable);
    const manualUnavailable = teacher.unavailable.filter((key) => !previousAuto.has(key));
    if (!teacher.partTime) {
      teacher.autoUnavailable = [];
      teacher.unavailable = manualUnavailable;
      return;
    }
    teacher.workingDays = (teacher.workingDays || []).filter((day) => state.school.days.includes(day));
    if (!Array.isArray(teacher.workingDays)) teacher.workingDays = [];
    const workingDays = new Set(teacher.workingDays);
    const autoUnavailable = App.State.getSlots(state)
      .filter((slot) => !workingDays.has(slot.day))
      .map((slot) => `${slot.day}-${slot.period}`);
    teacher.autoUnavailable = autoUnavailable;
    teacher.unavailable = [...new Set(manualUnavailable.concat(autoUnavailable))];
  }

  function renderUnavailableGrid(root, teacher) {
    root.innerHTML = "";
    state.school.days.forEach((day) => {
      const dayRow = document.createElement("div");
      dayRow.className = "unavailable-day-row";
      dayRow.innerHTML = `<span class="unavailable-day-label">${day}</span><div class="unavailable-periods"></div>`;
      const periodRoot = dayRow.querySelector(".unavailable-periods");
      const dayLimit = App.State.getDayPeriodLimit(state, day);
      for (let period = 1; period <= dayLimit; period += 1) {
        const key = `${day}-${period}`;
        const isAuto = (teacher.autoUnavailable || []).includes(key);
        const button = document.createElement("button");
        button.type = "button";
        button.className = `slot-toggle ${(teacher.unavailable || []).includes(key) ? "active" : ""} ${isAuto ? "auto" : ""}`;
        button.textContent = `${period}限`;
        button.disabled = isAuto;
        if (isAuto) button.title = "勤務日ではないため自動で勤務不可にしています";
        button.setAttribute("aria-pressed", String((teacher.unavailable || []).includes(key)));
        button.addEventListener("click", () => {
          teacher.unavailable = teacher.unavailable || [];
          if (teacher.unavailable.includes(key)) {
            teacher.unavailable = teacher.unavailable.filter((item) => item !== key);
          } else {
            teacher.unavailable.push(key);
          }
          renderTeachers();
          touch();
        });
        periodRoot.appendChild(button);
      }
      root.appendChild(dayRow);
    });
  }

  function renderRooms() {
    const root = document.getElementById("roomsTable");
    root.innerHTML = "";
    state.rooms.forEach((room) => {
      const row = document.createElement("div");
      row.className = "editable-row";
      row.innerHTML = `
        <label>教室名<input data-field="name" type="text" value="${escapeAttr(room.name)}"></label>
        <label>種別<input data-field="type" type="text" value="${escapeAttr(room.type)}"></label>
        <label>同種教室数<input data-field="count" type="number" min="1" max="99" value="${room.count}"></label>
        <div></div>
        <button class="danger" type="button">削除</button>
      `;
      row.querySelector('[data-field="name"]').addEventListener("input", (event) => { room.name = event.target.value; touch(); });
      row.querySelector('[data-field="type"]').addEventListener("input", (event) => { room.type = event.target.value; renderLessons(); renderFixed(); touch(); });
      row.querySelector('[data-field="count"]').addEventListener("change", (event) => { room.count = clamp(event.target.value, 1, 99); touch(); });
      row.querySelector("button").addEventListener("click", () => {
        state.rooms = state.rooms.filter((item) => item.id !== room.id);
        renderAll();
        touch();
      });
      root.appendChild(row);
    });
  }

  function renderCurriculumPanel() {
    const root = document.getElementById("curriculumPanel");
    if (!root) return;
    state.curriculum = App.State.normalizeCurriculum(state.curriculum);
    const curriculum = state.curriculum;
    root.innerHTML = `
      <div class="curriculum-panel">
        <div class="curriculum-sync-guide" role="note">
          <strong>ここは全クラスの基準設定です。</strong>
          <span>変更した週時数・教科名・標準教室・配置ルールを既存の授業に使うときは、その教科の「授業情報へ反映」を押してください。担当教員と固定する曜日・時限は変わりません。</span>
        </div>
        <div class="curriculum-toolbar">
          <label>設定名<input data-curriculum-field="name" type="text" value="${escapeAttr(curriculum.name || "")}"></label>
          <label>標準時数チェック
            <select data-curriculum-field="hourCheckMode">
              <option value="combined" ${curriculum.hourCheckMode === "combined" ? "selected" : ""}>合算グループで確認</option>
              <option value="separate" ${curriculum.hourCheckMode === "separate" ? "selected" : ""}>教科ごとに確認</option>
            </select>
          </label>
          <button id="addCurriculumSubjectButton" type="button">教科を追加</button>
          <button id="addCurriculumGroupButton" type="button">合算グループを追加</button>
        </div>
        <h3 class="curriculum-subheading">教科マスタ</h3>
        <div class="curriculum-list">
          ${curriculum.subjects.map((subject) => curriculumSubjectRow(subject)).join("")}
        </div>
        <h3 class="curriculum-subheading">標準時数の合算グループ</h3>
        <div class="curriculum-list">
          ${curriculum.hourGroups.map((group) => curriculumGroupRow(group)).join("")}
        </div>
      </div>
    `;
    root.querySelector('[data-curriculum-field="name"]').addEventListener("input", (event) => {
      curriculum.name = event.target.value;
      touchCurriculum(false);
    });
    root.querySelector('[data-curriculum-field="hourCheckMode"]').addEventListener("change", (event) => {
      curriculum.hourCheckMode = event.target.value;
      touchCurriculum(true);
    });
    root.querySelector("#addCurriculumSubjectButton").addEventListener("click", () => {
      curriculum.subjects.push({
        id: App.State.uid("subject"),
        name: "新規教科",
        active: true,
        defaultRoomType: "普通教室",
        defaultDoubleMode: "none",
        weeklyByGrade: { 1: 1, 2: 1, 3: 1 }
      });
      touchCurriculum(true);
    });
    root.querySelector("#addCurriculumGroupButton").addEventListener("click", () => {
      curriculum.hourGroups.push({
        id: App.State.uid("hour-group"),
        name: "新規グループ",
        active: true,
        subjectNames: [],
        weeklyByGrade: { 1: 1, 2: 1, 3: 1 }
      });
      touchCurriculum(true);
    });
    root.querySelectorAll("[data-subject-id]").forEach((row) => {
      const subject = curriculum.subjects.find((item) => item.id === row.dataset.subjectId);
      if (!subject) return;
      row.querySelector('[data-action="sync"]').addEventListener("click", () => {
        syncCurriculumSubject(subject.id);
      });
      row.querySelector('[data-field="active"]').addEventListener("change", (event) => {
        subject.active = event.target.value === "true";
        touchCurriculum(true);
      });
      row.querySelector('[data-field="name"]').addEventListener("input", (event) => {
        subject.name = event.target.value;
        touchCurriculum(false);
      });
      row.querySelector('[data-field="room"]').addEventListener("input", (event) => {
        subject.defaultRoomType = event.target.value;
        touchCurriculum(false);
      });
      row.querySelector('[data-field="double"]').addEventListener("change", (event) => {
        subject.defaultDoubleMode = event.target.value;
        touchCurriculum(false);
      });
      row.querySelectorAll("[data-grade]").forEach((input) => {
        input.addEventListener("change", (event) => {
          subject.weeklyByGrade[event.target.dataset.grade] = Number(event.target.value || 0);
          touchCurriculum(false);
        });
      });
      row.querySelector("button.danger").addEventListener("click", () => {
        curriculum.subjects = curriculum.subjects.filter((item) => item.id !== subject.id);
        touchCurriculum(true);
      });
    });
    root.querySelectorAll("[data-group-id]").forEach((row) => {
      const group = curriculum.hourGroups.find((item) => item.id === row.dataset.groupId);
      if (!group) return;
      row.querySelector('[data-field="active"]').addEventListener("change", (event) => {
        group.active = event.target.value === "true";
        touchCurriculum(true);
      });
      row.querySelector('[data-field="name"]').addEventListener("input", (event) => {
        group.name = event.target.value;
        touchCurriculum(false);
      });
      row.querySelector('[data-field="subjects"]').addEventListener("input", (event) => {
        group.subjectNames = event.target.value.split(",").map((item) => item.trim()).filter(Boolean);
        touchCurriculum(false);
      });
      row.querySelectorAll("[data-grade]").forEach((input) => {
        input.addEventListener("change", (event) => {
          group.weeklyByGrade[event.target.dataset.grade] = Number(event.target.value || 0);
          touchCurriculum(false);
        });
      });
      row.querySelector("button.danger").addEventListener("click", () => {
        curriculum.hourGroups = curriculum.hourGroups.filter((item) => item.id !== group.id);
        touchCurriculum(true);
      });
    });
  }

  function curriculumSubjectRow(subject) {
    const plan = App.State.getCurriculumSubjectSyncPlan(state, subject.id);
    const targetText = plan.blockers.length
      ? "反映前に設定確認"
      : (plan.lessonCount ? `既存 ${plan.lessonCount}件が対象` : "対応する授業なし");
    return `
      <div class="curriculum-row" data-subject-id="${escapeAttr(subject.id)}">
        <label>標準チェック<select data-field="active"><option value="true" ${subject.active !== false ? "selected" : ""}>対象</option><option value="false" ${subject.active === false ? "selected" : ""}>対象外</option></select></label>
        <label>教科名<input data-field="name" type="text" value="${escapeAttr(subject.name)}"></label>
        <label>標準教室<input data-field="room" type="text" value="${escapeAttr(subject.defaultRoomType || "普通教室")}"></label>
        <label>1年 週時数<input data-grade="1" type="number" min="0" max="30" step="0.5" value="${subject.weeklyByGrade?.[1] || 0}"></label>
        <label>2年 週時数<input data-grade="2" type="number" min="0" max="30" step="0.5" value="${subject.weeklyByGrade?.[2] || 0}"></label>
        <label>3年 週時数<input data-grade="3" type="number" min="0" max="30" step="0.5" value="${subject.weeklyByGrade?.[3] || 0}"></label>
        <label>配置ルール<select data-field="double">${doubleModeOptions({ doubleMode: subject.defaultDoubleMode || "none" })}</select></label>
        <div class="curriculum-row-actions">
          <button data-action="sync" type="button" ${subject.active === false ? "disabled" : ""}>授業情報へ反映</button>
          <span class="curriculum-sync-target">${escapeHtml(targetText)}</span>
          <button class="danger" type="button">削除</button>
        </div>
      </div>
    `;
  }

  function syncCurriculumSubject(subjectId) {
    const plan = App.State.getCurriculumSubjectSyncPlan(state, subjectId);
    if (plan.blockers.length) {
      alert(["この設定は授業情報へ反映できません。", "", ...plan.blockers].join("\n"));
      return;
    }
    if (!plan.lessonCount) {
      alert("この教科に対応する既存の授業情報がありません。先に下の「授業を追加」で、クラスと担当教員を設定してください。");
      return;
    }
    if (!plan.changeCount) {
      alert(`${plan.subjectName}は、週時数・教科名・教室・配置ルールがすでに授業情報へ反映されています。`);
      return;
    }
    const missingText = plan.missingClassNames.length
      ? `\n\n授業情報がないため反映されないクラス: ${plan.missingClassNames.join("、")}`
      : "";
    const message = [
      `${plan.subjectName}の基準設定を、既存の授業情報 ${plan.lessonCount}件へ反映します。`,
      "反映する項目: 教科名、学年別週時数、標準教室、配置ルール",
      "保持する項目: 担当教員、固定する曜日・時限",
      "クラスごとの個別設定は、この基準値で上書きされます。",
      "作成済みの時間割候補は破棄されます。",
      missingText,
      "",
      "続けますか？"
    ].filter(Boolean).join("\n");
    if (!confirm(message)) return;

    const previousState = App.State.clone(state);
    try {
      const result = App.State.applyCurriculumSubjectToLessons(state, subjectId);
      state = result.state;
      renderAll();
      runValidation();
      setUndoSnapshot(previousState, `${plan.subjectName}の基準設定の反映`);
    } catch (error) {
      alert(`授業情報へ反映できませんでした。\n${error.message || "設定を確認してください。"}`);
    }
  }

  function curriculumGroupRow(group) {
    return `
      <div class="curriculum-row" data-group-id="${escapeAttr(group.id)}">
        <label>使用<select data-field="active"><option value="true" ${group.active !== false ? "selected" : ""}>使う</option><option value="false" ${group.active === false ? "selected" : ""}>使わない</option></select></label>
        <label>グループ名<input data-field="name" type="text" value="${escapeAttr(group.name)}"></label>
        <label>対象教科（カンマ区切り）<input data-field="subjects" type="text" value="${escapeAttr((group.subjectNames || []).join(", "))}"></label>
        <label>1年 週時数<input data-grade="1" type="number" min="0" max="30" step="0.5" value="${group.weeklyByGrade?.[1] || 0}"></label>
        <label>2年 週時数<input data-grade="2" type="number" min="0" max="30" step="0.5" value="${group.weeklyByGrade?.[2] || 0}"></label>
        <label>3年 週時数<input data-grade="3" type="number" min="0" max="30" step="0.5" value="${group.weeklyByGrade?.[3] || 0}"></label>
        <button class="danger" type="button">削除</button>
      </div>
    `;
  }

  function touchCurriculum(shouldRender) {
    if (shouldRender) {
      state.curriculum = App.State.normalizeCurriculum(state.curriculum);
    }
    renderSubjectSuggestions();
    runValidation();
    saveLocal();
    if (shouldRender) renderCurriculumPanel();
  }

  function renderSubjectSuggestions() {
    const root = document.getElementById("subjectSuggestions");
    if (!root) return;
    const names = new Set([
      ...App.State.getCurriculumSubjects(state).map((subject) => subject.name),
      ...state.lessons.map((lesson) => lesson.subject).filter(Boolean)
    ]);
    root.innerHTML = [...names]
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b, "ja"))
      .map((name) => `<option value="${escapeAttr(name)}"></option>`)
      .join("");
  }

  function renderLessons() {
    const root = document.getElementById("lessonsTable");
    root.innerHTML = "";
    const classes = App.State.getClasses(state);
    if (!state.lessons.length) {
      root.innerHTML = `<div class="empty-state">授業を追加するか、サンプルを読み込んでください。</div>`;
      return;
    }
    state.lessons.forEach((lesson) => {
      const row = document.createElement("div");
      row.className = "editable-row lesson-card";
      row.innerHTML = `
        <label>クラス<select data-field="classId">${options(classes, "id", "name", lesson.classId)}</select></label>
        <label>教科<input data-field="subject" list="subjectSuggestions" type="text" value="${escapeAttr(lesson.subject)}"></label>
        <label>週時数<input data-field="weeklyCount" type="number" min="1" max="30" value="${lesson.weeklyCount}"></label>
        <label>担当教員<select data-field="teacherId">${teacherOptions(lesson.teacherId)}</select></label>
        <label>使う教室<select data-field="roomType">${roomTypeOptions(lesson.roomType)}</select></label>
        <label>同じ日に入れる上限<input data-field="sameDayLimit" type="number" min="1" max="6" value="${lesson.sameDayLimit || 1}"></label>
        <label>配置ルール<select data-field="doubleMode">${doubleModeOptions(lesson)}</select></label>
        <button class="danger" type="button">削除</button>
      `;
      bindRowField(row, "classId", (value) => { lesson.classId = value; });
      bindRowField(row, "subject", (value) => {
        lesson.subject = value;
        const curriculumSubject = state.curriculum.subjects.find((subject) => subject.name === value);
        lesson.curriculumSubjectId = curriculumSubject ? curriculumSubject.id : "";
      });
      bindRowNumber(row, "weeklyCount", (value) => { lesson.weeklyCount = clamp(value, 1, 30); });
      bindRowField(row, "teacherId", (value) => { lesson.teacherId = value; });
      bindRowField(row, "roomType", (value) => { lesson.roomType = value; });
      bindRowNumber(row, "sameDayLimit", (value) => { lesson.sameDayLimit = clamp(value, 1, 6); });
      row.querySelector('[data-field="doubleMode"]').addEventListener("change", (event) => {
        lesson.doubleMode = event.target.value;
        lesson.allowDouble = lesson.doubleMode !== "none";
        if (lesson.doubleMode !== "none" && Number(lesson.sameDayLimit || 1) < 2) {
          lesson.sameDayLimit = 2;
        }
        if (lesson.doubleMode === "required") {
          const weeklyCount = Number(lesson.weeklyCount || 0);
          lesson.weeklyCount = weeklyCount < 2 ? 2 : (weeklyCount % 2 === 0 ? weeklyCount : weeklyCount + 1);
        }
        renderLessons();
        touch();
      });
      row.querySelector("button").addEventListener("click", () => {
        const impact = App.State.getLessonDeletionImpact(state, lesson.id);
        const message = [
          `授業「${impact.className} ${impact.subject}」を削除します。`,
          `関連する固定授業 ${impact.fixedAssignmentCount}件も削除されます。`,
          "保存済みの時間割候補は破棄されます。続けますか？"
        ].join("\n");
        if (!confirm(message)) return;
        const previousState = App.State.clone(state);
        state = App.State.removeLesson(state, lesson.id);
        renderAll();
        runValidation();
        setUndoSnapshot(previousState, `授業「${impact.className} ${impact.subject}」の削除`);
      });
      root.appendChild(row);
    });
  }

  function renderFixed() {
    const root = document.getElementById("fixedTable");
    root.innerHTML = "";
    if (!state.fixedAssignments.length) {
      root.innerHTML = `<div class="empty-state">固定授業がある場合は追加してください。</div>`;
    }
    state.fixedAssignments.forEach((fixed) => {
      const lesson = App.State.getLesson(state, fixed.lessonId);
      const row = document.createElement("div");
      row.className = "editable-row";
      row.innerHTML = `
        <label>クラス<select data-field="classId">${options(App.State.getClasses(state), "id", "name", fixed.classId)}</select></label>
        <label>曜日<select data-field="day">${state.school.days.map((day) => `<option value="${day}" ${day === fixed.day ? "selected" : ""}>${day}</option>`).join("")}</select></label>
        <label>時限<input data-field="period" type="number" min="1" max="${App.State.getDayPeriodLimit(state, fixed.day)}" value="${fixed.period}"></label>
        <label>授業<select data-field="lessonId">${lessonOptions(fixed.lessonId, fixed.classId, fixed.id)}</select></label>
        <label>担当教員<select data-field="teacherId">${teacherOptions(fixed.teacherId || (lesson && lesson.teacherId))}</select></label>
        <label>教室種別<select data-field="roomType">${roomTypeOptions(fixed.roomType || (lesson && lesson.roomType))}</select></label>
        <button class="danger" type="button">削除</button>
      `;
      bindRowField(row, "classId", (value) => { fixed.classId = value; renderFixed(); });
      bindRowField(row, "day", (value) => {
        fixed.day = value;
        fixed.period = clamp(fixed.period, 1, App.State.getDayPeriodLimit(state, fixed.day));
        renderFixed();
      });
      bindRowNumber(row, "period", (value) => { fixed.period = clamp(value, 1, App.State.getDayPeriodLimit(state, fixed.day)); });
      const lessonSelect = row.querySelector('[data-field="lessonId"]');
      lessonSelect.addEventListener("change", (event) => {
        const value = event.target.value;
        const previousLessonId = fixed.lessonId;
        const selectedLesson = App.State.getLesson(state, value);
        if (selectedLesson && remainingFixedSlots(selectedLesson, fixed.id) <= 0) {
          alert(`${selectedLesson.subject}は、授業情報の週時数まで固定済みです。これ以上は固定できません。`);
          event.target.value = previousLessonId;
          return;
        }
        fixed.lessonId = value;
        if (selectedLesson) {
          fixed.classId = selectedLesson.classId;
          fixed.teacherId = selectedLesson.teacherId;
          fixed.roomType = selectedLesson.roomType;
        }
        renderFixed();
        touch();
      });
      bindRowField(row, "teacherId", (value) => { fixed.teacherId = value; });
      bindRowField(row, "roomType", (value) => { fixed.roomType = value; });
      row.querySelector("button").addEventListener("click", () => {
        state.fixedAssignments = state.fixedAssignments.filter((item) => item.id !== fixed.id);
        renderFixed();
        touch();
      });
      root.appendChild(row);
    });
    renderFixedBoard();
    renderConstraints();
    renderConditionReview();
  }

  function renderFixedBoard() {
    const board = document.getElementById("fixedBoard");
    const classSelect = document.getElementById("fixedBoardClassSelect");
    const lessonSelect = document.getElementById("fixedBoardLessonSelect");
    const hint = document.getElementById("fixedBoardHint");
    const status = document.getElementById("fixedBoardStatus");
    if (!board || !classSelect || !lessonSelect) return;
    const classes = App.State.getClasses(state);
    if (!classes.length) {
      board.innerHTML = `<div class="empty-state">学校情報を入力すると固定授業の表が表示されます。</div>`;
      classSelect.innerHTML = "";
      lessonSelect.innerHTML = "";
      if (hint) hint.textContent = "先に学校情報でクラスと時限を設定してください。";
      if (status) status.textContent = "未選択";
      return;
    }
    if (!classes.some((klass) => klass.id === fixedBoardClassId)) {
      fixedBoardClassId = classes[0].id;
    }
    const lessonsForClass = state.lessons.filter((lesson) => lesson.classId === fixedBoardClassId);
    if (!lessonsForClass.some((lesson) => lesson.id === fixedBoardLessonId)) {
      const firstAvailableLesson = lessonsForClass.find((lesson) => remainingFixedSlots(lesson) > 0);
      fixedBoardLessonId = (firstAvailableLesson || lessonsForClass[0] || {}).id || "";
    }
    classSelect.innerHTML = options(classes, "id", "name", fixedBoardClassId);
    classSelect.value = fixedBoardClassId;
    lessonSelect.innerHTML = lessonOptions(fixedBoardLessonId, fixedBoardClassId);
    lessonSelect.value = fixedBoardLessonId;
    classSelect.onchange = (event) => {
      fixedBoardClassId = event.target.value;
      fixedBoardLessonId = "";
      renderFixed();
    };
    lessonSelect.onchange = (event) => {
      fixedBoardLessonId = event.target.value;
      renderFixedBoard();
    };

    const selectedLessonForBoard = App.State.getLesson(state, fixedBoardLessonId);
    const fixedCountForBoard = selectedLessonForBoard ? fixedCountForLesson(selectedLessonForBoard.id) : 0;
    const weeklyCountForBoard = selectedLessonForBoard ? Number(selectedLessonForBoard.weeklyCount || 0) : 0;
    const remainingForBoard = selectedLessonForBoard ? remainingFixedSlots(selectedLessonForBoard) : 0;
    const boardLessonFull = selectedLessonForBoard ? remainingFixedSlots(selectedLessonForBoard) <= 0 : false;
    if (status) {
      status.textContent = selectedLessonForBoard
        ? `固定済み ${fixedCountForBoard}/${weeklyCountForBoard}`
        : "授業未選択";
    }
    if (hint) {
      const className = getClassName(fixedBoardClassId);
      if (!selectedLessonForBoard) {
        hint.textContent = lessonsForClass.length
          ? "固定する授業を選んでください。"
          : `${className} の授業情報がありません。先に授業情報を追加してください。`;
      } else if (boardLessonFull) {
        hint.textContent = `${className} ${selectedLessonForBoard.subject} は週時数 ${weeklyCountForBoard} コマ分をすべて固定済みです。追加するには表の固定済みマスを解除してください。`;
      } else {
        hint.textContent = `${className} ${selectedLessonForBoard.subject} は、あと ${remainingForBoard} コマ固定できます。固定したいマスをクリックしてください。`;
      }
    }
    let html = `<table class="fixed-board-table"><thead><tr><th>時限</th>${state.school.days.map((day) => `<th>${day}</th>`).join("")}</tr></thead><tbody>`;
    for (let period = 1; period <= state.school.periodsPerDay; period += 1) {
      html += `<tr><th scope="row">${period}限</th>`;
      state.school.days.forEach((day) => {
        const isOffSlot = period > App.State.getDayPeriodLimit(state, day);
        const fixed = state.fixedAssignments.find((item) => item.classId === fixedBoardClassId && item.day === day && Number(item.period) === period);
        const lesson = fixed ? App.State.getLesson(state, fixed.lessonId) : null;
        const disabled = isOffSlot || (!fixed && boardLessonFull);
        html += `
          <td class="${isOffSlot ? "off-slot" : ""}">
            <button type="button" class="fixed-slot-button ${fixed ? "active" : ""}" data-day="${escapeAttr(day)}" data-period="${period}" aria-label="${escapeAttr(`${day}${period}限：${isOffSlot ? "設定外" : (fixed ? `${lesson ? lesson.subject : "固定"}を解除` : (disabled ? "固定上限" : `${selectedLessonForBoard ? selectedLessonForBoard.subject : "授業"}を固定`))}`)}" ${disabled ? "disabled" : ""}>
              ${isOffSlot ? "<span>設定外</span>" : (fixed ? `<strong>${escapeHtml(lesson ? lesson.subject : "固定")}</strong><span>解除</span>` : `<span>${disabled ? "上限" : "固定"}</span>`)}
            </button>
          </td>
        `;
      });
      html += `</tr>`;
    }
    html += `</tbody></table>`;
    board.innerHTML = html;
    board.querySelectorAll("[data-day][data-period]").forEach((button) => {
      button.addEventListener("click", () => {
        const day = button.dataset.day;
        const period = Number(button.dataset.period);
        const existing = state.fixedAssignments.find((item) => item.classId === fixedBoardClassId && item.day === day && Number(item.period) === period);
        if (existing) {
          state.fixedAssignments = state.fixedAssignments.filter((item) => item.id !== existing.id);
          renderFixed();
          touch();
          return;
        }
        const selectedLesson = App.State.getLesson(state, fixedBoardLessonId);
        if (!selectedLesson) {
          alert("固定する授業を選んでください。");
          return;
        }
        if (remainingFixedSlots(selectedLesson) <= 0) {
          alert(`${selectedLesson.subject}は、授業情報の週時数まで固定済みです。これ以上は固定できません。`);
          return;
        }
        state.fixedAssignments.push({
          id: App.State.uid("fixed"),
          classId: fixedBoardClassId,
          day,
          period,
          lessonId: selectedLesson.id,
          teacherId: selectedLesson.teacherId,
          roomType: selectedLesson.roomType
        });
        renderFixed();
        touch();
      });
    });
  }

  function renderConstraints() {
    const hard = document.getElementById("hardConstraints");
    hard.innerHTML = App.Constants.HARD_CONSTRAINTS.map((item) => {
      return `<div class="constraint-item"><label class="checkbox-pill"><input type="checkbox" checked disabled>${item.id} ${item.label}</label></div>`;
    }).join("");
    const soft = document.getElementById("softConstraints");
    soft.innerHTML = "";
    App.Constants.SOFT_CONSTRAINTS.forEach((item) => {
      const saved = state.constraints.soft.find((softItem) => softItem.id === item.id);
      const enabled = saved ? saved.enabled : item.enabled;
      const wrap = document.createElement("div");
      wrap.className = "constraint-item";
      wrap.innerHTML = `<label class="checkbox-pill"><input type="checkbox" ${enabled ? "checked" : ""}>${item.id} ${item.label}</label>`;
      wrap.querySelector("input").addEventListener("change", (event) => {
        const target = state.constraints.soft.find((softItem) => softItem.id === item.id);
        if (target) target.enabled = event.target.checked;
        touch();
      });
      soft.appendChild(wrap);
    });
  }

  function renderConditionReview() {
    const root = document.getElementById("conditionReviewPanel");
    if (!root) return;
    const errors = state.validation.errors || [];
    const warnings = state.validation.warnings || [];
    const enabledSoft = (state.constraints.soft || []).filter((item) => item.enabled).length;
    const firstAction = errors[0] || warnings[0];
    root.innerHTML = `
      <div class="condition-review-heading">
        <span>条件の確認</span>
        <strong>${errors.length ? "修正が必要です" : "候補を作成できます"}</strong>
      </div>
      <div class="review-level ${errors.length ? "is-danger" : "is-clear"}">
        <span class="review-level-label">作成を止める問題</span>
        <strong>${errors.length}件</strong>
      </div>
      <div class="review-level ${warnings.length ? "is-warning" : "is-clear"}">
        <span class="review-level-label">確認しておきたいこと</span>
        <strong>${warnings.length}件</strong>
      </div>
      <div class="review-level is-suggestion">
        <span class="review-level-label">有効な改善条件</span>
        <strong>${enabledSoft}件</strong>
      </div>
      ${firstAction ? `
        <div class="review-action-card ${errors.length ? "is-danger" : "is-warning"}">
          <strong>${errors.length ? "最初に直す項目" : "確認するとよい項目"}</strong>
          <p>${escapeHtml(firstAction.text)}</p>
          <button type="button" data-review-action>該当画面で確認する</button>
        </div>
      ` : `<p class="review-ready-message">必須の入力に問題はありません。条件を確認したら候補作成へ進めます。</p>`}
    `;
    const action = root.querySelector("[data-review-action]");
    if (action) action.addEventListener("click", () => selectTab(tabForMessage(firstAction) || "fixed"));
  }

  function runValidation() {
    state.validation = App.Validation.validateRequest(state);
    renderValidationMessages();
    renderStatus();
    saveLocal();
    return state.validation;
  }

  function generate() {
    const result = App.TimetableCore.generateCandidates(state, 3);
    state.validation = result.validation;
    state.candidates = result.candidates;
    state.selectedCandidateId = state.candidates[0] ? state.candidates[0].id : null;
    if (!state.candidates.length && result.generationErrors.length) {
      [...new Set(result.generationErrors)].slice(0, 4).forEach((text, index) => {
        state.validation.errors.push({
          type: "error",
          text: index === 0 ? `候補を作成できませんでした。${text}` : text
        });
      });
    }
    renderValidationMessages();
    renderCandidates();
    renderClassSelect();
    renderSelectedCandidate();
    renderStatus();
    selectTab("results");
    saveLocal();
  }

  function renderValidationMessages() {
    const root = document.getElementById("validationMessages");
    const errors = state.validation.errors || [];
    const warnings = state.validation.warnings || [];
    const info = state.validation.info || [];
    const visibleMessages = errors.length ? errors : warnings.length ? warnings : info.slice(0, 3);
    root.innerHTML = "";
    if (!visibleMessages.length) {
      root.innerHTML = `<div class="message info">まだ確認する内容はありません。</div>`;
    }
    if (errors.length) {
      const summary = document.createElement("div");
      summary.className = "message error validation-summary-message";
      summary.innerHTML = `<strong>時間割を作る前に ${errors.length} 件の確認が必要です。</strong><span>下の理由を直すと作成に進めます。</span>`;
      root.appendChild(summary);
    }
    visibleMessages.slice(0, errors.length ? 5 : 4).forEach((message) => {
      const div = document.createElement("div");
      div.className = `message ${message.type || "info"} actionable-message`;
      div.innerHTML = `
        <span>${escapeHtml(message.text)}</span>
        ${errors.length ? `<button type="button" data-open-message-tab="${escapeAttr(tabForMessage(message))}">確認する</button>` : ""}
      `;
      const button = div.querySelector("[data-open-message-tab]");
      if (button) button.addEventListener("click", () => selectTab(button.dataset.openMessageTab || "fixed"));
      root.appendChild(div);
    });
    if (errors.length > 5) {
      const more = document.createElement("div");
      more.className = "message warning";
      more.textContent = `ほか ${errors.length - 5} 件あります。上から順に直してください。`;
      root.appendChild(more);
    }
    renderBlockingNotice(errors);
    renderRailValidationHint(errors, warnings);
    renderConditionReview();
    const hasErrors = Boolean(state.validation.errors && state.validation.errors.length);
    const generateButton = document.getElementById("generateButton");
    if (generateButton) generateButton.disabled = hasErrors;
    const railGenerateButton = document.getElementById("railGenerateButton");
    if (railGenerateButton) railGenerateButton.disabled = hasErrors;
    renderGuide();
  }

  function renderRailValidationHint(errors, warnings) {
    const root = document.getElementById("railValidationHint");
    if (!root) return;
    root.innerHTML = "";
    if (errors.length) {
      const first = errors[0];
      root.innerHTML = `
        <div class="rail-error-hint">
          <strong>まだ作成できません</strong>
          <span>${escapeHtml(first.text)}</span>
          <button type="button">直す画面へ</button>
        </div>
      `;
      root.querySelector("button").addEventListener("click", () => selectTab(tabForMessage(first) || "fixed"));
      return;
    }
    if (warnings.length) {
      root.innerHTML = `<div class="rail-ok-hint">作成できます。気になる警告は下の確認欄で見られます。</div>`;
      return;
    }
    root.innerHTML = `<div class="rail-ok-hint">作成できます。</div>`;
  }

  function renderBlockingNotice(errors) {
    const root = document.getElementById("blockingNotice");
    if (!root) return;
    const shouldShowHere = activeTab === "fixed" || activeTab === "results";
    if (!errors.length || !shouldShowHere) {
      root.classList.add("is-hidden");
      root.innerHTML = "";
      return;
    }
    const first = errors[0];
    root.classList.remove("is-hidden");
    root.innerHTML = `
      <div>
        <strong>時間割を作れない理由</strong>
        <p>${escapeHtml(first.text)}</p>
      </div>
      <button type="button">この設定を確認する</button>
    `;
    root.querySelector("button").addEventListener("click", () => selectTab(tabForMessage(first) || "fixed"));
  }

  function tabForMessage(message) {
    if (!message) return "fixed";
    if (message.fixTab) return message.fixTab;
    const ref = message.ref || "";
    if (ref === "school.days" || ref === "school.periodsPerDay" || ref === "classes") return "school";
    if (state.teachers.some((teacher) => teacher.id === ref)) return "teachers";
    if (state.rooms.some((room) => room.id === ref)) return "rooms";
    if (state.lessons.some((lesson) => lesson.id === ref)) return "lessons";
    if (state.fixedAssignments.some((fixed) => fixed.id === ref)) return "fixed";
    if (String(message.text || "").includes("勤務日") || String(message.text || "").includes("勤務不可")) return "teachers";
    if (String(message.text || "").includes("教室")) return "rooms";
    if (String(message.text || "").includes("学校情報") || String(message.text || "").includes("曜日")) return "school";
    return "fixed";
  }

  function renderStatus() {
    const classes = App.State.getClasses(state);
    const slots = App.State.getSlots(state);
    const candidates = state.candidates || [];
    const hasSchool = state.school.days.length > 0 && state.school.periodsPerDay > 0 && classes.length > 0;
    const hasTeachers = state.teachers.length > 0;
    const hasRooms = state.rooms.length > 0;
    const hasLessons = state.lessons.length > 0;
    const hasErrors = Boolean(state.validation.errors && state.validation.errors.length);
    const weeklySlots = state.school.days.reduce((sum, day) => sum + App.State.getDayPeriodLimit(state, day), 0);
    const progress = document.getElementById("progressChecklist");
    if (progress) {
      progress.innerHTML = [
        checklistItem("学校情報", hasSchool ? "入力済み" : "確認待ち", hasSchool),
        checklistItem("教員", hasTeachers ? `${state.teachers.length}名` : "未入力", hasTeachers),
        checklistItem("教室", hasRooms ? `${state.rooms.length}件` : "未入力", hasRooms),
        checklistItem("授業", hasLessons ? `${state.lessons.length}件` : "未入力", hasLessons),
        checklistItem("条件", hasErrors ? "要確認" : "進行可", !hasErrors),
        checklistItem("候補", candidates.length ? `${candidates.length}案` : "未生成", candidates.length > 0)
      ].join("");
    }
    document.getElementById("statusSummary").innerHTML = `
      <div class="metric"><span>学校</span><strong>${escapeHtml(state.school.name || "未設定")}</strong></div>
      <div class="metric"><span>クラス</span><strong>${classes.length}</strong></div>
      <div class="metric"><span>曜日/時限</span><strong>${state.school.days.length}日 / 週${weeklySlots}コマ</strong></div>
      <div class="metric"><span>授業情報</span><strong>${state.lessons.length}</strong></div>
      <div class="metric"><span>固定授業</span><strong>${state.fixedAssignments.length}</strong></div>
      <div class="metric"><span>候補</span><strong>${candidates.length}</strong></div>
      <div class="metric"><span>利用可能枠</span><strong>${slots.length}</strong></div>
    `;
    renderGuide();
  }

  function checklistItem(label, value, done) {
    return `<div class="check-item ${done ? "done" : "attention"}"><span>${label}</span><strong>${value}</strong></div>`;
  }

  function renderCandidates() {
    const root = document.getElementById("candidateTabs");
    const summary = document.getElementById("candidateSummary");
    if (root) root.innerHTML = "";
    if (summary) summary.innerHTML = "";
    if (!state.candidates.length) {
      if (root) root.innerHTML = `<div class="empty-state">候補作成後に表示されます。</div>`;
      if (summary) summary.innerHTML = `<div class="empty-state">候補がまだありません。必要な入力をそろえたら「時間割を作る」を押してください。</div>`;
      return;
    }
    state.candidates.forEach((candidate) => {
      const active = candidate.id === state.selectedCandidateId;
      if (root) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = `candidate-tab ${active ? "active" : ""}`;
        button.textContent = `${candidate.name}  スコア ${candidate.score} / 違反 ${candidate.hardViolations.length}`;
        button.addEventListener("click", () => {
          state.selectedCandidateId = candidate.id;
          renderCandidates();
          renderSelectedCandidate();
          saveLocal();
        });
        root.appendChild(button);
      }

      const card = document.createElement("button");
      card.type = "button";
      card.className = `candidate-card ${active ? "active" : ""}`;
      card.innerHTML = `
        <div class="candidate-card-heading"><h3>${candidate.name}</h3>${candidate.hardViolations.length === 0 ? `<span>作成可能</span>` : ""}</div>
        <dl>
          <div><dt>総合スコア</dt><dd>${candidate.score}</dd></div>
          <div><dt>ハード違反</dt><dd>${candidate.hardViolations.length}</dd></div>
          <div><dt>警告</dt><dd>${candidate.warnings.length}</dd></div>
        </dl>
      `;
      card.addEventListener("click", () => {
        state.selectedCandidateId = candidate.id;
        renderCandidates();
        renderSelectedCandidate();
        saveLocal();
      });
      if (summary) summary.appendChild(card);
    });
  }

  function renderClassSelect() {
    const select = document.getElementById("classViewSelect");
    const current = select.value;
    select.innerHTML = options(App.State.getClasses(state), "id", "name", current);
    select.addEventListener("change", renderSelectedCandidate, { once: true });
  }

  function renderSelectedCandidate() {
    const candidate = state.candidates.find((item) => item.id === state.selectedCandidateId);
    const grid = document.getElementById("timetableGrid");
    const details = document.getElementById("candidateDetails");
    const classSelect = document.getElementById("classViewSelect");
    const classes = App.State.getClasses(state);
    if (!classSelect.value && classes[0]) classSelect.value = classes[0].id;
    classSelect.onchange = renderSelectedCandidate;
    if (!candidate) {
      renderResultViewControls(false);
      const errors = (state.validation.errors || []).slice(0, 5);
      const errorHtml = errors.length
        ? `<div class="result-error-list"><strong>作成を止めている条件</strong><ul>${errors.map((item) => `<li>${escapeHtml(item.text)}</li>`).join("")}</ul></div>`
        : "";
      grid.innerHTML = `
        <div class="empty-state result-empty-action">
          <strong>条件を変更したため、まだ候補がありません。</strong>
          <span>サンプル例を編集して使うことはできます。条件を直したら、この条件で時間割を作り直してください。</span>
          ${errorHtml}
          <button type="button" class="primary" data-inline-generate>この条件で作り直す</button>
        </div>
      `;
      const inlineGenerateButton = grid.querySelector("[data-inline-generate]");
      if (inlineGenerateButton) inlineGenerateButton.addEventListener("click", generateFromCurrent);
      details.innerHTML = `<h3>候補詳細</h3><p class="empty-state">候補を作り直すと詳細が表示されます。</p>`;
      return;
    }
    renderResultViewControls(true);
    const classId = classSelect.value || (classes[0] && classes[0].id);
    if (resultViewMode === "all") {
      renderAllTimetableGrids(grid, candidate, classes);
    } else {
      renderTimetableGrid(grid, candidate, classId);
    }
    renderCandidateDetails(details, candidate);
  }

  function renderResultViewControls(hasCandidate) {
    document.querySelectorAll("[data-result-view]").forEach((button) => {
      const active = button.dataset.resultView === resultViewMode;
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", String(active));
      button.disabled = !hasCandidate;
    });
    const printButton = document.getElementById("printResultButton");
    if (printButton) printButton.disabled = !hasCandidate;
    const classViewControl = document.getElementById("classViewControl");
    if (classViewControl) classViewControl.classList.toggle("is-hidden", resultViewMode === "all");
  }

  function printSelectedCandidate() {
    const candidate = state.candidates.find((item) => item.id === state.selectedCandidateId);
    if (!candidate) {
      alert("印刷できる候補がありません。先に候補を作成してください。");
      return;
    }
    resultViewMode = "all";
    renderSelectedCandidate();
    window.setTimeout(() => window.print(), 0);
  }

  function renderTimetableGrid(root, candidate, classId) {
    root.innerHTML = timetableTableHtml(candidate, classId);
  }

  function renderAllTimetableGrids(root, candidate, classes) {
    if (!classes.length) {
      root.innerHTML = `<div class="empty-state">表示できるクラスがありません。</div>`;
      return;
    }
    root.innerHTML = `
      <div class="print-title">
        <h3>${escapeHtml(candidate.name)} 全クラス時間割</h3>
        <p>${escapeHtml(state.school.name || "学校名未設定")} / ${classes.length}クラス</p>
      </div>
      <div class="all-timetables">
        ${classes.map((klass) => `
          <article class="class-timetable">
            <h3>${escapeHtml(klass.name)}</h3>
            ${timetableTableHtml(candidate, klass.id)}
          </article>
        `).join("")}
      </div>
    `;
  }

  function timetableTableHtml(candidate, classId) {
    const entries = candidate.entries.filter((entry) => entry.classId === classId);
    let html = `<table class="timetable-table"><thead><tr><th>時限</th>${state.school.days.map((day) => `<th>${day}</th>`).join("")}</tr></thead><tbody>`;
    for (let period = 1; period <= state.school.periodsPerDay; period += 1) {
      html += `<tr><th scope="row">${period}限</th>`;
      state.school.days.forEach((day) => {
        const isOffSlot = period > App.State.getDayPeriodLimit(state, day);
        const entry = entries.find((item) => item.day === day && Number(item.period) === period);
        html += `<td class="${isOffSlot ? "off-slot" : ""}">${isOffSlot ? `<span class="off-slot-label">設定外</span>` : (entry ? lessonCell(entry) : "")}</td>`;
      });
      html += `</tr>`;
    }
    html += `</tbody></table>`;
    return html;
  }

  function lessonCell(entry) {
    const subjectLabel = shortSubjectName(entry.subject);
    return `
      <div class="lesson-cell">
        <div class="lesson-subject" title="${escapeAttr(entry.subject)}">${escapeHtml(subjectLabel)}</div>
        <div class="lesson-meta">${escapeHtml(getTeacherName(entry.teacherId))}</div>
        <div class="lesson-meta">${escapeHtml(entry.roomType || "普通教室")}</div>
        <div class="badge-row">${entry.fixed ? `<span class="badge fixed">固定</span>` : ""}</div>
      </div>
    `;
  }

  function renderCandidateDetails(root, candidate) {
    const hard = candidate.hardViolations.length
      ? candidate.hardViolations.map((item) => `<li>${escapeHtml(item.id)}: ${escapeHtml(item.text)}</li>`).join("")
      : `<li>作成を止める問題はありません。</li>`;
    const warnings = candidate.warnings.length
      ? candidate.warnings.slice(0, 8).map((item) => `<li>${escapeHtml(item)}</li>`).join("")
      : `<li>確認が必要な警告はありません。</li>`;
    const uniqueImprovements = [...new Set(candidate.improvements)];
    const improvements = uniqueImprovements.length
      ? uniqueImprovements.slice(0, 8).map((item) => `<li>${escapeHtml(item)}</li>`).join("")
      : `<li>現在の候補を確認してください。</li>`;
    root.innerHTML = `
      <div class="candidate-detail-heading">
        <div><span>選択中の候補</span><h3>${candidate.name}</h3></div>
        <strong>${candidate.score}点</strong>
      </div>
      <section class="candidate-message-group ${candidate.hardViolations.length ? "is-danger" : "is-clear"}">
        <h4><span>作成を止める問題</span><strong>${candidate.hardViolations.length}件</strong></h4>
        <ul>${hard}</ul>
      </section>
      <section class="candidate-message-group ${candidate.warnings.length ? "is-warning" : "is-clear"}">
        <h4><span>確認しておきたいこと</span><strong>${candidate.warnings.length}件</strong></h4>
        <ul>${warnings}</ul>
      </section>
      <section class="candidate-message-group is-suggestion">
        <h4><span>改善のヒント</span><strong>${uniqueImprovements.length}件</strong></h4>
        <ul>${improvements}</ul>
      </section>
      <button type="button" class="candidate-edit-conditions">条件設定に戻る</button>
    `;
    root.querySelector(".candidate-edit-conditions").addEventListener("click", () => selectTab("fixed"));
  }

  function switchTab(tab) {
    const targetTab = TAB_META[tab] ? tab : "school";
    const didChange = activeTab !== targetTab;
    activeTab = targetTab;
    document.querySelectorAll(".tab").forEach((button) => button.classList.toggle("active", button.dataset.tab === targetTab));
    document.querySelectorAll(".tab-panel").forEach((panel) => panel.classList.toggle("active", panel.id === `tab-${targetTab}`));
    renderGuide();
    renderBlockingNotice(state.validation.errors || []);
    if (didChange) window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }

  function selectTab(tab) {
    switchTab(tab);
  }

  function bindInput(id, setter) {
    const element = document.getElementById(id);
    element.oninput = (event) => {
      setter(event.target.value);
      touch();
    };
  }

  function bindNumber(id, setter) {
    const element = document.getElementById(id);
    const handleChange = (event) => {
      setter(event.target.value);
      touch();
    };
    element.onchange = handleChange;
    element.oninput = handleChange;
  }

  function bindRowField(row, field, setter) {
    row.querySelector(`[data-field="${field}"]`).addEventListener("change", (event) => {
      setter(event.target.value);
      touch();
    });
    const element = row.querySelector(`[data-field="${field}"]`);
    if (element.tagName === "INPUT") {
      element.addEventListener("input", (event) => {
        setter(event.target.value);
        touch();
      });
    }
  }

  function bindRowNumber(row, field, setter) {
    const element = row.querySelector(`[data-field="${field}"]`);
    const handleChange = (event) => {
      setter(event.target.value);
      touch();
    };
    element.addEventListener("change", handleChange);
    element.addEventListener("input", handleChange);
  }

  function touch() {
    clearUndoSnapshot();
    state.candidates = [];
    state.selectedCandidateId = null;
    runValidation();
    renderStatus();
    renderCandidates();
    renderClassSelect();
    renderSelectedCandidate();
    saveLocal();
  }

  function saveLocal() {
    App.ImportExport.saveLocal(state);
  }

  function setValue(id, value) {
    document.getElementById(id).value = value ?? "";
  }

  function setText(id, value) {
    const element = document.getElementById(id);
    if (element) element.textContent = value ?? "";
  }

  function clamp(value, min, max) {
    const number = Number(value);
    if (Number.isNaN(number)) return min;
    return Math.min(max, Math.max(min, number));
  }

  function options(items, valueKey, labelKey, selected) {
    return items.map((item) => `<option value="${escapeAttr(item[valueKey])}" ${item[valueKey] === selected ? "selected" : ""}>${escapeHtml(item[labelKey])}</option>`).join("");
  }

  function teacherOptions(selected) {
    return `<option value="">未設定</option>` + state.teachers.map((teacher) => {
      return `<option value="${escapeAttr(teacher.id)}" ${teacher.id === selected ? "selected" : ""}>${escapeHtml(teacher.name)}</option>`;
    }).join("");
  }

  function roomTypeOptions(selected) {
    return App.State.getRoomTypes(state).map((roomType) => {
      return `<option value="${escapeAttr(roomType)}" ${roomType === selected ? "selected" : ""}>${escapeHtml(roomType)}</option>`;
    }).join("");
  }

  function doubleModeOptions(lesson) {
    const selected = App.State.getDoubleMode(lesson);
    const modes = [
      { value: "none", label: "通常" },
      { value: "preferred", label: "連続を優先" },
      { value: "required", label: "連続必須" }
    ];
    return modes.map((mode) => {
      return `<option value="${mode.value}" ${mode.value === selected ? "selected" : ""}>${mode.label}</option>`;
    }).join("");
  }

  function lessonOptions(selected, classId, ignoreFixedId) {
    return `<option value="">未設定</option>` + state.lessons
      .filter((lesson) => !classId || lesson.classId === classId)
      .map((lesson) => {
        const remaining = remainingFixedSlots(lesson, ignoreFixedId);
        const fixedCount = fixedCountForLesson(lesson.id, ignoreFixedId);
        const selectedAttr = lesson.id === selected ? "selected" : "";
        const disabledAttr = remaining <= 0 && lesson.id !== selected ? "disabled" : "";
        const label = `${getClassName(lesson.classId)} ${lesson.subject}（固定 ${fixedCount}/${Number(lesson.weeklyCount || 0)}）`;
        return `<option value="${escapeAttr(lesson.id)}" ${selectedAttr} ${disabledAttr}>${escapeHtml(label)}</option>`;
      }).join("");
  }

  function fixedCountForLesson(lessonId, ignoreFixedId) {
    return state.fixedAssignments.filter((fixed) => {
      return fixed.lessonId === lessonId && (!ignoreFixedId || fixed.id !== ignoreFixedId);
    }).length;
  }

  function remainingFixedSlots(lesson, ignoreFixedId) {
    if (!lesson) return 0;
    return Math.max(0, Number(lesson.weeklyCount || 0) - fixedCountForLesson(lesson.id, ignoreFixedId));
  }

  function defaultLessonSubject() {
    return App.State.getCurriculumSubjects(state)[0] || {
      name: "新規教科",
      defaultRoomType: "普通教室",
      defaultDoubleMode: "none"
    };
  }

  function shortSubjectName(subject) {
    const text = String(subject || "");
    return text;
  }

  function getTeacherName(teacherId) {
    const teacher = App.State.getTeacher(state, teacherId);
    return teacher ? teacher.name : "未設定";
  }

  function getClassName(classId) {
    const klass = App.State.getClasses(state).find((item) => item.id === classId);
    return klass ? klass.name : classId;
  }

  function setUndoSnapshot(snapshot, message) {
    undoSnapshot = App.State.clone(snapshot);
    undoMessage = message;
    const root = document.getElementById("undoNotice");
    if (!root) return;
    root.classList.remove("is-hidden");
    root.innerHTML = `
      <div>
        <strong>${escapeHtml(message)}を実行しました。</strong>
        <p>直前の状態へ戻せます。別の入力変更を行うとUndoは終了します。</p>
      </div>
      <button type="button">元に戻す</button>
    `;
    root.querySelector("button").addEventListener("click", restoreUndoSnapshot);
  }

  function restoreUndoSnapshot() {
    if (!undoSnapshot) return;
    const snapshot = undoSnapshot;
    const restoredMessage = undoMessage;
    undoSnapshot = null;
    undoMessage = "";
    state = App.State.normalizeState(snapshot);
    renderAll();
    runValidation();
    const root = document.getElementById("undoNotice");
    if (!root) return;
    root.classList.remove("is-hidden");
    root.innerHTML = `<strong>${escapeHtml(restoredMessage)}を元に戻しました。</strong>`;
  }

  function clearUndoSnapshot() {
    undoSnapshot = null;
    undoMessage = "";
    const root = document.getElementById("undoNotice");
    if (!root) return;
    root.classList.add("is-hidden");
    root.innerHTML = "";
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function escapeAttr(value) {
    return escapeHtml(value);
  }

  App.Main = {
    getState: () => state,
    setState: (next) => {
      clearUndoSnapshot();
      state = App.State.normalizeState(next);
      renderAll();
      runValidation();
      saveLocal();
    },
    generate
  };
})(globalThis);
