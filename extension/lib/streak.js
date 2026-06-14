function getTodayKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function getYesterdayKey(date = new Date()) {
  const d = new Date(date);
  d.setDate(d.getDate() - 1);
  return getTodayKey(d);
}

function computeDailyStats(sessionHistory, dateKey = getTodayKey()) {
  const todaySessions = (sessionHistory || []).filter((s) => s.date === dateKey);
  const focusSessions = todaySessions.filter((s) => s.phase !== "break");

  return {
    date: dateKey,
    sessionCount: focusSessions.length,
    completedCount: focusSessions.filter((s) => s.completed).length,
    uninterruptedCount: focusSessions.filter((s) => s.uninterrupted).length,
    focusMinutes: focusSessions.reduce(
      (sum, s) => sum + (s.completed && s.phase !== "break" ? s.durationMinutes : 0),
      0
    ),
    interruptions: focusSessions.reduce((sum, s) => sum + (s.interruptions || 0), 0),
    kibbleEarned: todaySessions.reduce((sum, s) => sum + (s.kibbleAwarded || 0), 0),
  };
}

function formatSessionTime(timestamp) {
  return new Date(timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatSessionDate(dateKey) {
  const today = getTodayKey();
  if (dateKey === today) return "Today";
  if (dateKey === getYesterdayKey()) return "Yesterday";
  return dateKey;
}

function computeStreak(lastPerfectSessionDate, streakCount) {
  if (!lastPerfectSessionDate) {
    return { streak: 0, active: false };
  }

  const today = getTodayKey();
  const yesterday = getYesterdayKey();

  if (lastPerfectSessionDate === today || lastPerfectSessionDate === yesterday) {
    return { streak: streakCount ?? 0, active: true };
  }

  return { streak: streakCount ?? 0, active: false };
}

async function updateStreakOnPerfectSession() {
  const today = getTodayKey();
  const stored = await chrome.storage.local.get(["streakCount", "lastPerfectSessionDate"]);
  const lastDate = stored.lastPerfectSessionDate;

  if (lastDate === today) {
    return stored.streakCount ?? 1;
  }

  let streak = 1;
  if (lastDate === getYesterdayKey()) {
    streak = (stored.streakCount ?? 0) + 1;
  }

  await chrome.storage.local.set({
    streakCount: streak,
    lastPerfectSessionDate: today,
  });

  return streak;
}
