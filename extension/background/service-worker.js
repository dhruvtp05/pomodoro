importScripts("../lib/urlWhitelist.js");

const BLOCKED_PAGE = chrome.runtime.getURL("pages/blocked/blocked.html");
const EXTENSION_ORIGIN = chrome.runtime.getURL("");
const MOOD_PER_MINUTE = 1;
const MOOD_PENALTY = 10;
const MOOD_NEUTRAL = 50;
const MOOD_HAPPY = 65;
const MOOD_SAD = 35;
const MAX_HISTORY = 100;

let session = null;

async function ensureSessionLoaded() {
  if (session) return session;

  const stored = await chrome.storage.local.get("activeSession");
  if (!stored.activeSession?.active) {
    return null;
  }

  session = stored.activeSession;

  if (session.whitelistTabIds && !session.whitelistPatterns) {
    session = null;
    await chrome.storage.local.remove("activeSession");
    return null;
  }

  return session;
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get(
    ["kibble", "catLevel", "activeCatBreed", "ownedCats", "sessionHistory"],
    (data) => {
      chrome.storage.local.set({
        kibble: data.kibble ?? 0,
        catLevel: data.catLevel ?? 1,
        activeCatBreed: data.activeCatBreed ?? "default",
        ownedCats: data.ownedCats ?? ["default"],
        sessionHistory: data.sessionHistory ?? [],
      });
    }
  );

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
  if (!session?.active) return;
  await handleTabAccess(activeInfo.tabId);
});

chrome.webNavigation.onBeforeNavigate.addListener(async (details) => {
  await ensureSessionLoaded();
  if (!session?.active) return;
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
      return startSession(message.durationMinutes, message.whitelistUrls);
    case "STOP_SESSION":
      return stopSession(false);
    case "OPEN_SIDE_PANEL":
      return openSidePanel(message.windowId);
    default:
      return { ok: false, error: "Unknown message type" };
  }
}

async function startSession(durationMinutes, whitelistUrls) {
  if (session?.active) {
    return { ok: false, error: "Session already active" };
  }

  const duration = Math.max(1, Number(durationMinutes) || 25);
  const whitelistPatterns = patternsFromUrls(whitelistUrls);

  if (whitelistPatterns.length === 0) {
    return { ok: false, error: "Select at least one site with a valid URL." };
  }

  session = {
    active: true,
    durationMinutes: duration,
    startTime: Date.now(),
    whitelistPatterns,
    interruptions: 0,
    moodPoints: MOOD_NEUTRAL,
    lastMoodMinute: 0,
  };

  await chrome.alarms.create("pomodoro-session", { delayInMinutes: duration });
  await persistSession();
  await enforceActiveTab();
  await openSidePanelForCurrentWindow();

  return { ok: true, state: await getPublicState() };
}

async function stopSession(completed) {
  if (!session?.active) {
    return { ok: false, error: "No active session" };
  }

  await chrome.alarms.clear("pomodoro-session");

  const snapshot = { ...session };
  const uninterrupted = snapshot.interruptions === 0;
  let kibbleAwarded = 0;

  if (completed && uninterrupted) {
    kibbleAwarded = snapshot.durationMinutes;
    const stored = await chrome.storage.local.get(["kibble", "catLevel"]);
    await chrome.storage.local.set({
      kibble: (stored.kibble ?? 0) + kibbleAwarded,
      catLevel: (stored.catLevel ?? 1) + 1,
    });
  }

  await recordSessionHistory({
    startTime: snapshot.startTime,
    durationMinutes: snapshot.durationMinutes,
    completed,
    interruptions: snapshot.interruptions,
    uninterrupted: completed && uninterrupted,
    kibbleAwarded,
    whitelistPatterns: snapshot.whitelistPatterns,
  });

  session = null;
  await chrome.storage.local.remove("activeSession");

  return { ok: true, completed, uninterrupted, kibbleAwarded };
}

async function completeSession() {
  const uninterrupted = session?.interruptions === 0;
  await stopSession(true);
  return { ok: true, uninterrupted };
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
    completed: entry.completed,
    interruptions: entry.interruptions,
    uninterrupted: entry.uninterrupted,
    kibbleAwarded: entry.kibbleAwarded,
    whitelistPatterns: entry.whitelistPatterns,
  });

  await chrome.storage.local.set({ sessionHistory: history.slice(0, MAX_HISTORY) });
}

async function handleTabAccess(tabId, navigatedUrl) {
  if (!session?.active) return;

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
    session.moodPoints += gained * MOOD_PER_MINUTE;
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
  ]);

  if (session?.active) {
    await persistSession();
  }

  const moodPoints = session?.moodPoints ?? MOOD_NEUTRAL;

  return {
    sessionActive: Boolean(session?.active),
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
  };
}

async function getStatsPayload() {
  const stored = await chrome.storage.local.get("sessionHistory");
  const sessionHistory = stored.sessionHistory ?? [];
  const today = new Date().toISOString().slice(0, 10);

  const todaySessions = sessionHistory.filter((s) => s.date === today);

  return {
    daily: {
      date: today,
      sessionCount: todaySessions.length,
      completedCount: todaySessions.filter((s) => s.completed).length,
      uninterruptedCount: todaySessions.filter((s) => s.uninterrupted).length,
      focusMinutes: todaySessions.reduce((sum, s) => sum + (s.completed ? s.durationMinutes : 0), 0),
      interruptions: todaySessions.reduce((sum, s) => sum + (s.interruptions || 0), 0),
      kibbleEarned: todaySessions.reduce((sum, s) => sum + (s.kibbleAwarded || 0), 0),
    },
    sessionHistory,
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
