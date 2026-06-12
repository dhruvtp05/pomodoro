function getTodayKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function computeDailyStats(sessionHistory, dateKey = getTodayKey()) {
  const todaySessions = (sessionHistory || []).filter((s) => s.date === dateKey);

  return {
    date: dateKey,
    sessionCount: todaySessions.length,
    completedCount: todaySessions.filter((s) => s.completed).length,
    uninterruptedCount: todaySessions.filter((s) => s.uninterrupted).length,
    focusMinutes: todaySessions.reduce((sum, s) => sum + (s.completed ? s.durationMinutes : 0), 0),
    interruptions: todaySessions.reduce((sum, s) => sum + (s.interruptions || 0), 0),
    kibbleEarned: todaySessions.reduce((sum, s) => sum + (s.kibbleAwarded || 0), 0),
  };
}

function formatSessionTime(timestamp) {
  return new Date(timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatSessionDate(dateKey) {
  const today = getTodayKey();
  if (dateKey === today) return "Today";
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  if (dateKey === getTodayKey(yesterday)) return "Yesterday";
  return dateKey;
}
