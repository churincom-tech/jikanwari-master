(function (global) {
  const App = global.TimetableApp = global.TimetableApp || {};
  const matches = (lesson, subject) => lesson.curriculumSubjectId === subject.id || (!lesson.curriculumSubjectId && lesson.subject === subject.name);
  function prepare(raw, request) {
    if (!['add', 'hours', 'retire'].includes(request.mode)) throw new Error('変更の種類を選んでください。');
    let draft = App.CurriculumEvolution.normalizeState(raw);
    const sourceFingerprint = App.V2.fingerprint(raw);
    let subject = draft.curriculum.subjects.find(s => s.id === request.subjectId);
    const oldSubject = subject && App.State.clone(subject);
    if (request.mode !== 'add' && !subject) throw new Error('変更する教科を選んでください。');
    if (request.mode === 'add') {
      const name = String(request.name || '').trim();
      if (!name) throw new Error('新しい教科名を入力してください。');
      if (draft.curriculum.subjects.some(s => s.name.trim().normalize('NFKC') === name.normalize('NFKC'))) throw new Error('同じ教科名があります。「週時数を変更」から既存の教科を選んでください。');
      subject = { id: App.State.uid('subject'), name, active: true, weeklyByGrade: {}, defaultRoomType: request.roomType, defaultDoubleMode: request.doubleMode };
      draft.curriculum.subjects.push(subject);
    }
    if (request.mode === 'retire') {
      subject.active = false; // Archive this profile's master; retain historic counts and other profiles.
    } else {
      subject.active = true;
      subject.defaultRoomType = String(request.roomType || '普通教室');
      subject.defaultDoubleMode = request.doubleMode || 'none';
      if (!['none', 'preferred', 'required'].includes(subject.defaultDoubleMode)) throw new Error('配置ルールを選び直してください。');
      for (let grade = 1; grade <= draft.school.gradeCount; grade++) {
        const hours = Number(request.weeklyByGrade?.[grade]);
        if (!Number.isInteger(hours) || hours < 0 || hours > 30) throw new Error(`${grade}年の週時数は0〜30の整数にしてください。0.5時間などは詳細設定でA/B週に分けます。`);
        if (subject.defaultDoubleMode === 'required' && hours % 2) throw new Error(`${grade}年: 連続必須の週時数は偶数にしてください。`);
        subject.weeklyByGrade[grade] = hours;
      }
      if (!Object.values(subject.weeklyByGrade).some(v => v > 0)) throw new Error('すべての学年で使わなくなる場合は「教科を廃止」を選んでください。');
    }
    const classes = App.State.getClasses(draft), byId = new Map(classes.map(c => [c.id, c]));
    const linked = draft.lessons.filter(l => matches(l, oldSubject || subject));
    if (request.mode !== 'retire' && linked.some(l => !byId.has(l.classId))) throw new Error('対象の授業に存在しないクラスが含まれています。先に授業情報を確認してください。');
    const removed = linked.filter(l => request.mode === 'retire' || subject.weeklyByGrade[byId.get(l.classId).grade] === 0);
    const removedIds = new Set(removed.map(l => l.id));
    const removedFixed = draft.fixedAssignments.filter(f => removedIds.has(f.lessonId));
    draft.lessons = draft.lessons.filter(l => !removedIds.has(l.id));
    draft.fixedAssignments = draft.fixedAssignments.filter(f => !removedIds.has(f.lessonId));
    if (request.mode === 'add') {
      const profile = App.CurriculumEvolution.getActiveProfile(draft);
      const zero = Object.fromEntries(Array.from({ length: draft.school.gradeCount }, (_, i) => [i + 1, 0]));
      for (const pattern of profile.patterns) if (pattern.id !== profile.activePatternId) profile.patternWeekly[pattern.id][subject.id] = { ...zero };
      profile.annualTargets[subject.id] = { ...zero };
    }
    draft = App.CurriculumEvolution.captureActiveProfile(draft);
    const deployment = request.mode === 'retire' ? { blockers: [], missingClasses: [], existingLessons: [], changeCount: 0 } : App.CurriculumEvolution.buildSubjectDeploymentPlan(draft, subject.id);
    const rows = classes.flatMap(c => {
      const before = linked.filter(l => l.classId === c.id).reduce((n, l) => n + Number(l.weeklyCount), 0);
      const after = request.mode === 'retire' ? 0 : subject.weeklyByGrade[c.grade];
      if (!before && !after) return [];
      return [{ classId: c.id, className: c.name, before, after, teacherId: linked.find(l => l.classId === c.id)?.teacherId || '', needsTeacher: deployment.missingClasses.some(m => m.classId === c.id) }];
    });
    return { draft, sourceFingerprint, subjectId: subject.id, subjectName: subject.name, mode: request.mode, deployment, rows, removedLessonCount: removed.length, removedFixedCount: removedFixed.length };
  }
  function apply(raw, plan, assignments, acknowledgeRemoval) {
    if (App.V2.fingerprint(raw) !== plan.sourceFingerprint) throw new Error('確認後に入力が変わりました。「変更内容を確認」をやり直してください。');
    if ((plan.removedLessonCount || plan.removedFixedCount) && !acknowledgeRemoval) throw new Error('削除される授業・固定枠を確認し、確認欄にチェックしてください。');
    if (plan.deployment.blockers.length) throw new Error(plan.deployment.blockers.join('\n'));
    let next = plan.mode === 'retire' ? App.State.clone(plan.draft) : App.CurriculumEvolution.applySubjectDeployment(plan.draft, plan.subjectId, assignments).state;
    next.candidates = []; next.selectedCandidateId = null; delete next.searchReport;
    return next;
  }
  App.CourseChanges = { prepare, apply };
})(globalThis);
