importScripts(
  "../lib/urlWhitelist.js",
  "../lib/streak.js",
  "../lib/settings.js"
);

const BLOCKED_PAGE = chrome.runtime.getURL("pages/blocked/blocked.html");
const EXTENSION_ORIGIN = chrome.runtime.getURL("");
const NOTIFICATION_ICON = chrome.runtime.getURL("assets/icon-128.png");
const MOOD_PER_MINUTE = 1;
const MOOD_BREAK_RECOVERY = 2;
const MOOD_PENALTY = 10;
const MOOD_NEUTRAL = 50;
const MOOD_HAPPY = 65;
const MOOD_SAD = 35;
const MOOD_MAX = 100;
const DEFAULT_BREAK_MINUTES = 5;
const MAX_HISTORY = 100;

let session = null;

async function ensureSessionLoaded() {
  if (session) return session;

  const stored = await chrome.storage.local.get("activeSession");
  if (!stored.activeSession?.active) {
    return null;
  }

  session = stored.activeSession;
  session.phase = session.phase || "focus";

  if (session.whitelistTabIds && !session.whitelistPatterns) {
    session = null;
    await chrome.storage.local.remove("activeSession");
    return null;
  }

  return session;
}

chrome.runtime.onInstalled.addListener(async (details) => {
  const data = await chrome.storage.local.get([
    "kibble",
    "catLevel",
    "activeCatBreed",
    "ownedCats",
    "sessionHistory",
    "streakCount",
    "lastPerfectSessionDate",
    ...Object.keys(DEFAULT_SETTINGS),
  ]);

  await chrome.storage.local.set({
    kibble: data.kibble ?? 0,
    catLevel: data.catLevel ?? 1,
    activeCatBreed: data.activeCatBreed ?? "default",
    ownedCats: data.ownedCats ?? ["default"],
    sessionHistory: data.sessionHistory ?? [],
    streakCount: data.streakCount ?? 0,
    lastPerfectSessionDate: data.lastPerfectSessionDate ?? null,
    ...DEFAULT_SETTINGS,
    ...data,
    onboardingComplete: details.reason === "install" ? false : (data.onboardingComplete ?? false),
  });

  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false });
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === "pomodoro-session") {
    await ensureSessionLoaded();
    await completeSession();
  }
});

chrome.tabs.onActivated.addListener(async (activeInfo) => {
  await ensureSessionLoaded();
  if (!session?.active || session.phase !== "focus") return;
  await handleTabAccess(activeInfo.tabId);
});

chrome.webNavigation.onBeforeNavigate.addListener(async (details) => {
  await ensureSessionLoaded();
  if (!session?.active || session.phase !== "focus") return;
  if (details.frameId !== 0) return;
  if (details.url.startsWith(EXTENSION_ORIGIN)) return;
  await handleTabAccess(details.tabId, details.url);
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  handleMessage(message).then(sendResponse);
  return true;
});

async function handleMessage(message) {
  await ensureSessionLoaded();

  switch (message.type) {
    case "GET_STATE":
      return getPublicState();
    case "GET_STATS":
      return getStatsPayload();
    case "START_SESSION":
      return startSession({
        durationMinutes: message.durationMinutes,
        whitelistUrls: message.whitelistUrls,
        phase: message.phase || "focus",
        autoBreakAfter: message.autoBreakAfter,
      });
    case "STOP_SESSION":
      return stopSession(false);
    case "OPEN_SIDE_PANEL":
      return openSidePanel(message.windowId);
    case "COMPLETE_ONBOARDING":
      return completeOnboarding(message.settings);
    default:
      return { ok: false, error: "Unknown message type" };
  }
}

async function completeOnboarding(settings) {
  await saveSettings({
    onboardingComplete: true,
    defaultDuration: settings?.defaultDuration ?? 25,
    notificationsEnabled: settings?.notificationsEnabled ?? true,
    notificationSound: settings?.notificationSound ?? true,
  });
  return { ok: true };
}

async function startSession({ durationMinutes, whitelistUrls, phase = "focus", autoBreakAfter }) {
  if (session?.active) {
    return { ok: false, error: "Session already active" };
  }

  const duration = Math.max(1, Number(durationMinutes) || 25);
  const isBreak = phase === "break";
  const whitelistPatterns = isBreak ? [] : patternsFromUrls(whitelistUrls);

  if (!isBreak && whitelistPatterns.length === 0) {
    return { ok: false, error: "Select at least one site with a valid URL." };
  }

  const settings = await getSettings();
  const shouldAutoBreak = !isBreak && (autoBreakAfter ?? settings.autoBreakEnabled);

  session = {
    active: true,
    phase: isBreak ? "break" : "focus",
    durationMinutes: duration,
    startTime: Date.now(),
    whitelistPatterns,
    whitelistUrls: whitelistUrls || [],
    interruptions: 0,
    moodPoints: MOOD_NEUTRAL,
    lastMoodMinute: 0,
    autoBreakAfter: shouldAutoBreak,
    breakMinutes: DEFAULT_BREAK_MINUTES,
  };

  if (isBreak) {
    session.moodPoints = Math.min(MOOD_MAX, session.moodPoints);
  }

  await chrome.alarms.create("pomodoro-session", { delayInMinutes: duration });
  await persistSession();

  if (!isBreak) {
    await enforceActiveTab();
    await openSidePanelForCurrentWindow();
  }

  return { ok: true, state: await getPublicState() };
}

