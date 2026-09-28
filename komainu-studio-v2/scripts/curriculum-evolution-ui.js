(function (global) {
  const App = global.TimetableApp = global.TimetableApp || {};

  function render(state, deploymentSubjectId) {
    const evolution = App.CurriculumEvolution;
    const profile = evolution.getActiveProfile(state);
    const pattern = evolution.getActivePattern(profile);
    if (!profile || !pattern) return "";
    const annual = evolution.calculateAnnualPlan(state);
    const impact = evolution.buildImpactPlan(state);
    const deployment = deploymentSubjectId
      ? evolution.buildSubjectDeploymentPlan(state, deploymentSubjectId)
      : null;
    return `
      <section class="curriculum-evolution" aria-labelledby="curriculumEvolutionTitle">
        <div class="evolution-heading">
          <div>
            <span class="eyebrow">CURRICULUM LAB</span>
            <h3 id="curriculumEvolutionTitle">教育課程の版と年間計画</h3>
            <p>改定案を別の版として試し、週パターンごとの時数を年間目標と照合できます。</p>
          </div>
          <div class="evolution-context">
            <span>${escapeHtml(statusLabel(profile.status))}</span>
            <strong>${escapeHtml(profile.name)}</strong>
            <small>${profile.effectiveYear}年度・${escapeHtml(pattern.name)}（${formatNumber(pattern.weeks)}週）</small>
          </div>
        </div>

        <div class="profile-version-list" aria-label="教育課程の版一覧">
          ${state.curriculumProfiles.map((item) => `
            <article class="profile-version ${item.id === profile.id ? "is-active" : ""}">
              <div>
                <span>${escapeHtml(statusLabel(item.status))}</span>
                <strong>${escapeHtml(item.name)}</strong>
                <small>${item.effectiveYear}年度</small>
              </div>
              <div class="profile-version-actions">
                <button type="button" data-evolution-action="activate-profile" data-profile-id="${escapeAttr(item.id)}" ${item.id === profile.id ? "disabled" : ""}>${item.id === profile.id ? "使用中" : "切替"}</button>
                <button class="danger" type="button" data-evolution-action="delete-profile" data-profile-id="${escapeAttr(item.id)}" ${item.id === profile.id || state.curriculumProfiles.length <= 1 ? "disabled" : ""}>削除</button>
              </div>
            </article>
          `).join("")}
        </div>

        <div class="evolution-toolbar">
          <label>版の名前<input data-evolution-field="profile-name" type="text" value="${escapeAttr(profile.name)}"></label>
          <label>適用年度<input data-evolution-field="profile-year" type="number" min="2000" max="2200" value="${profile.effectiveYear}"></label>
          <label>位置づけ
            <select data-evolution-field="profile-status">
              ${["current", "proposal", "school", "archived"].map((status) => `<option value="${status}" ${profile.status === status ? "selected" : ""}>${escapeHtml(statusLabel(status))}</option>`).join("")}
            </select>
          </label>
          <button type="button" data-evolution-action="duplicate-profile">この版を複製</button>
        </div>

        <div class="pattern-planner">
          <div class="evolution-section-heading">
            <div><span>WEEK PATTERNS</span><h4>週・学期パターン</h4></div>
            <div>
              <button type="button" data-evolution-action="add-pattern">パターン追加</button>
              <button type="button" data-evolution-action="split-pattern" ${profile.patterns.length !== 1 ? "disabled" : ""}>A/B週に分割</button>
            </div>
          </div>
          <div class="pattern-list">
            ${profile.patterns.map((item) => `
              <article class="pattern-card ${item.id === pattern.id ? "is-active" : ""}" data-pattern-id="${escapeAttr(item.id)}">
                <button class="pattern-activate" type="button" data-evolution-action="activate-pattern" data-pattern-id="${escapeAttr(item.id)}" ${item.id === pattern.id ? "disabled" : ""}>${item.id === pattern.id ? "作成対象" : "この週で作成"}</button>
                <label>名称<input data-evolution-field="pattern-name" data-pattern-id="${escapeAttr(item.id)}" type="text" value="${escapeAttr(item.name)}"></label>
                <label>年間の週数<input data-evolution-field="pattern-weeks" data-pattern-id="${escapeAttr(item.id)}" type="number" min="0" max="60" step="0.5" value="${formatNumber(item.weeks)}"></label>
                <button class="danger" type="button" data-evolution-action="delete-pattern" data-pattern-id="${escapeAttr(item.id)}" ${item.id === pattern.id || profile.patterns.length <= 1 ? "disabled" : ""}>削除</button>
              </article>
            `).join("")}
          </div>
          <p class="evolution-note">時間割候補は「作成対象」の1週間として生成します。別パターンは切り替えて個別に生成してください。</p>
        </div>

        <div class="annual-plan">
          <div class="evolution-section-heading">
            <div><span>ANNUAL HOURS</span><h4>年間時数の照合</h4></div>
            <strong class="annual-difference-count ${annual.differenceCount ? "has-difference" : ""}">${annual.differenceCount ? `${annual.differenceCount}項目に差` : "年間目標と一致"}</strong>
          </div>
          <div class="annual-table-wrap">
            <table class="annual-table">
              <thead><tr><th>教科</th><th>学年</th><th>年間目標</th>${profile.patterns.map((item) => `<th>${escapeHtml(item.name)}<small>${formatNumber(item.weeks)}週</small></th>`).join("")}<th>計画</th><th>差</th></tr></thead>
              <tbody>
                ${annual.rows.map((row) => `
                  <tr class="${Math.abs(row.difference) > 0.001 ? "has-difference" : ""}">
                    <th>${escapeHtml(row.subjectName)}</th>
                    <td>${row.grade}年</td>
                    <td><input aria-label="${escapeAttr(row.subjectName)} ${row.grade}年の年間目標" data-evolution-field="annual-target" data-subject-id="${escapeAttr(row.subjectId)}" data-grade="${row.grade}" type="number" min="0" max="2000" step="0.5" value="${formatNumber(row.target)}"></td>
                    ${profile.patterns.map((item) => `<td class="${item.id === pattern.id ? "is-active-pattern" : ""}"><input aria-label="${escapeAttr(row.subjectName)} ${row.grade}年 ${escapeAttr(item.name)}の週時数" data-evolution-field="pattern-periods" data-pattern-id="${escapeAttr(item.id)}" data-subject-id="${escapeAttr(row.subjectId)}" data-grade="${row.grade}" type="number" min="0" max="30" step="0.5" value="${formatNumber(profile.patternWeekly?.[item.id]?.[row.subjectId]?.[row.grade] || 0)}"></td>`).join("")}
                    <td><strong>${formatNumber(row.planned)}</strong></td>
                    <td><strong class="difference ${row.difference > 0 ? "is-plus" : row.difference < 0 ? "is-minus" : ""}">${signedNumber(row.difference)}</strong></td>
                  </tr>
                `).join("")}
              </tbody>
            </table>
          </div>
        </div>

        <div class="impact-preview">
          <div class="evolution-section-heading">
            <div><span>IMPACT PREVIEW</span><h4>この版を授業へ反映する前の影響</h4></div>
            <span class="impact-state ${impact.blockerCount ? "is-danger" : impact.warningCount ? "is-warning" : "is-clear"}">${impact.blockerCount ? `要対応 ${impact.blockerCount}件` : impact.warningCount ? `差分 ${impact.warningCount}件` : "反映準備OK"}</span>
          </div>
          <div class="impact-metrics">
            ${impactMetric("未作成の授業", impact.missingLessons.length, "blocker")}
            ${impactMetric("変更対象", impact.changedLessons.length, "warning")}
            ${impactMetric("担当未設定", impact.missingTeachers.length, "blocker")}
            ${impactMetric("教室不足", impact.missingRooms.length, "blocker")}
            ${impactMetric("時数形式", impact.invalidWeeklyCounts.length, "blocker")}
            ${impactMetric("年間差", impact.annualDifferences.length, "warning")}
          </div>
          ${impactDetails(impact)}
        </div>

        ${deploymentPanel(state, deployment)}
      </section>
    `;
  }

  function deploymentPanel(state, plan) {
    if (!plan) return "";
    const teacherOptions = state.teachers.map((teacher) => `<option value="${escapeAttr(teacher.id)}">${escapeHtml(teacher.name || "名称未設定")}</option>`).join("");
    return `
      <section class="deployment-panel" aria-labelledby="deploymentTitle">
        <div class="evolution-section-heading">
          <div><span>SAFE ROLLOUT</span><h4 id="deploymentTitle">${escapeHtml(plan.subjectName)}を全クラスへ展開</h4></div>
          <button type="button" data-evolution-action="cancel-deployment">閉じる</button>
        </div>
        <p>既存 ${plan.existingLessons.length}件を基準値へ更新し、不足 ${plan.missingClasses.length}件を追加します。担当教員と固定枠は自動で推測・変更しません。</p>
        ${plan.blockers.length ? `<div class="deployment-blockers"><strong>先に直す項目</strong><ul>${plan.blockers.map((text) => `<li>${escapeHtml(text)}</li>`).join("")}</ul></div>` : ""}
        ${plan.missingClasses.length ? `<div class="deployment-grid">${plan.missingClasses.map((klass) => `
          <label class="deployment-row"><span><strong>${escapeHtml(klass.className)}</strong><small>週${formatNumber(klass.weeklyCount)}コマ</small></span><select data-deployment-teacher data-class-id="${escapeAttr(klass.classId)}"><option value="">担当教員を選択</option>${teacherOptions}</select></label>
        `).join("")}</div>` : `<p class="deployment-complete">不足クラスはありません。既存授業の差分だけを反映できます。</p>`}
        <div class="deployment-actions">
          <button class="primary" type="button" data-evolution-action="apply-deployment" data-subject-id="${escapeAttr(plan.subjectId)}" ${plan.blockers.length || (!plan.missingClasses.length && !plan.changeCount) ? "disabled" : ""}>確認して一括展開</button>
        </div>
      </section>
    `;
  }

  function impactMetric(label, count, level) {
    return `<div class="impact-metric ${count ? `has-${level}` : ""}"><span>${escapeHtml(label)}</span><strong>${count}</strong></div>`;
  }

  function impactDetails(impact) {
    const lines = [];
    impact.missingLessons.slice(0, 4).forEach((item) => lines.push(`${item.className}: ${item.subjectName}の授業情報がありません`));
    impact.missingTeachers.slice(0, 3).forEach((item) => lines.push(`${item.className}: ${item.subjectName}の担当教員が未設定です`));
    impact.missingRooms.slice(0, 3).forEach((item) => lines.push(`${item.subjectName}: 教室種別「${item.roomType}」がありません`));
    impact.invalidWeeklyCounts.slice(0, 3).forEach((item) => lines.push(`${item.className}: ${item.subjectName}の週時数 ${item.weeklyCount} を週時間割へ配置できません`));
    impact.capacityOverflows.slice(0, 3).forEach((item) => lines.push(`${item.patternName} ${item.grade}年: 週${formatNumber(item.total)}コマが利用可能な${item.capacity}コマを超えます`));
    impact.annualDifferences.slice(0, 3).forEach((item) => lines.push(`${item.subjectName} ${item.grade}年: 年間目標との差 ${signedNumber(item.difference)}コマ`));
    if (!lines.length) return `<p class="impact-clear">未作成授業、担当漏れ、教室不足、年間時数差は見つかりませんでした。</p>`;
    return `<details class="impact-details"><summary>影響の内容を見る</summary><ul>${lines.map((line) => `<li>${escapeHtml(line)}</li>`).join("")}</ul>${totalImpactItems(impact) > lines.length ? `<small>ほか ${totalImpactItems(impact) - lines.length}件。各教科の「一括展開」で対象を確認できます。</small>` : ""}</details>`;
  }

  function totalImpactItems(impact) {
    return impact.blockerCount + impact.warningCount;
  }

  function statusLabel(status) {
    return { current: "現行", proposal: "改定案", school: "学校独自", archived: "保管" }[status] || "改定案";
  }

  function formatNumber(value) {
    const number = Number(value || 0);
    return Number.isInteger(number) ? String(number) : String(Math.round(number * 10) / 10);
  }

  function signedNumber(value) {
    const number = Number(value || 0);
    return `${number > 0 ? "+" : ""}${formatNumber(number)}`;
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

  App.CurriculumEvolutionUI = { render, statusLabel };
})(globalThis);
