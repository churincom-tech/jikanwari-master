(function () {
  const STORAGE_KEY = "komainu-timetable-state";
  const DAYS = ["月", "火", "水", "木", "金"];
  const ALL_DAYS = ["月", "火", "水", "木", "金", "土"];
  const PERIOD_OPTIONS = [4, 5, 6, 7, 8];
  const GRADE_OPTIONS = [1, 2, 3];
  const SUBJECTS = ["国語", "社会", "数学", "理科", "音楽", "美術", "保体", "技術", "家庭科", "英語", "道徳", "学活", "総合"];
  const ROOM_TYPES = ["普通教室", "理科室", "体育館", "音楽室", "美術室", "技術室", "家庭科室"];
  const TAB_SEQUENCE = ["school", "teachers", "rooms", "lessons", "fixed", "results"];
  const TAB_META = {
    school: ["1 学校情報", "学校情報を選びましょう", "学校名だけ入力し、曜日・最大時限数・学年・クラス数は選択肢から決めます。", "教員情報入力へ進む"],
    teachers: ["2 授業情報・教員", "担当教員を確認します", "教員は一覧で短く表示し、必要な人だけ開いて勤務不可時間を設定します。", "教室情報入力へ進む"],
    rooms: ["2 授業情報・教室", "使う教室を確認します", "理科室、体育館、音楽室など、同時に使える数を設定します。", "授業情報入力へ進む"],
    lessons: ["2 授業情報・授業", "授業情報をそろえます", "クラス、教科、週時数、担当教員、使う教室を確認します。", "条件設定へ進む"],
    fixed: ["3 条件設定", "守りたい条件を確認します", "固定授業は表のマスをクリックして設定します。", "時間割を作る"],
    results: ["4 結果確認", "時間割候補を確認します", "候補の時間割を確認し、必要に応じて印刷やPDF保存をします。", "もう一度作る"]
  };

  let state = loadState() || createSampleState();
  let activeTab = "school";
  let fixedClassId = "";
  let fixedLessonId = "";

  document.addEventListener("DOMContentLoaded", init);

  function init() {
    bindGlobalActions();
    renderAll();
    validate();
  }

  function bindGlobalActions() {
    document.querySelectorAll(".tab").forEach((button) => {
      button.addEventListener("click", () => switchTab(button.dataset.tab));
    });
    byId("loadSampleButton").addEventListener("click", () => {
      state = createSampleState();
      generate();
      renderAll();
      switchTab("results");
      saveState();
    });
    byId("resetButton").addEventListener("click", () => {
      if (!confirm("入力内容を白紙に戻します。必要なら先に保存してください。")) return;
      state = createBlankState();
      renderAll();
      switchTab("school");
      saveState();
    });
    byId("guideActionButton").addEventListener("click", guideAction);
    byId("nextStepButton").addEventListener("click", guideAction);
    byId("backStepButton").addEventListener("click", goBack);
    byId("railGenerateButton").addEventListener("click", () => {
      generate();
      switchTab("results");
    });
    byId("exportButton").addEventListener("click", exportJson);
    byId("importInput").addEventListener("change", importJson);
    byId("addTeacherButton").addEventListener("click", addTeacher);
    byId("addRoomButton").addEventListener("click", addRoom);
    byId("addLessonButton").addEventListener("click", addLesson);
    byId("teacherSearchInput").addEventListener("input", renderTeachers);
    byId("teacherSubjectFilter").addEventListener("change", renderTeachers);
    byId("printButton").addEventListener("click", () => window.print());
    byId("classViewSelect").addEventListener("change", renderResults);
  }

  function renderAll() {
    renderGuide();
    renderSchool();
    renderTeachers();
    renderRooms();
    renderLessons();
    renderFixed();
    renderResults();
    renderStatus();
  }

  function guideAction() {
    if (activeTab === "fixed") {
      generate();
      switchTab("results");
      return;
    }
    if (activeTab === "results") {
      switchTab("school");
      return;
    }
    const index = TAB_SEQUENCE.indexOf(activeTab);
    switchTab(TAB_SEQUENCE[Math.min(TAB_SEQUENCE.length - 1, index + 1)]);
  }

  function goBack() {
    const index = TAB_SEQUENCE.indexOf(activeTab);
    switchTab(TAB_SEQUENCE[Math.max(0, index - 1)]);
  }

  function switchTab(tab) {
    activeTab = TAB_META[tab] ? tab : "school";
    document.querySelectorAll(".tab").forEach((button) => button.classList.toggle("active", button.dataset.tab === activeTab));
    document.querySelectorAll(".tab-panel").forEach((panel) => panel.classList.toggle("active", panel.id === `tab-${activeTab}`));
    renderGuide();
  }

  function renderGuide() {
    const [label, title, text, next] = TAB_META[activeTab] || TAB_META.school;
    setText("currentStepLabel", label);
    setText("guidanceTitle", title);
    setText("guidanceText", text);
    setText("guideTitle", title);
    setText("guideText", text);
    setText("nextStepButton", next);
    setText("guideActionButton", activeTab === "fixed" ? "この条件で時間割を作る" : (activeTab === "results" ? "最初に戻る" : "次へ進む"));
    byId("backStepButton").disabled = TAB_SEQUENCE.indexOf(activeTab) <= 0;
    document.querySelectorAll("[data-stage-group]").forEach((group) => {
      group.classList.toggle("active", group.dataset.stageGroup === (["teachers", "rooms", "lessons"].includes(activeTab) ? "2" : ""));
    });
  }

  function renderSchool() {
    byId("schoolNameInput").value = state.school.name || "";
    byId("schoolNameInput").oninput = (event) => {
      state.school.name = event.target.value;
      touch();
    };

    renderChoiceButtons("dayChoices", ALL_DAYS, state.school.days, (day) => {
      if (state.school.days.includes(day)) {
        state.school.days = state.school.days.filter((item) => item !== day);
      } else {
        state.school.days.push(day);
      }
      state.school.days.sort((a, b) => ALL_DAYS.indexOf(a) - ALL_DAYS.indexOf(b));
      if (!state.school.days.length) state.school.days = DAYS.slice();
      renderAll();
      touch();
    });

    renderChoiceButtons("periodChoices", PERIOD_OPTIONS, state.school.periodsPerDay, (period) => {
      state.school.periodsPerDay = Number(period);
      renderAll();
      touch();
    }, (value) => `${value}限`);

    renderChoiceButtons("gradeChoices", GRADE_OPTIONS, state.school.gradeCount, (gradeCount) => {
      state.school.gradeCount = Number(gradeCount);
      while (state.school.classCounts.length < state.school.gradeCount) state.school.classCounts.push(2);
      state.school.classCounts = state.school.classCounts.slice(0, state.school.gradeCount);
      renderAll();
      touch();
    }, (value) => `${value}学年`);

    const classRoot = byId("classCounts");
    classRoot.innerHTML = "";
    for (let index = 0; index < state.school.gradeCount; index += 1) {
      const grade = index + 1;
      const card = document.createElement("label");
      card.className = "class-count-card";
      card.innerHTML = `
        <strong>${grade}年</strong>
        <span>${state.school.classCounts[index] || 1}クラス</span>
        <select aria-label="${grade}年のクラス数">
          ${range(1, 8).map((count) => `<option value="${count}" ${count === Number(state.school.classCounts[index] || 1) ? "selected" : ""}>${count}クラス</option>`).join("")}
        </select>
      `;
      card.querySelector("select").addEventListener("change", (event) => {
        state.school.classCounts[index] = Number(event.target.value);
        renderAll();
        touch();
      });
      classRoot.appendChild(card);
    }
    renderSchoolSummary();
  }

  function renderChoiceButtons(rootId, values, selected, onClick, labeler) {
    const root = byId(rootId);
    root.innerHTML = "";
    values.forEach((value) => {
      const active = Array.isArray(selected) ? selected.includes(value) : Number(selected) === Number(value);
      const button = document.createElement("button");
      button.type = "button";
      button.className = `choice-pill ${active ? "active" : ""}`;
      button.textContent = labeler ? labeler(value) : value;
      button.setAttribute("aria-pressed", String(active));
      button.addEventListener("click", () => onClick(value));
      root.appendChild(button);
    });
  }

  function renderSchoolSummary() {
    const classes = getClasses();
    const slots = state.school.days.length * state.school.periodsPerDay;
    byId("schoolSummary").innerHTML = `
      <strong>学校情報の要約</strong>
      <span>${state.school.gradeCount}学年 / ${classes.length}クラス / 週${slots}コマ</span>
      <small>全クラス合計では ${classes.length * slots} コマ分の時間割を作ります。</small>
    `;
  }

  function renderTeachers() {
    const search = byId("teacherSearchInput").value.trim().toLowerCase();
    const subjectFilter = byId("teacherSubjectFilter").value;
    const subjects = [...new Set(state.teachers.flatMap((teacher) => teacher.subjects).filter(Boolean))].sort();
    byId("teacherSubjectFilter").innerHTML = `<option value="">すべての教科</option>${subjects.map((subject) => `<option value="${escapeAttr(subject)}" ${subject === subjectFilter ? "selected" : ""}>${escapeHtml(subject)}</option>`).join("")}`;

    const filtered = state.teachers.filter((teacher) => {
      const haystack = `${teacher.name} ${(teacher.subjects || []).join(" ")}`.toLowerCase();
      const matchesSearch = !search || haystack.includes(search);
      const matchesSubject = !subjectFilter || (teacher.subjects || []).includes(subjectFilter);
      return matchesSearch && matchesSubject;
    });
    byId("teacherSummary").textContent = `${filtered.length}/${state.teachers.length}名を表示`;

    const root = byId("teachersList");
    root.innerHTML = "";
    if (!filtered.length) {
      root.innerHTML = `<div class="empty-state">条件に合う教員がいません。</div>`;
      return;
    }
    filtered.forEach((teacher) => {
      const details = document.createElement("details");
      details.className = "teacher-card";
      details.innerHTML = `
        <summary>
          <span class="teacher-name">${escapeHtml(teacher.name || "未設定")}</span>
          <span class="teacher-subject">${escapeHtml((teacher.subjects || []).join("、") || "教科未設定")}</span>
          <span class="teacher-unavailable-count">不可 ${teacher.unavailable.length}</span>
        </summary>
        <div class="teacher-detail">
          <div class="teacher-detail-grid">
            <label>教員名またはコード<input data-field="name" type="text" value="${escapeAttr(teacher.name)}"></label>
            <label>担当教科<input data-field="subjects" type="text" value="${escapeAttr((teacher.subjects || []).join("、"))}"></label>
            <label>非常勤<select data-field="partTime"><option value="false">いいえ</option><option value="true">はい</option></select></label>
            <button class="danger" type="button" data-action="delete">削除</button>
          </div>
          <label>勤務不可時間<div class="unavailable-grid"></div></label>
        </div>
      `;
      details.querySelector('[data-field="partTime"]').value = String(Boolean(teacher.partTime));
      details.addEventListener("toggle", () => {
        if (!details.open) return;
        root.querySelectorAll("details[open]").forEach((item) => {
          if (item !== details) item.open = false;
        });
      });
      details.querySelector('[data-field="name"]').addEventListener("input", (event) => {
        teacher.name = event.target.value;
        touch(false);
        renderStatus();
      });
      details.querySelector('[data-field="subjects"]').addEventListener("change", (event) => {
        teacher.subjects = splitList(event.target.value);
        renderTeachers();
        touch();
      });
      details.querySelector('[data-field="partTime"]').addEventListener("change", (event) => {
        teacher.partTime = event.target.value === "true";
        touch();
      });
      details.querySelector('[data-action="delete"]').addEventListener("click", () => {
        state.teachers = state.teachers.filter((item) => item.id !== teacher.id);
        state.lessons.forEach((lesson) => {
          if (lesson.teacherId === teacher.id) lesson.teacherId = "";
        });
        renderAll();
        touch();
      });
      renderUnavailableGrid(details.querySelector(".unavailable-grid"), teacher);
      root.appendChild(details);
    });
  }

  function renderUnavailableGrid(root, teacher) {
    root.innerHTML = "";
    getSlots().forEach((slot) => {
      const key = slotKey(slot.day, slot.period);
      const active = teacher.unavailable.includes(key);
      const button = document.createElement("button");
      button.type = "button";
      button.className = `slot-toggle ${active ? "active" : ""}`;
      button.textContent = `${slot.day}${slot.period}`;
      button.addEventListener("click", () => {
        if (teacher.unavailable.includes(key)) {
          teacher.unavailable = teacher.unavailable.filter((item) => item !== key);
        } else {
          teacher.unavailable.push(key);
        }
        renderTeachers();
        touch();
      });
      root.appendChild(button);
    });
  }

  function renderRooms() {
    const root = byId("roomsList");
    root.innerHTML = "";
    state.rooms.forEach((room) => {
      const row = document.createElement("div");
      row.className = "editable-row";
      row.innerHTML = `
        <label>教室名<input data-field="name" type="text" value="${escapeAttr(room.name)}"></label>
        <label>種別<input data-field="type" type="text" value="${escapeAttr(room.type)}"></label>
        <label>同種教室数<select data-field="count">${range(1, 99).map((count) => `<option value="${count}" ${count === Number(room.count) ? "selected" : ""}>${count}</option>`).join("")}</select></label>
        <button class="danger" type="button">削除</button>
      `;
      row.querySelector('[data-field="name"]').addEventListener("input", (event) => { room.name = event.target.value; touch(); });
      row.querySelector('[data-field="type"]').addEventListener("change", (event) => { room.type = event.target.value; renderLessons(); touch(); });
      row.querySelector('[data-field="count"]').addEventListener("change", (event) => { room.count = Number(event.target.value); touch(); });
      row.querySelector("button").addEventListener("click", () => {
        state.rooms = state.rooms.filter((item) => item.id !== room.id);
        renderAll();
        touch();
      });
      root.appendChild(row);
    });
  }

  function renderLessons() {
    const root = byId("lessonsList");
    root.innerHTML = "";
    const classes = getClasses();
    if (!state.lessons.length) {
      root.innerHTML = `<div class="empty-state">授業を追加するか、「まず試す」で標準例を読み込んでください。</div>`;
      return;
    }
    state.lessons.forEach((lesson) => {
      const row = document.createElement("div");
      row.className = "editable-row";
      row.innerHTML = `
        <label>クラス<select data-field="classId">${classes.map((klass) => `<option value="${klass.id}" ${klass.id === lesson.classId ? "selected" : ""}>${klass.name}</option>`).join("")}</select></label>
        <label>教科<select data-field="subject">${SUBJECTS.map((subject) => `<option value="${subject}" ${subject === lesson.subject ? "selected" : ""}>${subject}</option>`).join("")}</select></label>
        <label>週時数<select data-field="weeklyCount">${range(1, 8).map((count) => `<option value="${count}" ${count === Number(lesson.weeklyCount) ? "selected" : ""}>${count}コマ</option>`).join("")}</select></label>
        <label>担当教員<select data-field="teacherId"><option value="">未設定</option>${state.teachers.map((teacher) => `<option value="${teacher.id}" ${teacher.id === lesson.teacherId ? "selected" : ""}>${escapeHtml(teacher.name)}</option>`).join("")}</select></label>
        <label>教室<select data-field="roomType">${ROOM_TYPES.map((roomType) => `<option value="${roomType}" ${roomType === lesson.roomType ? "selected" : ""}>${roomType}</option>`).join("")}</select></label>
        <label>2時間続き<select data-field="doubleMode"><option value="none">通常</option><option value="preferred">できれば連続</option><option value="required">必ず連続</option></select></label>
        <button class="danger" type="button">削除</button>
      `;
      row.querySelector('[data-field="doubleMode"]').value = lesson.doubleMode || "none";
      row.querySelectorAll("select").forEach((select) => {
        select.addEventListener("change", () => {
          lesson.classId = row.querySelector('[data-field="classId"]').value;
          lesson.subject = row.querySelector('[data-field="subject"]').value;
          lesson.weeklyCount = Number(row.querySelector('[data-field="weeklyCount"]').value);
          lesson.teacherId = row.querySelector('[data-field="teacherId"]').value;
          lesson.roomType = row.querySelector('[data-field="roomType"]').value;
          lesson.doubleMode = row.querySelector('[data-field="doubleMode"]').value;
          renderFixed();
          touch();
        });
      });
      row.querySelector("button").addEventListener("click", () => {
        state.lessons = state.lessons.filter((item) => item.id !== lesson.id);
        state.fixedAssignments = state.fixedAssignments.filter((fixed) => fixed.lessonId !== lesson.id);
        renderAll();
        touch();
      });
      root.appendChild(row);
    });
  }

  function renderFixed() {
    const classSelect = byId("fixedClassSelect");
    const lessonSelect = byId("fixedLessonSelect");
    const classes = getClasses();
    if (!classes.some((klass) => klass.id === fixedClassId)) fixedClassId = classes[0]?.id || "";
    const classLessons = state.lessons.filter((lesson) => lesson.classId === fixedClassId);
    if (!classLessons.some((lesson) => lesson.id === fixedLessonId)) {
      fixedLessonId = (classLessons.find((lesson) => remainingFixedSlots(lesson) > 0) || classLessons[0] || {}).id || "";
    }
    classSelect.innerHTML = classes.map((klass) => `<option value="${klass.id}" ${klass.id === fixedClassId ? "selected" : ""}>${klass.name}</option>`).join("");
    lessonSelect.innerHTML = `<option value="">未設定</option>${classLessons.map((lesson) => {
      const fixed = fixedCountForLesson(lesson.id);
      const disabled = fixed >= Number(lesson.weeklyCount) && lesson.id !== fixedLessonId;
      return `<option value="${lesson.id}" ${lesson.id === fixedLessonId ? "selected" : ""} ${disabled ? "disabled" : ""}>${lesson.subject}（固定 ${fixed}/${lesson.weeklyCount}）</option>`;
    }).join("")}`;
    classSelect.value = fixedClassId;
    lessonSelect.value = fixedLessonId;
    classSelect.onchange = (event) => {
      fixedClassId = event.target.value;
      fixedLessonId = "";
      renderFixed();
    };
    lessonSelect.onchange = (event) => {
      fixedLessonId = event.target.value;
      renderFixed();
    };

    const lesson = state.lessons.find((item) => item.id === fixedLessonId);
    const remaining = remainingFixedSlots(lesson);
    byId("fixedBoardStatus").textContent = lesson ? `固定済み ${fixedCountForLesson(lesson.id)}/${lesson.weeklyCount}` : "授業未選択";
    byId("fixedBoardHint").textContent = lesson
      ? (remaining > 0 ? `${lesson.subject} は、あと ${remaining} コマ固定できます。` : `${lesson.subject} は週時数分をすべて固定済みです。追加するには固定済みマスを解除してください。`)
      : "固定する授業を選んでください。";

    let html = `<table class="fixed-board-table"><thead><tr><th>時限</th>${state.school.days.map((day) => `<th>${day}</th>`).join("")}</tr></thead><tbody>`;
    for (let period = 1; period <= state.school.periodsPerDay; period += 1) {
      html += `<tr><th>${period}限</th>`;
      state.school.days.forEach((day) => {
        const fixed = state.fixedAssignments.find((item) => item.classId === fixedClassId && item.day === day && Number(item.period) === period);
        const fixedLesson = fixed ? state.lessons.find((item) => item.id === fixed.lessonId) : null;
        const disabled = !fixed && lesson && remaining <= 0;
        html += `<td><button type="button" class="fixed-slot-button ${fixed ? "active" : ""}" data-day="${day}" data-period="${period}" ${disabled ? "disabled" : ""}>${fixed ? `<strong>${escapeHtml(fixedLesson?.subject || "固定")}</strong><span>クリックで解除</span>` : `<span>${disabled ? "上限です" : "ここに固定"}</span>`}</button></td>`;
      });
      html += `</tr>`;
    }
    html += `</tbody></table>`;
    const board = byId("fixedBoard");
    board.innerHTML = html;
    board.querySelectorAll("[data-day][data-period]").forEach((button) => {
      button.addEventListener("click", () => {
        const day = button.dataset.day;
        const period = Number(button.dataset.period);
        const existing = state.fixedAssignments.find((item) => item.classId === fixedClassId && item.day === day && Number(item.period) === period);
        if (existing) {
          state.fixedAssignments = state.fixedAssignments.filter((item) => item.id !== existing.id);
          renderFixed();
          touch();
          return;
        }
        const selectedLesson = state.lessons.find((item) => item.id === fixedLessonId);
        if (!selectedLesson || remainingFixedSlots(selectedLesson) <= 0) return;
        state.fixedAssignments.push({
          id: uid("fixed"),
          classId: fixedClassId,
          lessonId: selectedLesson.id,
          day,
          period,
          teacherId: selectedLesson.teacherId,
          roomType: selectedLesson.roomType
        });
        renderFixed();
        touch();
      });
    });
    renderSameDayExceptionPanel();
  }

  function renderSameDayExceptionPanel() {
    const root = byId("sameDayExceptionPanel");
    if (!root) return;
    const duplicates = findFixedSameDaySubjectDuplicates();
    if (!duplicates.length) {
      root.innerHTML = "";
      return;
    }
    root.innerHTML = duplicates.map((item) => {
      const approved = state.sameDaySubjectExceptions.includes(item.key);
      return `
        <div class="exception-card ${approved ? "approved" : ""}">
          <div>
            <strong>${escapeHtml(item.label)}</strong>
            <p>${approved ? "例外として許可済みです。候補作成は続行できます。" : "通常は避ける配置です。学校事情で必要な場合だけ承認してください。"}</p>
          </div>
          <button type="button" data-exception-key="${escapeAttr(item.key)}">${approved ? "承認を解除" : "例外として許可"}</button>
        </div>
      `;
    }).join("");
    root.querySelectorAll("[data-exception-key]").forEach((button) => {
      button.addEventListener("click", () => {
        const key = button.dataset.exceptionKey;
        if (state.sameDaySubjectExceptions.includes(key)) {
          state.sameDaySubjectExceptions = state.sameDaySubjectExceptions.filter((item) => item !== key);
        } else {
          state.sameDaySubjectExceptions.push(key);
        }
        renderFixed();
        renderStatus();
        saveState();
      });
    });
  }

  function renderResults() {
    const classes = getClasses();
    const classSelect = byId("classViewSelect");
    const current = classSelect.value || classes[0]?.id || "";
    classSelect.innerHTML = classes.map((klass) => `<option value="${klass.id}" ${klass.id === current ? "selected" : ""}>${klass.name}</option>`).join("");
    const classId = classSelect.value || current;
    if (!state.candidates.length) {
      byId("candidateSummary").innerHTML = `<div class="empty-state">候補を作成すると表示されます。</div>`;
      byId("timetableGrid").innerHTML = `<div class="empty-state">「時間割を作る」を押してください。</div>`;
      return;
    }
    const candidate = state.candidates[0];
    byId("candidateSummary").innerHTML = `<div class="candidate-card"><strong>${candidate.name}</strong><br><span>配置 ${candidate.entries.length} コマ / 警告 ${candidate.warnings.length} 件</span></div>`;
    byId("timetableGrid").innerHTML = timetableHtml(candidate, classId);
  }

  function timetableHtml(candidate, classId) {
    let html = `<table class="timetable-table"><thead><tr><th>時限</th>${state.school.days.map((day) => `<th>${day}</th>`).join("")}</tr></thead><tbody>`;
    for (let period = 1; period <= state.school.periodsPerDay; period += 1) {
      html += `<tr><th>${period}限</th>`;
      state.school.days.forEach((day) => {
        const entry = candidate.entries.find((item) => item.classId === classId && item.day === day && Number(item.period) === period);
        html += `<td>${entry ? lessonCell(entry) : ""}</td>`;
      });
      html += `</tr>`;
    }
    html += `</tbody></table>`;
    return html;
  }

  function lessonCell(entry) {
    return `<div class="lesson-cell"><span class="lesson-subject">${escapeHtml(entry.subject)}</span><span class="lesson-meta">${escapeHtml(getTeacherName(entry.teacherId))}</span><span class="lesson-meta">${escapeHtml(entry.roomType)}</span></div>`;
  }

  function renderStatus() {
    const classes = getClasses();
    byId("progressChecklist").innerHTML = [
      checklistItem("学校情報", `${classes.length}クラス`, classes.length > 0),
      checklistItem("教員", `${state.teachers.length}名`, state.teachers.length > 0),
      checklistItem("教室", `${state.rooms.length}件`, state.rooms.length > 0),
      checklistItem("授業", `${state.lessons.length}件`, state.lessons.length > 0),
      checklistItem("固定授業", `${state.fixedAssignments.length}件`, true),
      checklistItem("候補", state.candidates.length ? `${state.candidates.length}案` : "未生成", state.candidates.length > 0)
    ].join("");
    validate();
  }

  function checklistItem(label, value, done) {
    return `<div class="check-item ${done ? "done" : "attention"}"><span>${label}</span><strong>${value}</strong></div>`;
  }

  function validate() {
    const errors = [];
    const warnings = [];
    if (!state.school.name) errors.push("学校名または管理名を入力してください。");
    if (!state.teachers.length) errors.push("教員を1名以上登録してください。");
    if (!state.lessons.length) errors.push("授業を1件以上登録してください。");
    state.lessons.forEach((lesson) => {
      const fixedCount = fixedCountForLesson(lesson.id);
      if (fixedCount > Number(lesson.weeklyCount)) errors.push(`${lesson.subject}の固定授業が週時数を超えています。`);
    });
    findFixedSameDaySubjectDuplicates().forEach((item) => {
      if (state.sameDaySubjectExceptions.includes(item.key)) {
        warnings.push(`${item.label}。例外として承認済みです。`);
      } else {
        errors.push(`${item.label}。2時間続きでない授業は原則として同じ曜日に2回置けません。必要な場合は条件設定で例外承認してください。`);
      }
    });
    byId("validationMessages").innerHTML = [
      ...errors.map((text) => `<div class="message error">${escapeHtml(text)}</div>`),
      ...warnings.map((text) => `<div class="message warning">${escapeHtml(text)}</div>`),
      ...(!errors.length ? [`<div class="message ok">候補作成に進めます。</div>`] : [])
    ].join("");
    byId("railGenerateButton").disabled = errors.length > 0;
    byId("railGenerateButton").classList.toggle("ready", !errors.length);
    return errors;
  }

  function generate() {
    if (validate().length) return;
    const entries = [];
    const warnings = [];
    const slots = getSlots();
    state.fixedAssignments.forEach((fixed) => {
      const lesson = state.lessons.find((item) => item.id === fixed.lessonId);
      if (!lesson) return;
      entries.push({ ...lesson, day: fixed.day, period: fixed.period, fixed: true });
    });
    getClasses().forEach((klass) => {
      const classLessons = state.lessons.filter((lesson) => lesson.classId === klass.id);
      const classEntries = entries.filter((entry) => entry.classId === klass.id);
      classLessons.forEach((lesson) => {
        const needed = Number(lesson.weeklyCount) - classEntries.filter((entry) => entry.id === lesson.id).length;
        for (let count = 0; count < needed; count += 1) {
          const slot = slots.find((candidateSlot) => canPlaceLesson(entries, lesson, klass.id, candidateSlot));
          if (slot) {
            entries.push({ ...lesson, day: slot.day, period: slot.period, fixed: false });
          } else {
            warnings.push(`${klass.name} ${lesson.subject}をすべて配置できませんでした。`);
          }
        }
      });
    });
    state.candidates = [{ id: uid("candidate"), name: "候補A", entries, warnings }];
    renderResults();
    renderStatus();
    saveState();
  }

  function canPlaceLesson(entries, lesson, classId, slot) {
    const classSlotUsed = entries.some((entry) => entry.classId === classId && entry.day === slot.day && Number(entry.period) === slot.period);
    if (classSlotUsed) return false;
    const teacherSlotUsed = entries.some((entry) => entry.teacherId && entry.teacherId === lesson.teacherId && entry.day === slot.day && Number(entry.period) === slot.period);
    if (teacherSlotUsed) return false;
    if (lesson.doubleMode === "none") {
      const sameSubjectSameDay = entries.some((entry) => entry.classId === classId && entry.day === slot.day && entry.subject === lesson.subject);
      if (sameSubjectSameDay && !isSameDaySubjectException(classId, slot.day, lesson.subject)) return false;
    }
    return true;
  }

  function addTeacher() {
    state.teachers.push({ id: uid("teacher"), name: "新規教員", subjects: [], unavailable: [], partTime: false });
    renderTeachers();
    touch();
  }

  function addRoom() {
    state.rooms.push({ id: uid("room"), name: "新規教室", type: "普通教室", count: 1 });
    renderRooms();
    touch();
  }

  function addLesson() {
    const klass = getClasses()[0];
    const teacher = state.teachers[0];
    state.lessons.push({
      id: uid("lesson"),
      classId: klass?.id || "",
      subject: "国語",
      weeklyCount: 1,
      teacherId: teacher?.id || "",
      roomType: "普通教室",
      doubleMode: "none"
    });
    renderLessons();
    renderFixed();
    touch();
  }

  function createBlankState() {
    return {
      school: { name: "新規時間割", days: DAYS.slice(), periodsPerDay: 6, gradeCount: 3, classCounts: [2, 2, 2] },
      teachers: [],
      rooms: defaultRooms(),
      lessons: [],
      fixedAssignments: [],
      sameDaySubjectExceptions: [],
      candidates: []
    };
  }

  function createSampleState() {
    const state = createBlankState();
    state.school.name = "サンプル中学校";
    state.school.periodsPerDay = 6;
    state.school.classCounts = [3, 3, 3];
    const teacherSpecs = [
      ["国語A", "国語"], ["国語B", "国語"], ["社会A", "社会"], ["数学A", "数学"], ["数学B", "数学"],
      ["理科A", "理科"], ["英語A", "英語"], ["英語B", "英語"], ["音楽", "音楽"], ["美術", "美術"],
      ["保体A", "保体"], ["保体B", "保体"], ["技術", "技術"], ["家庭科", "家庭科"], ["担任1年1組", "学活"],
      ["担任1年2組", "学活"], ["担任1年3組", "学活"], ["担任2年1組", "学活"], ["担任2年2組", "学活"],
      ["担任2年3組", "学活"], ["担任3年1組", "学活"], ["担任3年2組", "学活"], ["担任3年3組", "学活"]
    ];
    state.teachers = teacherSpecs.map(([name, subject]) => ({
      id: uid("teacher"),
      name,
      subjects: [subject],
      unavailable: [],
      partTime: false
    }));
    const weeklyByGrade = {
      1: { 国語: 4, 社会: 3, 数学: 4, 理科: 3, 音楽: 1, 美術: 2, 保体: 3, 技術: 1, 家庭科: 1, 英語: 4, 道徳: 1, 学活: 1, 総合: 1 },
      2: { 国語: 4, 社会: 3, 数学: 3, 理科: 4, 音楽: 1, 美術: 1, 保体: 3, 技術: 1, 家庭科: 1, 英語: 4, 道徳: 1, 学活: 1, 総合: 2 },
      3: { 国語: 3, 社会: 4, 数学: 4, 理科: 4, 音楽: 1, 美術: 1, 保体: 3, 技術: 1, 家庭科: 1, 英語: 4, 道徳: 1, 学活: 1, 総合: 2 }
    };
    const roomBySubject = { 理科: "理科室", 音楽: "音楽室", 美術: "美術室", 保体: "体育館", 技術: "技術室", 家庭科: "家庭科室" };
    getClassesForState(state).forEach((klass) => {
      Object.entries(weeklyByGrade[klass.grade]).forEach(([subject, weeklyCount]) => {
        const teacher = pickTeacher(state.teachers, subject, klass);
        state.lessons.push({
          id: uid("lesson"),
          classId: klass.id,
          subject,
          weeklyCount,
          teacherId: teacher?.id || "",
          roomType: roomBySubject[subject] || "普通教室",
          doubleMode: ["美術", "技術", "家庭科"].includes(subject) ? "preferred" : "none"
        });
      });
      const homeroom = state.lessons.find((lesson) => lesson.classId === klass.id && lesson.subject === "学活");
      if (homeroom) {
        state.fixedAssignments.push({ id: uid("fixed"), classId: klass.id, lessonId: homeroom.id, day: "月", period: 1, teacherId: homeroom.teacherId, roomType: "普通教室" });
      }
    });
    return state;
  }

  function pickTeacher(teachers, subject, klass) {
    if (subject === "学活") return teachers.find((teacher) => teacher.name === `担任${klass.name}`);
    const candidates = teachers.filter((teacher) => teacher.subjects.includes(subject));
    return candidates[(klass.grade + Number(klass.name.match(/(\d+)組/)?.[1] || 1)) % Math.max(candidates.length, 1)] || candidates[0];
  }

  function defaultRooms() {
    return [
      { id: "room-normal", name: "普通教室", type: "普通教室", count: 99 },
      { id: "room-science", name: "理科室", type: "理科室", count: 1 },
      { id: "room-gym", name: "体育館", type: "体育館", count: 1 },
      { id: "room-music", name: "音楽室", type: "音楽室", count: 1 },
      { id: "room-art", name: "美術室", type: "美術室", count: 1 },
      { id: "room-tech", name: "技術室", type: "技術室", count: 1 },
      { id: "room-home", name: "家庭科室", type: "家庭科室", count: 1 }
    ];
  }

  function touch(shouldRenderStatus = true) {
    state.candidates = [];
    if (shouldRenderStatus) renderStatus();
    saveState();
  }

  function getClasses() {
    return getClassesForState(state);
  }

  function getClassesForState(targetState) {
    const classes = [];
    for (let grade = 1; grade <= Number(targetState.school.gradeCount || 0); grade += 1) {
      const count = Number(targetState.school.classCounts[grade - 1] || 0);
      for (let classIndex = 1; classIndex <= count; classIndex += 1) {
        classes.push({ id: `g${grade}-${classIndex}`, grade, name: `${grade}年${classIndex}組` });
      }
    }
    return classes;
  }

  function getSlots() {
    const slots = [];
    state.school.days.forEach((day) => {
      for (let period = 1; period <= state.school.periodsPerDay; period += 1) {
        slots.push({ day, period });
      }
    });
    return slots;
  }

  function fixedCountForLesson(lessonId) {
    return state.fixedAssignments.filter((fixed) => fixed.lessonId === lessonId).length;
  }

  function remainingFixedSlots(lesson) {
    if (!lesson) return 0;
    return Math.max(0, Number(lesson.weeklyCount || 0) - fixedCountForLesson(lesson.id));
  }

  function findFixedSameDaySubjectDuplicates() {
    const grouped = new Map();
    state.fixedAssignments.forEach((fixed) => {
      const lesson = state.lessons.find((item) => item.id === fixed.lessonId);
      if (!lesson || lesson.doubleMode !== "none") return;
      const key = sameDaySubjectKey(fixed.classId, fixed.day, lesson.subject);
      const item = grouped.get(key) || {
        key,
        classId: fixed.classId,
        day: fixed.day,
        subject: lesson.subject,
        count: 0
      };
      item.count += 1;
      grouped.set(key, item);
    });
    return [...grouped.values()]
      .filter((item) => item.count > 1)
      .map((item) => ({
        ...item,
        label: `${getClassName(item.classId)} ${item.day}曜日に${item.subject}が${item.count}回あります`
      }));
  }

  function sameDaySubjectKey(classId, day, subject) {
    return `${classId}|${day}|${subject}`;
  }

  function isSameDaySubjectException(classId, day, subject) {
    return state.sameDaySubjectExceptions.includes(sameDaySubjectKey(classId, day, subject));
  }

  function getTeacherName(teacherId) {
    return state.teachers.find((teacher) => teacher.id === teacherId)?.name || "未設定";
  }

  function getClassName(classId) {
    return getClasses().find((klass) => klass.id === classId)?.name || classId;
  }

  function splitList(value) {
    return String(value || "").split(/[、,]/).map((item) => item.trim()).filter(Boolean);
  }

  function slotKey(day, period) {
    return `${day}-${period}`;
  }

  function range(start, end) {
    return Array.from({ length: end - start + 1 }, (_, index) => start + index);
  }

  function uid(prefix) {
    return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }

  function byId(id) {
    return document.getElementById(id);
  }

  function setText(id, value) {
    byId(id).textContent = value;
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

  function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? normalizeState(JSON.parse(raw)) : null;
    } catch (error) {
      return null;
    }
  }

  function normalizeState(raw) {
    const blank = createBlankState();
    const next = { ...blank, ...raw };
    next.school = { ...blank.school, ...(raw.school || {}) };
    next.school.days = Array.isArray(next.school.days) && next.school.days.length ? next.school.days : DAYS.slice();
    next.school.classCounts = Array.isArray(next.school.classCounts) ? next.school.classCounts : [2, 2, 2];
    next.teachers = Array.isArray(next.teachers) ? next.teachers : [];
    next.rooms = Array.isArray(next.rooms) ? next.rooms : defaultRooms();
    next.lessons = Array.isArray(next.lessons) ? next.lessons : [];
    next.fixedAssignments = Array.isArray(next.fixedAssignments) ? next.fixedAssignments : [];
    next.sameDaySubjectExceptions = Array.isArray(next.sameDaySubjectExceptions) ? next.sameDaySubjectExceptions : [];
    next.candidates = Array.isArray(next.candidates) ? next.candidates : [];
    return next;
  }

  function exportJson() {
    const blob = new Blob([JSON.stringify({ app: "komainu", exportedAt: new Date().toISOString(), state }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `komainu-${dateStamp()}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function importJson(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result);
        state = normalizeState(parsed.state || parsed);
        renderAll();
        saveState();
      } catch (error) {
        alert("JSONを読み込めませんでした。");
      }
    };
    reader.readAsText(file);
    event.target.value = "";
  }

  function dateStamp() {
    const now = new Date();
    const pad = (value) => String(value).padStart(2, "0");
    return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`;
  }
})();
