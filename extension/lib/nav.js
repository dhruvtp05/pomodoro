const NAV_PAGES = {
  panel: { label: "Panel", icon: "assets/icons/app-mark.svg", href: "../popup/popup.html" },
  stats: { label: "Stats", icon: "assets/icons/stats.svg", href: "../stats/stats.html" },
  shop: { label: "Shop", icon: "assets/icons/shop.svg", href: "../shop/shop.html" },
};

function createNavLink(page, active) {
  const link = document.createElement("a");
  link.className = "nav-btn";
  link.href = page.href;
  link.title = page.label;
  if (active) {
    link.classList.add("active");
    link.setAttribute("aria-current", "page");
  }

  const icon = document.createElement("img");
  icon.src = getAssetUrl(page.icon);
  icon.alt = "";
  icon.width = 18;
  icon.height = 18;

  const label = document.createElement("span");
  label.textContent = page.label;

  link.append(icon, label);
  return link;
}

function initPageNav(activePage) {
  const nav = document.getElementById("app-nav");
  if (!nav) return;

  nav.innerHTML = "";
  nav.setAttribute("aria-label", "Quick navigation");
  nav.append(
    createNavLink(NAV_PAGES.panel, activePage === "panel"),
    createNavLink(NAV_PAGES.stats, activePage === "stats"),
    createNavLink(NAV_PAGES.shop, activePage === "shop")
  );
}
