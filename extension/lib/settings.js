const DEFAULT_SETTINGS = {
  notificationsEnabled: true,
  notificationSound: true,
  onboardingComplete: false,
  defaultDuration: 25,
  autoBreakEnabled: true,
};

async function getSettings() {
  const stored = await chrome.storage.local.get(Object.keys(DEFAULT_SETTINGS));
  return { ...DEFAULT_SETTINGS, ...stored };
}

async function saveSettings(partial) {
  const current = await getSettings();
  await chrome.storage.local.set({ ...current, ...partial });
}