async function startBreakFromFocus(snapshot, rewards = {}) {
  session = {
    active: true,
    phase: "break",
    durationMinutes: snapshot.breakMinutes || DEFAULT_BREAK_MINUTES,
    startTime: Date.now(),
    whitelistPatterns: snapshot.whitelistPatterns,
    whitelistUrls: snapshot.whitelistUrls || [],
    interruptions: 0,
    moodPoints: snapshot.moodPoints,
    lastMoodMinute: 0,
    autoBreakAfter: false,
    breakMinutes: snapshot.breakMinutes || DEFAULT_BREAK_MINUTES,
  };

  await chrome.alarms.create("pomodoro-session", {
    delayInMinutes: session.durationMinutes,
  });
  await persistSession();

  let message = "Tab blocking is paused — browse freely.";
  if (rewards.kibbleAwarded) {
    message = `+${rewards.kibbleAwarded} kibble earned! ${message}`;
  }
  if (rewards.streakUpdated) {
    message += ` ${rewards.streakUpdated}-day streak!`;
  }

  await showNotification("Break time!", message);
}

async function stopSession(completed) {
  if (!session?.active) {
    return { ok: false, error: "No active session" };
  }

  await chrome.alarms.clear("pomodoro-session");

  const snapshot = { ...session };
  const isBreak = snapshot.phase === "break";
  const uninterrupted = !isBreak && snapshot.interruptions === 0;
  let kibbleAwarded = 0;
  let streakUpdated = null;

  if (completed && !isBreak && uninterrupted) {
    kibbleAwarded = snapshot.durationMinutes;
    const stored = await chrome.storage.local.get(["kibble", "catLevel"]);
    streakUpdated = await updateStreakOnPerfectSession();
    await chrome.storage.local.set({
      kibble: (stored.kibble ?? 0) + kibbleAwarded,
      catLevel: (stored.catLevel ?? 1) + 1,
    });
  }

  await recordSessionHistory({
    startTime: snapshot.startTime,
    durationMinutes: snapshot.durationMinutes,
    phase: snapshot.phase,
    completed,
    interruptions: snapshot.interruptions,
    uninterrupted: completed && uninterrupted,
    kibbleAwarded,
    whitelistPatterns: snapshot.whitelistPatterns,
  });

  session = null;
  await chrome.storage.local.remove("activeSession");

  if (completed && !isBreak && snapshot.autoBreakAfter) {
    await startBreakFromFocus(snapshot, { kibbleAwarded, streakUpdated });
    return {
      ok: true,
      completed,
      uninterrupted,
      kibbleAwarded,
      streakUpdated,
      startedBreak: true,
      state: await getPublicState(),
    };
  }

  if (completed) {
    await notifySessionComplete(snapshot, uninterrupted, kibbleAwarded, streakUpdated);
  }

  return { ok: true, completed, uninterrupted, kibbleAwarded, streakUpdated };
}

async function notifySessionComplete(snapshot, uninterrupted, kibbleAwarded, streakUpdated) {
  const isBreak = snapshot.phase === "break";

  if (isBreak) {
    await showNotification(
      "Break over! 🐱",
      "Ready for another focus session? Your cat is waiting."
    );
    return;
  }

  if (uninterrupted) {
    let message = `+${kibbleAwarded} kibble and level up!`;
    if (streakUpdated) {
      message += ` ${streakUpdated}-day streak! 🔥`;
    }
    await showNotification("Focus session complete! 🎉", message);
    return;
  }

  await showNotification(
    "Session ended",
    "Completed with interruptions — no kibble this time. Your cat still believes in you."
  );
}

async function showNotification(title, message) {
  const settings = await getSettings();
  if (!settings.notificationsEnabled) return;

  try {
    await chrome.notifications.create(`purrmodoro-${Date.now()}`, {
      type: "basic",
      iconUrl: NOTIFICATION_ICON,
      title,
      message,
      silent: !settings.notificationSound,
      priority: 1,
    });
  } catch {
    // Notifications may be denied by the user.
  }
}

async function completeSession() {
  await stopSession(true);
}

