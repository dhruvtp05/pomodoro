const durationInput = document.getElementById("duration");
const tabList = document.getElementById("tab-list");
const patternSummary = document.getElementById("pattern-summary");
const patternChips = document.getElementById("pattern-chips");
const selectionCount = document.getElementById("selection-count");
const selectAllBtn = document.getElementById("select-all-btn");
const clearAllBtn = document.getElementById("clear-all-btn");
const activePatterns = document.getElementById("active-patterns");
const startBtn = document.getElementById("start-btn");
const stopBtn = document.getElementById("stop-btn");
const sessionIdle = document.getElementById("session-idle");
const sessionActive = document.getElementById("session-active");
const timerEl = document.getElementById("timer");
const interruptionCountEl = document.getElementById("interruption-count");
const catImage = document.getElementById("cat-image");
const catLevelEl = document.getElementById("cat-level");
const moodLabelEl = document.getElementById("mood-label");
const kibbleCountEl = document.getElementById("kibble-count");
const statusMessage = document.getElementById("status-message");

const SITE_COLORS = ["#4A7C59", "#6B8E9B", "#C47D5A", "#8B6BA8", "#5A8F7B", "#A67B5B"];

let pollInterval = null;
let wasSessionActive = false;
let lastInterruptions = 0;
let lastDurationMinutes = 25;
let lastRemainingSeconds = 0;

startBtn.addEventListener("click", startSession);
stopBtn.addEventListener("click", stopSession);
selectAllBtn.addEventListener("click", selectAllTabs);
clearAllBtn.addEventListener("click", clearAllTabs);
tabList.addEventListener("change", updateSelectionUi);

document.addEventListener("DOMContentLoaded", async () => {
  document.getElementById("brand-mark").src = getAssetUrl("assets/icons/app-mark.svg");
  initPageNav("panel");
  await loadTabs();
  await refreshState();
  pollInterval = setInterval(refreshState, 1000);
});

async function loadTabs() {
  const tabs = await chrome.tabs.query({ currentWindow: true });
  tabList.innerHTML = "";

  const usableTabs = tabs.filter((tab) => tab.url && !tab.url.startsWith("chrome-extension://"));

  if (usableTabs.length === 0) {
    tabList.innerHTML = '<p class="empty-tabs">No open tabs in this window.</p>';
    startBtn.disabled = true;
    updateSelectionUi();
    return;
  }

  startBtn.disabled = false;

  usableTabs.forEach((tab) => {
    const pattern = urlToWhitelistPattern(tab.url);
    const domain = getHostname(tab.url);
    const label = document.createElement("label");
    label.className = `tab-item${pattern ? "" : " disabled"}`;

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.value = tab.url;
    checkbox.disabled = !pattern;

    const icon = document.createElement("div");
    icon.className = "site-icon";
    icon.style.background = getSiteColor(domain);
    icon.textContent = (domain[0] || "?").toUpperCase();

    const info = document.createElement("div");
    info.className = "tab-info";
    info.innerHTML = `
      <div class="tab-title" title="${escapeAttr(tab.title || "Untitled")}">${escapeHtml(tab.title || "Untitled")}</div>
      <div class="tab-domain" title="${escapeAttr(domain)}">${escapeHtml(domain)}${pattern ? "" : " · not allowed"}</div>
    `;

    checkbox.addEventListener("change", () => {
      label.classList.toggle("selected", checkbox.checked);
    });

    label.appendChild(checkbox);
    label.appendChild(icon);
    label.appendChild(info);
    tabList.appendChild(label);
  });

  updateSelectionUi();
}

function getHostname(urlString) {
  try {
    return new URL(urlString).hostname.replace(/^www\./, "");
  } catch {
    return urlString;
  }
}

function getSiteColor(domain) {
  let hash = 0;
  for (let i = 0; i < domain.length; i += 1) {
    hash = domain.charCodeAt(i) + ((hash << 5) - hash);
  }
  return SITE_COLORS[Math.abs(hash) % SITE_COLORS.length];
}

function selectAllTabs() {
  tabList.querySelectorAll('input[type="checkbox"]:not(:disabled)').forEach((cb) => {
    cb.checked = true;
    cb.closest(".tab-item")?.classList.add("selected");
  });
  updateSelectionUi();
}

