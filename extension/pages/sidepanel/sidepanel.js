const idleView = document.getElementById("idle-view");
const sessionView = document.getElementById("session-view");
const idleCat = document.getElementById("idle-cat");
const catImage = document.getElementById("cat-image");
const timerEl = document.getElementById("timer");
const moodLabelEl = document.getElementById("mood-label");
const catLevelEl = document.getElementById("cat-level");
const kibbleCountEl = document.getElementById("kibble-count");
const interruptionCountEl = document.getElementById("interruption-count");
const patternList = document.getElementById("pattern-list");

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("brand-mark").src = getAssetUrl("assets/icons/app-mark.svg");
  idleCat.src = getCatSpritePath("default", "neutral");
  refreshState();
  setInterval(refreshState, 1000);
});

async function refreshState() {
  const state = await chrome.runtime.sendMessage({ type: "GET_STATE" });
  if (!state) return;

  const sprite = getCatSpritePath(state.activeCatBreed, state.moodState);
  idleCat.src = getCatSpritePath(state.activeCatBreed, "neutral");

  if (state.sessionActive) {
    idleView.classList.add("hidden");
    sessionView.classList.remove("hidden");

    catImage.src = sprite;
    timerEl.textContent = formatTime(state.remainingSeconds);
    moodLabelEl.textContent = MOOD_LABELS[state.moodState] || "Neutral";
    catLevelEl.textContent = state.catLevel;
    kibbleCountEl.textContent = state.kibble;
    interruptionCountEl.textContent = state.interruptions;

    patternList.innerHTML = "";
    (state.whitelistPatterns || []).forEach((pattern) => {
      const li = document.createElement("li");
      li.textContent = pattern;
      patternList.appendChild(li);
    });
  } else {
    idleView.classList.remove("hidden");
    sessionView.classList.add("hidden");
  }
}

function formatTime(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}
