const statStreak = document.getElementById("stat-streak");
const statSessions = document.getElementById("stat-sessions");
const statMinutes = document.getElementById("stat-minutes");
const statUninterrupted = document.getElementById("stat-uninterrupted");
const statInterruptions = document.getElementById("stat-interruptions");
const statKibble = document.getElementById("stat-kibble");
const historyList = document.getElementById("history-list");

document.addEventListener("DOMContentLoaded", () => {
  initPageNav("stats");
  loadStats();
});

async function loadStats() {
  const data = await chrome.runtime.sendMessage({ type: "GET_STATS" });
  if (!data) return;

  const daily = data.daily;
  statStreak.textContent = data.streakActive ? `${data.streak} days` : `${data.streak} (inactive)`;
  statSessions.textContent = daily.sessionCount;
  statMinutes.textContent = daily.focusMinutes;
  statUninterrupted.textContent = daily.uninterruptedCount;
  statInterruptions.textContent = daily.interruptions;
  statKibble.textContent = daily.kibbleEarned;

  renderHistory(data.sessionHistory || []);
}

function renderHistory(sessions) {
  historyList.innerHTML = "";

  if (sessions.length === 0) {
    historyList.innerHTML = '<p class="history-empty">No sessions yet. Complete a focus session to see history here.</p>';
    return;
  }

  sessions.forEach((session) => {
    const item = document.createElement("div");
    item.className = "history-item";

    const badge = getBadge(session);
    const timeRange = `${formatSessionTime(session.startTime)} – ${formatSessionTime(session.endTime)}`;

    const phaseLabel = session.phase === "break" ? " · Break" : "";
    item.innerHTML = `
      <div class="history-top">
        <span class="history-date">${formatSessionDate(session.date)}${phaseLabel}</span>
        <span class="history-badge ${badge.className}">${badge.label}</span>
      </div>
      <div class="history-details">
        ${timeRange} · ${session.durationMinutes} min · ${session.interruptions} interruption${session.interruptions === 1 ? "" : "s"}
        ${session.kibbleAwarded ? ` · +${session.kibbleAwarded} kibble` : ""}
      </div>
    `;

    historyList.appendChild(item);
  });
}

function getBadge(session) {
  if (session.phase === "break") {
    return { label: "Break", className: "partial" };
  }
  if (session.uninterrupted) {
    return { label: "Perfect", className: "success" };
  }
  if (session.completed) {
    return { label: "Completed", className: "partial" };
  }
  return { label: "Stopped", className: "stopped" };
}
