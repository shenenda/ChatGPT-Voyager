(() => {
  "use strict";

  if (window.__chatgptVoyagerLoaded) {
    return;
  }
  window.__chatgptVoyagerLoaded = true;

  const CONFIG = {
    anchorAttr: "data-cgv-anchor-id",
    railId: "cgv-anchor-rail",
    tooltipId: "cgv-anchor-tooltip",
    quoteActionId: "cgv-quote-action",
    maxPreviewLength: 120,
    minAnchorGapPx: 24,
    scrollLockMs: 120000,
    scrollLockTickMs: 80,
    userScrollReleaseMs: 450,
    rescanDelayMs: 120,
    selectionMinLength: 2,
    selectionMaxLength: 2400,
    selectionActionOffsetPx: 10
  };

  const state = {
    anchors: [],
    activeAnchorId: "",
    pendingQuoteText: "",
    routeKey: location.href,
    lastProgrammaticScrollAt: 0,
    lastUserScrollIntentAt: 0,
    pendingRescan: 0,
    scrollLock: {
      active: false,
      top: 0,
      startedAt: 0,
      timer: 0
    }
  };

  let rail;
  let track;
  let tooltip;
  let quoteAction;
  let quoteButton;
  let mutationObserver;
  let intersectionObserver;
  let lastSelectionText = "";

  function init() {
    ensureUi();
    observeDom();
    patchHistory();
    installEventHandlers();
    scheduleRescan(0);
  }

  function ensureUi() {
    rail = document.getElementById(CONFIG.railId);
    if (!rail) {
      rail = document.createElement("aside");
      rail.id = CONFIG.railId;
      rail.className = "cgv-anchor-rail cgv-hidden";
      rail.setAttribute("aria-label", "ChatGPT conversation anchors");

      track = document.createElement("div");
      track.className = "cgv-anchor-track";
      rail.appendChild(track);
      document.documentElement.appendChild(rail);
    } else {
      track = rail.querySelector(".cgv-anchor-track");
    }

    tooltip = document.getElementById(CONFIG.tooltipId);
    if (!tooltip) {
      tooltip = document.createElement("div");
      tooltip.id = CONFIG.tooltipId;
      tooltip.className = "cgv-anchor-tooltip cgv-hidden";
      document.documentElement.appendChild(tooltip);
    }

    quoteAction = document.getElementById(CONFIG.quoteActionId);
    if (!quoteAction) {
      quoteAction = document.createElement("div");
      quoteAction.id = CONFIG.quoteActionId;
      quoteAction.className = "cgv-quote-action cgv-hidden";

      quoteButton = document.createElement("button");
      quoteButton.type = "button";
      quoteButton.className = "cgv-quote-button";
      quoteButton.textContent = "引用此内容进行对话";
      quoteButton.setAttribute("aria-label", "引用此内容进行对话");
      quoteButton.addEventListener("mousedown", (event) => event.preventDefault());
      quoteButton.addEventListener("click", handleQuoteActionClick);

      quoteAction.appendChild(quoteButton);
      document.documentElement.appendChild(quoteAction);
    } else {
      quoteButton = quoteAction.querySelector(".cgv-quote-button");
    }
  }

  function observeDom() {
    mutationObserver = new MutationObserver(() => scheduleRescan(CONFIG.rescanDelayMs));
    mutationObserver.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true
    });
  }

  function patchHistory() {
    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;

    history.pushState = function pushState(...args) {
      const result = originalPushState.apply(this, args);
      handleRouteMaybeChanged();
      return result;
    };

    history.replaceState = function replaceState(...args) {
      const result = originalReplaceState.apply(this, args);
      handleRouteMaybeChanged();
      return result;
    };

    window.addEventListener("popstate", handleRouteMaybeChanged, { passive: true });
  }

  function installEventHandlers() {
    document.addEventListener("selectionchange", handleSelectionChange);
    document.addEventListener("pointerdown", handlePotentialQuoteActionDismiss, true);
    document.addEventListener("pointerup", handleSelectionCommit, true);
    document.addEventListener("keyup", handleSelectionCommit, true);
    document.addEventListener("submit", handlePotentialSubmit, true);
    document.addEventListener("click", handlePotentialSendClick, true);
    document.addEventListener("keydown", handlePotentialSendKeydown, true);
    window.setInterval(handleRouteMaybeChanged, 1000);

    window.addEventListener("scroll", handleWindowScroll, {
      passive: true,
      capture: true
    });
    window.addEventListener("wheel", releaseScrollLockOnInput, {
      passive: true,
      capture: true
    });
    window.addEventListener("touchmove", releaseScrollLockOnInput, {
      passive: true,
      capture: true
    });
    window.addEventListener("keydown", releaseScrollLockOnNavigationKey, {
      passive: true,
      capture: true
    });
    window.addEventListener(
      "resize",
      () => {
        renderAnchors();
        hideQuoteAction();
      },
      { passive: true }
    );
  }

  function handleRouteMaybeChanged() {
    window.setTimeout(() => {
      if (state.routeKey !== location.href) {
        state.routeKey = location.href;
        state.activeAnchorId = "";
        state.pendingQuoteText = "";
        hideQuoteAction();
        stopScrollLock();
        scheduleRescan(0);
      }
    }, 0);
  }

  function scheduleRescan(delay) {
    window.clearTimeout(state.pendingRescan);
    state.pendingRescan = window.setTimeout(scanAnchors, delay);
  }

  function scanAnchors() {
    ensureUi();
    const candidates = findUserMessageElements();
    const anchors = [];

    candidates.forEach((element, index) => {
      const text = normalizeText(element.innerText || element.textContent || "");
      if (!text) {
        return;
      }

      let id = element.getAttribute(CONFIG.anchorAttr);
      if (!id) {
        id = `cgv-${Date.now().toString(36)}-${index.toString(36)}-${Math.random()
          .toString(36)
          .slice(2, 7)}`;
        element.setAttribute(CONFIG.anchorAttr, id);
      }

      anchors.push({
        id,
        element,
        text,
        preview: truncateText(text, CONFIG.maxPreviewLength)
      });
    });

    state.anchors = anchors;
    renderAnchors();
    observeIntersections();
  }

  function findUserMessageElements() {
    const semanticCandidates = [
      ...document.querySelectorAll('[data-message-author-role="user"]')
    ].filter(isVisibleElement);

    if (semanticCandidates.length) {
      return dedupeElements(semanticCandidates.map(getMessageContainer));
    }

    const articleCandidates = [...document.querySelectorAll("article")].filter((article) => {
      const label = `${article.getAttribute("aria-label") || ""} ${article.textContent || ""}`;
      return /you said|you asked|user|你说|你问/i.test(label) && isVisibleElement(article);
    });

    if (articleCandidates.length) {
      return dedupeElements(articleCandidates);
    }

    return [];
  }

  function getMessageContainer(element) {
    const article = element.closest("article");
    if (article) {
      return article;
    }

    const messageWrapper = element.closest("[data-testid], [data-message-id]");
    if (messageWrapper) {
      return messageWrapper;
    }

    return element;
  }

  function dedupeElements(elements) {
    const seen = new Set();
    const result = [];
    elements.forEach((element) => {
      if (!element || seen.has(element)) {
        return;
      }
      seen.add(element);
      result.push(element);
    });
    return result;
  }

  function renderAnchors() {
    if (!track) {
      return;
    }

    track.replaceChildren();
    rail.classList.toggle("cgv-hidden", state.anchors.length === 0);
    if (!state.anchors.length) {
      return;
    }

    const positions = calculateRailPositions();
    state.anchors.forEach((anchor, index) => {
      const dot = document.createElement("button");
      dot.type = "button";
      dot.className = "cgv-anchor-dot";
      dot.dataset.anchorId = anchor.id;
      dot.style.top = `${positions[index]}%`;
      dot.setAttribute("aria-label", `Go to prompt ${index + 1}: ${anchor.preview}`);
      dot.classList.toggle("is-active", anchor.id === state.activeAnchorId);

      dot.addEventListener("click", () => jumpToAnchor(anchor.id));
      dot.addEventListener("mouseenter", () => showTooltip(anchor, dot));
      dot.addEventListener("mouseleave", hideTooltip);
      dot.addEventListener("focus", () => showTooltip(anchor, dot));
      dot.addEventListener("blur", hideTooltip);

      track.appendChild(dot);
    });
  }

  function calculateRailPositions() {
    const count = state.anchors.length;
    if (count === 1) {
      return [50];
    }

    const railHeight = Math.max(rail.getBoundingClientRect().height, 1);
    const minGapPercent = (CONFIG.minAnchorGapPx / railHeight) * 100;
    const maxScrollTop = Math.max(getDocumentHeight() - window.innerHeight, 1);
    const rawPositions = state.anchors.map((anchor) => {
      const anchorTop = anchor.element.getBoundingClientRect().top + getScrollTop();
      return clamp((anchorTop / maxScrollTop) * 100, 0, 100);
    });

    if (minGapPercent * (count - 1) > 100) {
      return rawPositions;
    }

    const positions = [...rawPositions];
    for (let index = 1; index < positions.length; index += 1) {
      positions[index] = Math.max(positions[index], positions[index - 1] + minGapPercent);
    }
    for (let index = positions.length - 2; index >= 0; index -= 1) {
      positions[index] = Math.min(positions[index], positions[index + 1] - minGapPercent);
    }

    return positions.map((position) => clamp(position, 0, 100));
  }

  function observeIntersections() {
    if (intersectionObserver) {
      intersectionObserver.disconnect();
    }

    intersectionObserver = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => Math.abs(a.boundingClientRect.top) - Math.abs(b.boundingClientRect.top));
        if (!visible.length) {
          return;
        }

        const id = visible[0].target.getAttribute(CONFIG.anchorAttr);
        if (id && id !== state.activeAnchorId) {
          state.activeAnchorId = id;
          updateActiveDot();
        }
      },
      {
        root: null,
        rootMargin: "-15% 0px -65% 0px",
        threshold: [0, 0.1, 0.5, 1]
      }
    );

    state.anchors.forEach((anchor) => intersectionObserver.observe(anchor.element));
  }

  function updateActiveDot() {
    if (!track) {
      return;
    }

    track.querySelectorAll(".cgv-anchor-dot").forEach((dot) => {
      dot.classList.toggle("is-active", dot.dataset.anchorId === state.activeAnchorId);
    });
  }

  function jumpToAnchor(anchorId) {
    const anchor = state.anchors.find((item) => item.id === anchorId);
    if (!anchor) {
      return;
    }

    state.activeAnchorId = anchor.id;
    updateActiveDot();
    state.lastProgrammaticScrollAt = Date.now();
    anchor.element.scrollIntoView({
      behavior: "smooth",
      block: "start",
      inline: "nearest"
    });
  }

  function showTooltip(anchor, dot) {
    if (!tooltip) {
      return;
    }

    tooltip.textContent = anchor.preview;
    tooltip.classList.remove("cgv-hidden");

    const dotRect = dot.getBoundingClientRect();
    const tooltipRect = tooltip.getBoundingClientRect();
    const top = clamp(
      dotRect.top + dotRect.height / 2 - tooltipRect.height / 2,
      8,
      window.innerHeight - tooltipRect.height - 8
    );
    const left = Math.max(8, dotRect.left - tooltipRect.width - 12);

    tooltip.style.top = `${top}px`;
    tooltip.style.left = `${left}px`;
  }

  function hideTooltip() {
    if (tooltip) {
      tooltip.classList.add("cgv-hidden");
    }
  }

  function handleSelectionChange() {
    const text = getSelectedText();
    if (text) {
      lastSelectionText = text;
    }
  }

  function handleSelectionCommit(event) {
    if (quoteAction?.contains?.(event.target)) {
      return;
    }

    if (
      event.type === "keyup" &&
      !["Enter", " ", "Spacebar"].includes(event.key || "") &&
      !event.shiftKey
    ) {
      return;
    }

    window.setTimeout(() => {
      const text = getSelectedText() || lastSelectionText;
      if (!text || isSelectionInsideInput()) {
        return;
      }

      showQuoteAction(text);
    }, 30);
  }

  function getSelectedText() {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) {
      return "";
    }

    const text = normalizeText(selection.toString());
    if (text.length < CONFIG.selectionMinLength) {
      return "";
    }

    return text.slice(0, CONFIG.selectionMaxLength);
  }

  function isSelectionInsideInput() {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) {
      return false;
    }

    const node = selection.anchorNode;
    const element = node && node.nodeType === Node.ELEMENT_NODE ? node : node?.parentElement;
    return Boolean(element?.closest('textarea, input, [contenteditable="true"], [role="textbox"]'));
  }

  function showQuoteAction(selectedText) {
    ensureUi();
    if (!quoteAction) {
      return;
    }

    state.pendingQuoteText = selectedText;
    lastSelectionText = selectedText;

    const selectionRect = getSelectionRect();
    const fallbackRect = {
      top: window.innerHeight / 2,
      right: window.innerWidth / 2,
      bottom: window.innerHeight / 2,
      left: window.innerWidth / 2,
      width: 0,
      height: 0
    };
    const rect = selectionRect || fallbackRect;

    quoteAction.classList.remove("cgv-hidden");
    const actionRect = quoteAction.getBoundingClientRect();
    const viewportWidth = window.innerWidth || document.documentElement.clientWidth || 0;
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;
    const top = clamp(
      rect.bottom + CONFIG.selectionActionOffsetPx,
      8,
      Math.max(8, viewportHeight - actionRect.height - 8)
    );
    const left = clamp(
      rect.left + rect.width / 2 - actionRect.width / 2,
      8,
      Math.max(8, viewportWidth - actionRect.width - 8)
    );

    quoteAction.style.top = `${top}px`;
    quoteAction.style.left = `${left}px`;
  }

  function getSelectionRect() {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) {
      return null;
    }

    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    if (rect && (rect.width || rect.height)) {
      return rect;
    }

    const rects = range.getClientRects ? [...range.getClientRects()] : [];
    return rects.find((item) => item.width || item.height) || null;
  }

  function handleQuoteActionClick(event) {
    event.preventDefault();
    const text = state.pendingQuoteText || getSelectedText() || lastSelectionText;
    if (!text) {
      hideQuoteAction();
      return;
    }

    if (insertQuotePrompt(text)) {
      lastSelectionText = "";
      clearSelection();
      hideQuoteAction();
    }
  }

  function handlePotentialQuoteActionDismiss(event) {
    if (quoteAction?.contains?.(event.target)) {
      return;
    }

    hideQuoteAction();
  }

  function hideQuoteAction() {
    state.pendingQuoteText = "";
    if (quoteAction) {
      quoteAction.classList.add("cgv-hidden");
    }
  }

  function clearSelection() {
    const selection = window.getSelection();
    if (selection && !selection.isCollapsed) {
      selection.removeAllRanges();
    }
  }

  function insertQuotePrompt(selectedText) {
    const editor = findPromptEditor();
    if (!editor) {
      return false;
    }

    const quote = selectedText
      .split(/\r?\n/)
      .map((line) => `> ${line}`)
      .join("\n");
    const insertion = `${quote}\n\n请基于上面引用内容回答：`;
    const existing = getEditorText(editor).trim();
    const nextValue = existing ? `${existing}\n\n${insertion}` : insertion;

    setEditorText(editor, nextValue);
    focusEditor(editor);
    return true;
  }

  function findPromptEditor() {
    const selectors = [
      "#prompt-textarea",
      'textarea[data-id="root"]',
      'textarea[placeholder*="Message"]',
      'textarea[placeholder*="Ask"]',
      'textarea',
      '[contenteditable="true"][role="textbox"]',
      '[contenteditable="true"]'
    ];

    for (const selector of selectors) {
      const elements = [...document.querySelectorAll(selector)].filter(isVisibleElement);
      const editor = elements.find((element) => !element.closest(`[id="${CONFIG.railId}"]`));
      if (editor) {
        return editor;
      }
    }

    return null;
  }

  function getEditorText(editor) {
    if ("value" in editor) {
      return editor.value || "";
    }
    return editor.innerText || editor.textContent || "";
  }

  function setEditorText(editor, value) {
    if ("value" in editor) {
      const nativeSetter = Object.getOwnPropertyDescriptor(
        Object.getPrototypeOf(editor),
        "value"
      )?.set;
      if (nativeSetter) {
        nativeSetter.call(editor, value);
      } else {
        editor.value = value;
      }
      editor.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: value }));
      return;
    }

    editor.textContent = value;
    editor.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: value }));
  }

  function focusEditor(editor) {
    state.lastProgrammaticScrollAt = Date.now();
    editor.focus({ preventScroll: true });

    if (document.createRange && window.getSelection && !("value" in editor)) {
      const range = document.createRange();
      range.selectNodeContents(editor);
      range.collapse(false);
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
    } else if ("selectionStart" in editor) {
      const length = editor.value.length;
      editor.setSelectionRange(length, length);
    }
  }

  function handlePotentialSubmit() {
    if (findPromptEditor()) {
      maybeStartScrollLock();
    }
  }

  function handlePotentialSendClick(event) {
    const button = event.target?.closest?.("button");
    if (!button) {
      return;
    }

    const label = `${button.getAttribute("aria-label") || ""} ${button.textContent || ""}`;
    const testId = button.getAttribute("data-testid") || "";
    if (/send|submit|发送/i.test(label) || /send/i.test(testId)) {
      maybeStartScrollLock();
    }
  }

  function handleWindowScroll() {
    releaseScrollLockOnUserScroll();
    hideQuoteAction();
  }

  function handlePotentialSendKeydown(event) {
    if (event.key !== "Enter" || event.shiftKey || event.metaKey || event.ctrlKey || event.altKey) {
      return;
    }

    const target = event.target;
    if (target?.closest?.('textarea, [contenteditable="true"], [role="textbox"]')) {
      maybeStartScrollLock();
    }
  }

  function maybeStartScrollLock() {
    startScrollLock(getScrollTop());
  }

  function startScrollLock(top) {
    stopScrollLock();
    state.scrollLock.active = true;
    state.scrollLock.top = top;
    state.scrollLock.startedAt = Date.now();
    state.lastProgrammaticScrollAt = Date.now();
    state.scrollLock.timer = window.setInterval(() => {
      if (!state.scrollLock.active || Date.now() - state.scrollLock.startedAt > CONFIG.scrollLockMs) {
        stopScrollLock();
        return;
      }

      if (Math.abs(getScrollTop() - state.scrollLock.top) > 3) {
        state.lastProgrammaticScrollAt = Date.now();
        scrollToTop(state.scrollLock.top);
      }
    }, CONFIG.scrollLockTickMs);
  }

  function stopScrollLock() {
    if (state.scrollLock.timer) {
      window.clearInterval(state.scrollLock.timer);
    }
    state.scrollLock.active = false;
    state.scrollLock.timer = 0;
  }

  function releaseScrollLockOnUserScroll() {
    if (!state.scrollLock.active) {
      return;
    }

    if (
      Date.now() - state.lastUserScrollIntentAt <= CONFIG.userScrollReleaseMs &&
      Date.now() - state.lastProgrammaticScrollAt > CONFIG.userScrollReleaseMs
    ) {
      stopScrollLock();
    }
  }

  function releaseScrollLockOnInput() {
    state.lastUserScrollIntentAt = Date.now();
    if (state.scrollLock.active) {
      stopScrollLock();
    }
  }

  function releaseScrollLockOnNavigationKey(event) {
    const keys = ["PageDown", "PageUp", "Home", "End", "ArrowUp", "ArrowDown", " "];
    if (state.scrollLock.active && keys.includes(event.key)) {
      state.lastUserScrollIntentAt = Date.now();
      stopScrollLock();
    }
  }

  function getScrollTop() {
    return window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0;
  }

  function getDocumentHeight() {
    return Math.max(
      document.body.scrollHeight || 0,
      document.documentElement.scrollHeight || 0,
      document.body.offsetHeight || 0,
      document.documentElement.offsetHeight || 0,
      window.innerHeight
    );
  }

  function scrollToTop(top) {
    window.scrollTo(window.scrollX, top);
  }

  function normalizeText(text) {
    return (text || "")
      .replace(/\u00a0/g, " ")
      .replace(/[ \t]+/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  function truncateText(text, maxLength) {
    if (text.length <= maxLength) {
      return text;
    }
    return `${text.slice(0, maxLength - 1)}...`;
  }

  function isVisibleElement(element) {
    if (!element || !(element instanceof Element)) {
      return false;
    }

    const rect = element.getBoundingClientRect();
    const style = window.getComputedStyle(element);
    return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none";
  }

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  init();
})();
