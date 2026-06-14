const durationInput = document.getElementById("duration");
const tabList = document.getElementById("tab-list");
const whitelistSection = document.getElementById("whitelist-section");
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
const phaseLabel = document.getElementById("phase-label");
const sessionMetaActive = document.getElementById("session-meta-active");
const interruptionCountEl = document.getElementById("interruption-count");
const catImage = document.getElementById("cat-image");
const catLevelEl = document.getElementById("cat-level");
const moodLabelEl = document.getElementById("mood-label");
const kibbleCountEl = document.getElementById("kibble-count");
const streakCountEl = document.getElementById("streak-count");
const statusMessage = document.getElementById("status-message");
const onboarding = document.getElementById("onboarding");

const SITE_COLORS = ["#4A7C59", "#6B8E9B", "#C47D5A", "#8B6BA8", "#5A8F7B", "#A67B5B"];

let pollInterval = null;
let wasSessionActive = false;
let lastPhase = "focus";
let lastInterruptions = 0;
let lastDurationMinutes = 25;
let lastRemainingSeconds = 0;
let selectedPhase = "focus";
let onboardDuration = 25;

function initPopup() {
  document.getElementById("brand-mark").src = getAssetUrl("assets/icons/app-mark.svg");
  initPageNav("panel");
  setupOnboarding();

  startBtn.addEventListener("click", startSession);
  stopBtn.addEventListener("click", stopSession);
  selectAllBtn.addEventListener("click", selectAllTabs);
  clearAllBtn.addEventListener("click", clearAllTabs);
  tabList.addEventListener("change", updateSelectionUi);
  durationInput.addEventListener("input", () => clearPresetSelection());

  document.querySelectorAll("#focus-presets .preset-btn, #break-presets .preset-btn").forEach((btn) => {
    btn.addEventListener("click", () => selectPreset(btn));
  });

  loadTabs().then(async () => {
    const defaultPreset = document.querySelector('#focus-presets .preset-btn[data-duration="25"]');
    if (defaultPreset) selectPreset(defaultPreset);

    const state = await refreshState();
    if (state && !state.settings?.onboardingComplete) {
      showOnboarding(state.settings?.defaultDuration ?? 25);
    }
    pollInterval = setInterval(refreshState, 1000);
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initPopup);
} else {
  initPopup();
}

function selectPreset(btn) {
  const row = btn.closest(".preset-row");
  row.querySelectorAll(".preset-btn").forEach((b) => b.classList.remove("active"));
  btn.classList.add("active");

  selectedPhase = btn.dataset.phase || "focus";
  durationInput.value = btn.dataset.duration;

  const isBreak = selectedPhase === "break";
  whitelistSection.classList.toggle("hidden", isBreak);
  startBtn.textContent = isBreak ? "Start Break" : "Start Focus Session";
  startBtn.classList.toggle("primary", !isBreak);
  startBtn.classList.toggle("break-btn", isBreak);

  if (isBreak) {
    startBtn.disabled = false;
  } else {
    startBtn.disabled = tabList.querySelectorAll('input[type="checkbox"]:not(:disabled)').length === 0
      && !tabList.querySelector('input[type="checkbox"]:checked');
  }
}

function clearPresetSelection() {
  document.querySelectorAll(".preset-btn").forEach((b) => b.classList.remove("active"));
}

function setupOnboarding() {
  const steps = [
    document.getElementById("onboard-step-1"),
    document.getElementById("onboard-step-2"),
    document.getElementById("onboard-step-3"),
  ];
  let step = 0;

  document.querySelectorAll(".onboard-next").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (step >= steps.length - 1) return;
      steps[step].classList.add("hidden");
      step += 1;
      steps[step].classList.remove("hidden");
    });
  });

  document.querySelectorAll(".onboard-presets .preset-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".onboard-presets .preset-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      onboardDuration = Number(btn.dataset.duration) || 25;
    });
  });

  document.getElementById("onboard-finish").addEventListener("click", finishOnboarding);
}

async function finishOnboarding() {
  const finishBtn = document.getElementById("onboard-finish");
  finishBtn.disabled = true;

  try {
    await chrome.storage.local.set({
      onboardingComplete: true,
      defaultDuration: onboardDuration,
      notificationsEnabled: document.getElementById("onboard-notifications").checked,
      notificationSound: document.getElementById("onboard-sound").checked,
    });
  } catch (error) {
    console.error("Failed to save onboarding settings:", error);
    setStatus("Could not save settings. Try again.");
    finishBtn.disabled = false;
    return;
  }

  onboarding.classList.add("hidden");
  onboarding.setAttribute("aria-hidden", "true");
  durationInput.value = onboardDuration;

  const presetBtn =
    document.querySelector(`#focus-presets .preset-btn[data-duration="${onboardDuration}"]`)
    || document.querySelector("#focus-presets .preset-btn");
  if (presetBtn) selectPreset(presetBtn);

  finishBtn.disabled = false;
  setStatus("You're all set! Pick sites and start your first session.");
}

