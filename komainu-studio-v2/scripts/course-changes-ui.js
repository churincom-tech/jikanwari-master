(function (global) {
  const App = global.TimetableApp = global.TimetableApp || {};
  const esc = v => String(v ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
  let getState, commit, root, plan, mode;
  const titles = { add: '新教科を追加', hours: '週時数を変更', retire: '教科を廃止' };
  function reset() { if (root) { root.hidden = true; root.innerHTML = ''; } plan = null; }
  function init(read, save) {
    getState = read; commit = save; root = document.getElementById('courseChangeEditor');
    document.querySelectorAll('[data-course-command]').forEach(b => b.addEventListener('click', () => open(b.dataset.courseCommand)));
  }
  function open(nextMode, subjectId) {
    mode = nextMode; plan = null;
    const state = getState(), subjects = state.curriculum.subjects, subject = subjects.find(s => s.id === subjectId) || subjects.find(s => s.active !== false) || subjects[0];
    if (mode !== 'add' && !subject) { open('add'); return; }
    const context = App.CurriculumEvolution.getActiveContext(state);
    root.hidden = false;
    root.innerHTML = `<form id="courseChangeForm"><div class="course-editor-heading"><div><span class="course-step">1 設定 → 2 内容を確認 → 3 反映</span><h3>${titles[mode]}</h3></div><button type="button" data-course-cancel>閉じる</button></div>
      <p class="course-scope">対象: ${esc(context.profileName)} / ${esc(context.patternName)}。${mode === 'retire' ? 'この課程版で対象外にし、現在の授業情報から取り除きます。基準の記録と別の課程版は残します。' : '現在の週の基準と授業情報へ一緒に反映します。別の課程版・他の週の既存時数・既存の年間目標は変えません。'}</p>
      ${mode === 'add' ? '<label>新しい教科名<input id="courseName" maxlength="80" required placeholder="例：情報"></label>' : `<label>変更する教科<select id="courseSubject">${subjects.map(s => `<option value="${esc(s.id)}" ${s.id === subject.id ? 'selected' : ''}>${esc(s.name)}${s.active === false ? '（対象外）' : ''}</option>`).join('')}</select></label>`}
      ${mode === 'retire' ? '<p>担当教員や教室の登録は消しません。削除する授業・固定枠の件数を次の画面で確認できます。</p>' : `<div class="course-grade-fields">${Array.from({ length: state.school.gradeCount }, (_, i) => `<label>${i + 1}年の週時数<input type="number" data-course-grade="${i + 1}" min="0" max="30" step="1" required value="${mode === 'add' ? 0 : Number(subject.weeklyByGrade[i + 1] || 0)}"></label>`).join('')}</div><p class="course-help">0時間の学年には配置しません。既存の授業がある場合は、削除件数を確認してから反映します。</p>
      <div class="course-options"><label>使用する教室<select id="courseRoom">${[...new Set(state.rooms.map(r => r.type))].map(type => `<option ${type === (subject?.defaultRoomType || '普通教室') ? 'selected' : ''}>${esc(type)}</option>`).join('')}</select></label><label>配置ルール<select id="courseDouble"><option value="none">通常（連続指定なし）</option><option value="preferred">2時間連続を優先</option><option value="required">2時間連続を必須</option></select></label></div>`}
      <div id="courseError" role="alert" hidden></div><button class="primary" type="submit">変更内容を確認</button><div id="coursePreview" aria-live="polite"></div></form>`;
    if (mode !== 'retire') root.querySelector('#courseDouble').value = mode === 'add' ? 'none' : (subject.defaultDoubleMode || 'none');
    root.querySelector('[data-course-cancel]').onclick = () => { reset(); document.querySelector(`[data-course-command="${mode}"]`).focus(); };
    root.querySelector('#courseSubject')?.addEventListener('change', e => open(mode, e.target.value));
    root.querySelector('form').oninput = e => { root.querySelector('#courseError').hidden = true; if (!e.target.closest('#coursePreview')) { plan = null; root.querySelector('#coursePreview').innerHTML = ''; } };
    root.querySelector('form').onsubmit = e => { e.preventDefault(); preview(); };
    root.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
    root.querySelector('#courseName,#courseSubject')?.focus({ preventScroll: true });
  }
  function error(message) { const box = root.querySelector('#courseError'); box.textContent = message; box.hidden = false; box.tabIndex = -1; box.focus({ preventScroll: true }); box.scrollIntoView({ block: 'nearest' }); }
  function preview() {
    try {
      root.querySelector('#courseError').hidden = true;
      const weeklyByGrade = Object.fromEntries([...root.querySelectorAll('[data-course-grade]')].map(e => [e.dataset.courseGrade, e.value]));
      plan = App.CourseChanges.prepare(getState(), { mode, subjectId: root.querySelector('#courseSubject')?.value, name: root.querySelector('#courseName')?.value, weeklyByGrade, roomType: root.querySelector('#courseRoom')?.value, doubleMode: root.querySelector('#courseDouble')?.value });
      const state = getState(), options = '<option value="">担当を選択してください</option>' + state.teachers.map(t => `<option value="${esc(t.id)}">${esc(t.name || '名称未入力')}</option>`).join('');
      const remove = plan.removedLessonCount || plan.removedFixedCount;
      root.querySelector('#coursePreview').innerHTML = `<h4>反映前の確認：${esc(plan.subjectName)}</h4><p>更新 ${plan.deployment.changeCount}件 / 追加 ${plan.deployment.missingClasses.length}件 / 削除する授業 ${plan.removedLessonCount}件・固定枠 ${plan.removedFixedCount}件</p>
        ${plan.deployment.blockers.length ? `<div class="course-blockers">${plan.deployment.blockers.map(s => `<p>${esc(s)}</p>`).join('')}</div>` : ''}
        ${plan.deployment.missingClasses.length ? `<label>新しく追加する全クラスの担当をまとめて指定（任意）<select id="courseCommonTeacher">${options}</select></label><p class="course-help">下のクラス別選択で変更できます。既存の担当教員は保持します。</p>` : ''}
        <div class="table-wrap"><table class="course-preview-table"><thead><tr><th>クラス</th><th>週時数</th><th>担当</th></tr></thead><tbody>${plan.rows.map(r => `<tr><th>${esc(r.className)}</th><td>${r.before} → <strong>${r.after}</strong></td><td>${r.needsTeacher ? `<select data-course-teacher="${esc(r.classId)}" aria-label="${esc(r.className)}の担当教員">${options}</select>` : r.after ? esc(state.teachers.find(t => t.id === r.teacherId)?.name || '未設定（授業情報で確認）') : '授業から除外'}</td></tr>`).join('')}</tbody></table></div>
        ${remove ? '<label class="course-remove-confirm"><input id="courseAcknowledge" type="checkbox">上記の授業と固定枠が削除されることを確認しました</label>' : ''}
        <p>作成済み候補は無効になり、再作成が必要です。反映直後は「元に戻す」で取り消せます。年間目標は詳細設定で確認してください。</p>
        <button id="courseApply" class="primary" type="button" ${plan.deployment.blockers.length ? 'disabled' : ''}>${mode === 'retire' ? '確認して教科を廃止' : '確認して授業情報に反映'}</button>`;
      root.querySelector('#courseCommonTeacher')?.addEventListener('change', e => root.querySelectorAll('[data-course-teacher]').forEach(s => { s.value = e.target.value; }));
      root.querySelector('#courseApply').onclick = () => {
        try {
          const assignments = Object.fromEntries([...root.querySelectorAll('[data-course-teacher]')].map(e => [e.dataset.courseTeacher, e.value]));
          const next = App.CourseChanges.apply(getState(), plan, assignments, Boolean(root.querySelector('#courseAcknowledge')?.checked));
          if (!confirm(`${plan.subjectName}: ${titles[mode]}を反映します。\n授業削除 ${plan.removedLessonCount}件 / 固定枠削除 ${plan.removedFixedCount}件\n作成済み候補は無効になります。続けますか？`)) return;
          commit(next, `${plan.subjectName}：${titles[mode]}`);
        } catch (e) { error(e.message); }
      };
      root.querySelector('#coursePreview').scrollIntoView({ block: 'nearest' });
    } catch (e) { plan = null; error(e.message); }
  }
  App.CourseChangesUI = { init, reset, open };
})(globalThis);
