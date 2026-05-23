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
    maxPreviewLength: 120,
    minAnchorGapPx: 24,
    rescanDelayMs: 120
  };

  const state = {
    anchors: [],
    activeAnchorId: "",
    routeKey: location.href,
    pendingRescan: 0
  };

  let rail;
  let track;
  let tooltip;
  let mutationObserver;
  let intersectionObserver;

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
    window.setInterval(handleRouteMaybeChanged, 1000);
    window.addEventListener("resize", renderAnchors, { passive: true });
  }

  function handleRouteMaybeChanged() {
    window.setTimeout(() => {
      if (state.routeKey !== location.href) {
        state.routeKey = location.href;
        state.activeAnchorId = "";
        hideTooltip();
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