function showOnboarding(defaultDuration) {
  onboardDuration = defaultDuration;

  document.getElementById("onboard-step-1").classList.remove("hidden");
  document.getElementById("onboard-step-2").classList.add("hidden");
  document.getElementById("onboard-step-3").classList.add("hidden");

  const onboardCat = document.getElementById("onboard-cat");
  if (onboardCat) {
    onboardCat.src = getCatSpritePath("default", "happy");
  }

  document.querySelectorAll(".onboard-presets .preset-btn").forEach((btn) => {
    btn.classList.toggle("active", Number(btn.dataset.duration) === defaultDuration);
  });

  onboarding.classList.remove("hidden");
  onboarding.setAttribute("aria-hidden", "false");
}

async function loadTabs() {
  const tabs = await chrome.tabs.query({ currentWindow: true });
  tabList.innerHTML = "";

  const usableTabs = tabs.filter((tab) => tab.url && !tab.url.startsWith("chrome-extension://"));

  if (usableTabs.length === 0) {
    tabList.innerHTML = '<p class="empty-tabs">No open tabs in this window.</p>';
    if (selectedPhase !== "break") startBtn.disabled = true;
    updateSelectionUi();
    return;
  }

  if (selectedPhase !== "break") startBtn.disabled = false;

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
    if (match) return match[2].replace(/^www\./, "");
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
  const isBreak = selectedPhase === "break";
  const whitelistUrls = isBreak ? [] : getSelectedUrls();

  if (!isBreak && whitelistUrls.length === 0) {
    setStatus("Select at least one allowed site.");
    return;
  }

  const response = await chrome.runtime.sendMessage({
    type: "START_SESSION",
    durationMinutes: duration,
    whitelistUrls,
    phase: selectedPhase,
    autoBreakAfter: !isBreak,
  });

  if (!response?.ok) {
    setStatus(response?.error || "Could not start session.");
    return;
  }

  setStatus(isBreak ? "Break started — browse freely!" : "Focus session started.");
  await refreshState();
}

async function stopSession() {
  const response = await chrome.runtime.sendMessage({ type: "STOP_SESSION" });

  if (!response?.ok) {
    setStatus(response?.error || "Could not stop session.");
    return;
  }

  setStatus("Session stopped.");
  await refreshState();
}

async function refreshState() {
  const state = await chrome.runtime.sendMessage({ type: "GET_STATE" });
  if (!state) return null;

  catLevelEl.textContent = state.catLevel;
  kibbleCountEl.textContent = state.kibble;
  moodLabelEl.textContent = MOOD_LABELS[state.moodState] || "Neutral";
  catImage.src = getCatSpritePath(state.activeCatBreed, state.moodState);

  streakCountEl.textContent = state.streakActive ? `${state.streak}🔥` : state.streak;
  streakCountEl.classList.toggle("streak-hot", state.streakActive && state.streak > 0);

  if (state.sessionActive) {
    sessionIdle.classList.add("hidden");
    sessionActive.classList.remove("hidden");

    const isBreak = state.sessionPhase === "break";
    phaseLabel.textContent = isBreak ? "Break time" : "Focus session";
    phaseLabel.classList.toggle("break", isBreak);
    timerEl.textContent = formatTime(state.remainingSeconds);
    sessionMetaActive.classList.toggle("hidden", isBreak);
    interruptionCountEl.textContent = state.interruptions;
    durationInput.value = state.durationMinutes;

    if (!isBreak) {
      renderPatternChips(activePatterns, state.whitelistPatterns);
    } else {
      activePatterns.innerHTML = "";
    }

    lastPhase = state.sessionPhase;
    lastInterruptions = state.interruptions;
    lastDurationMinutes = state.durationMinutes;
    lastRemainingSeconds = state.remainingSeconds;
    wasSessionActive = true;
  } else {
    if (wasSessionActive && lastRemainingSeconds <= 0) {
      if (lastPhase === "break") {
        setStatus("Break over! Ready for another focus session?");
      } else if (lastInterruptions === 0) {
        setStatus(`Focus complete! +${lastDurationMinutes} kibble and level up!`);
      } else {
        setStatus("Focus ended with interruptions. No kibble this time.");
      }
    }
    wasSessionActive = false;
    sessionIdle.classList.remove("hidden");
    sessionActive.classList.add("hidden");
    activePatterns.innerHTML = "";
  }

  return state;
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
