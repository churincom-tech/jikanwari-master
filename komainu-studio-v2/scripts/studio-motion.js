(function () {
  document.addEventListener("DOMContentLoaded", () => {
    document.body.classList.add("studio-ready");
    enableWorkspaceGlow();
    announcePanelTransitions();
  });

  function enableWorkspaceGlow() {
    const workspace = document.querySelector('[data-ui="studio-workspace"]');
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const finePointer = window.matchMedia("(pointer: fine)").matches;
    if (!workspace || reduceMotion || !finePointer) return;

    let frame = 0;
    workspace.addEventListener("pointermove", (event) => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        const bounds = workspace.getBoundingClientRect();
        workspace.style.setProperty("--pointer-x", `${event.clientX - bounds.left}px`);
        workspace.style.setProperty("--pointer-y", `${event.clientY - bounds.top}px`);
        frame = 0;
      });
    });
  }

  function announcePanelTransitions() {
    const live = document.createElement("span");
    live.className = "visually-hidden";
    live.setAttribute("aria-live", "polite");
    document.body.appendChild(live);

    document.querySelectorAll(".tab").forEach((button) => {
      button.addEventListener("click", () => {
        const label = button.querySelector("strong")?.textContent || button.textContent.trim();
        live.textContent = `${label}画面を表示しました。`;
      });
    });
  }
})();