function clearAllTabs() {
  tabList.querySelectorAll('input[type="checkbox"]').forEach((cb) => {
    cb.checked = false;
    cb.closest(".tab-item")?.classList.remove("selected");
  });
  updateSelectionUi();
}

function updateSelectionUi() {
  const selected = getSelectedUrls();
  const patterns = patternsFromUrls(selected);

  selectionCount.textContent = `${selected.length} selected`;

  patternChips.innerHTML = "";
  patterns.forEach((pattern) => {
    const chip = document.createElement("span");
    chip.className = "pattern-chip";
    chip.title = pattern;
    chip.textContent = shortenPattern(pattern);
    patternChips.appendChild(chip);
  });

  patternSummary.classList.toggle("hidden", patterns.length === 0);
}

function shortenPattern(pattern) {
  try {
    const match = pattern.match(/^(\w+:\/\/)([^/]+)/);
    if (match) {
      return match[2].replace(/^www\./, "");
    }
  } catch {
    // fall through
  }
  return pattern;
}

function getSelectedUrls() {
  return [...tabList.querySelectorAll('input[type="checkbox"]:checked')].map((cb) => cb.value);
}

function renderPatternChips(container, patterns) {
  container.innerHTML = "";
  if (!patterns.length) return;

  const label = document.createElement("span");
  label.className = "summary-label";
  label.textContent = "Allowing";
  container.appendChild(label);

  const chips = document.createElement("div");
  chips.className = "pattern-chips";
  patterns.forEach((pattern) => {
    const chip = document.createElement("span");
    chip.className = "pattern-chip";
    chip.title = pattern;
    chip.textContent = shortenPattern(pattern);
    chips.appendChild(chip);
  });
  container.appendChild(chips);
}

async function startSession() {
  const duration = Number(durationInput.value) || 25;
  const whitelistUrls = getSelectedUrls();

  if (whitelistUrls.length === 0) {
    setStatus("Select at least one allowed site.");
    return;
  }

  const response = await chrome.runtime.sendMessage({
    type: "START_SESSION",
    durationMinutes: duration,
    whitelistUrls,
  });

  if (!response?.ok) {
    setStatus(response?.error || "Could not start session.");
    return;
  }

  setStatus("Session started. Companion panel opened.");
  await refreshState();
}

async function stopSession() {
  const response = await chrome.runtime.sendMessage({ type: "STOP_SESSION" });

  if (!response?.ok) {
    setStatus(response?.error || "Could not stop session.");
    return;
  }

  setStatus("Session stopped. No rewards this time.");
  await refreshState();
}

async function refreshState() {
  const state = await chrome.runtime.sendMessage({ type: "GET_STATE" });
  if (!state) return;

  catLevelEl.textContent = state.catLevel;
  kibbleCountEl.textContent = state.kibble;
  moodLabelEl.textContent = MOOD_LABELS[state.moodState] || "Neutral";
  catImage.src = getCatSpritePath(state.activeCatBreed, state.moodState);

  if (state.sessionActive) {
    sessionIdle.classList.add("hidden");
    sessionActive.classList.remove("hidden");
    timerEl.textContent = formatTime(state.remainingSeconds);
    interruptionCountEl.textContent = state.interruptions;
    durationInput.value = state.durationMinutes;
    renderPatternChips(activePatterns, state.whitelistPatterns);
    lastInterruptions = state.interruptions;
    lastDurationMinutes = state.durationMinutes;
    lastRemainingSeconds = state.remainingSeconds;
    wasSessionActive = true;
  } else {
    if (wasSessionActive && lastRemainingSeconds <= 0) {
      if (lastInterruptions === 0) {
        setStatus(`Session complete! +${lastDurationMinutes} kibble and level up!`);
      } else {
        setStatus("Session ended with interruptions. No kibble this time.");
      }
    }
    wasSessionActive = false;
    sessionIdle.classList.remove("hidden");
    sessionActive.classList.add("hidden");
    activePatterns.innerHTML = "";
  }
}

function formatTime(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function setStatus(message) {
  statusMessage.textContent = message;
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

function escapeAttr(text) {
  return escapeHtml(text).replace(/"/g, "&quot;");
}