async function recordSessionHistory(entry) {
  const stored = await chrome.storage.local.get("sessionHistory");
  const history = stored.sessionHistory ?? [];

  history.unshift({
    id: crypto.randomUUID(),
    date: new Date(entry.startTime).toISOString().slice(0, 10),
    startTime: entry.startTime,
    endTime: Date.now(),
    durationMinutes: entry.durationMinutes,
    phase: entry.phase || "focus",
    completed: entry.completed,
    interruptions: entry.interruptions,
    uninterrupted: entry.uninterrupted,
    kibbleAwarded: entry.kibbleAwarded,
    whitelistPatterns: entry.whitelistPatterns,
  });

  await chrome.storage.local.set({ sessionHistory: history.slice(0, MAX_HISTORY) });
}

async function handleTabAccess(tabId, navigatedUrl) {
  if (!session?.active || session.phase !== "focus") return;

  let tab;
  try {
    tab = await chrome.tabs.get(tabId);
  } catch {
    return;
  }

  const url = navigatedUrl || tab.pendingUrl || tab.url || "";

  if (isUrlWhitelisted(url, session.whitelistPatterns, EXTENSION_ORIGIN)) {
    return;
  }

  session.interruptions += 1;
  session.moodPoints = Math.max(0, session.moodPoints - MOOD_PENALTY);
  await persistSession();

  if (tab.url !== BLOCKED_PAGE) {
    try {
      await chrome.tabs.update(tabId, { url: BLOCKED_PAGE });
    } catch {
      // Tab may have closed mid-navigation.
    }
  }
}

async function enforceActiveTab() {
  const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (activeTab) {
    await handleTabAccess(activeTab.id);
  }
}

function updateMoodFromElapsed() {
  if (!session?.active) return;

  const elapsedMinutes = Math.floor((Date.now() - session.startTime) / 60000);
  const gained = elapsedMinutes - session.lastMoodMinute;

  if (gained > 0) {
    if (session.phase === "break") {
      session.moodPoints = Math.min(
        MOOD_MAX,
        session.moodPoints + gained * MOOD_BREAK_RECOVERY
      );
    } else {
      session.moodPoints += gained * MOOD_PER_MINUTE;
    }
    session.lastMoodMinute = elapsedMinutes;
  }
}

function getMoodState(moodPoints) {
  if (moodPoints >= MOOD_HAPPY) return "happy";
  if (moodPoints < MOOD_SAD) return "sad";
  return "neutral";
}

function getRemainingSeconds() {
  if (!session?.active) return 0;
  const totalMs = session.durationMinutes * 60 * 1000;
  const elapsed = Date.now() - session.startTime;
  return Math.max(0, Math.ceil((totalMs - elapsed) / 1000));
}

async function getPublicState() {
  await ensureSessionLoaded();
  updateMoodFromElapsed();

  const stored = await chrome.storage.local.get([
    "kibble",
    "catLevel",
    "activeCatBreed",
    "ownedCats",
    "streakCount",
    "lastPerfectSessionDate",
    ...Object.keys(DEFAULT_SETTINGS),
  ]);

  if (session?.active) {
    await persistSession();
  }

  const moodPoints = session?.moodPoints ?? MOOD_NEUTRAL;
  const streakInfo = computeStreak(stored.lastPerfectSessionDate, stored.streakCount);

  return {
    sessionActive: Boolean(session?.active),
    sessionPhase: session?.phase ?? null,
    durationMinutes: session?.durationMinutes ?? 0,
    remainingSeconds: getRemainingSeconds(),
    interruptions: session?.interruptions ?? 0,
    moodPoints,
    moodState: getMoodState(moodPoints),
    whitelistPatterns: session?.whitelistPatterns ?? [],
    kibble: stored.kibble ?? 0,
    catLevel: stored.catLevel ?? 1,
    activeCatBreed: stored.activeCatBreed ?? "default",
    ownedCats: stored.ownedCats ?? ["default"],
    streak: streakInfo.streak,
    streakActive: streakInfo.active,
    settings: { ...DEFAULT_SETTINGS, ...stored },
  };
}

async function getStatsPayload() {
  const stored = await chrome.storage.local.get([
    "sessionHistory",
    "streakCount",
    "lastPerfectSessionDate",
  ]);
  const sessionHistory = stored.sessionHistory ?? [];
  const today = getTodayKey();
  const streakInfo = computeStreak(stored.lastPerfectSessionDate, stored.streakCount);

  return {
    daily: computeDailyStats(sessionHistory, today),
    sessionHistory,
    streak: streakInfo.streak,
    streakActive: streakInfo.active,
  };
}

async function persistSession() {
  if (session?.active) {
    await chrome.storage.local.set({ activeSession: { ...session } });
  }
}

async function openSidePanelForCurrentWindow() {
  try {
    const [activeTab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    if (activeTab?.windowId) {
      await chrome.sidePanel.open({ windowId: activeTab.windowId });
    }
  } catch {
    // Side panel may require a newer Chrome build or user gesture.
  }
}

async function openSidePanel(windowId) {
  try {
    if (windowId) {
      await chrome.sidePanel.open({ windowId });
    } else {
      await openSidePanelForCurrentWindow();
    }
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error.message || "Could not open side panel." };
  }
}
