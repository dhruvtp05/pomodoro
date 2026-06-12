function urlToWhitelistPattern(urlString) {
  try {
    const url = new URL(urlString);
    if (url.protocol === "chrome:" || url.protocol === "chrome-extension:" || url.protocol === "edge:") {
      return null;
    }
    if (url.protocol === "about:") {
      return null;
    }
    return `${url.protocol}//${url.host}/*`;
  } catch {
    return null;
  }
}

function patternsFromUrls(urls) {
  const patterns = new Set();
  for (const url of urls || []) {
    const pattern = urlToWhitelistPattern(url);
    if (pattern) {
      patterns.add(pattern);
    }
  }
  return [...patterns];
}

function patternToRegExp(pattern) {
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*");
  return new RegExp(`^${escaped}$`);
}

function isUrlWhitelisted(urlString, patterns, extensionOrigin) {
  if (!urlString) {
    return false;
  }

  if (extensionOrigin && urlString.startsWith(extensionOrigin)) {
    return true;
  }

  if (urlString === "about:blank" || urlString === "chrome://newtab/") {
    return false;
  }

  for (const pattern of patterns || []) {
    if (patternToRegExp(pattern).test(urlString)) {
      return true;
    }
  }

  return false;
}
