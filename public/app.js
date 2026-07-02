"use strict";

const STORAGE_KEYS = { countries: "sports-charts-countries", store: "sports-charts-store" };
const DEFAULT_COUNTRIES = ["es", "it", "jp"]; // matches the reference screenshot
const DEFAULT_STORE = "both";

const state = {
  countries: [], // [{code,name,flag}]
  selected: new Set(),
  store: DEFAULT_STORE, // "ios" | "android" | "both"
  cache: new Map(), // code -> country data JSON
};

const els = {
  checks: document.getElementById("country-checks"),
  columns: document.getElementById("columns"),
  updated: document.getElementById("updated"),
  storeToggle: document.getElementById("store-toggle"),
};

// --- init ------------------------------------------------------------------

async function init() {
  restorePrefs();

  let index;
  try {
    index = await fetchJSON("data/index.json");
  } catch (err) {
    els.columns.innerHTML = `<p class="placeholder">Could not load data (<code>data/index.json</code>). Run <code>npm run fetch-data</code> and serve the site over HTTP.</p>`;
    return;
  }

  state.countries = index.countries || [];
  if (index.generatedAt) {
    const d = new Date(index.generatedAt);
    els.updated.textContent = `Last updated: ${d.toLocaleString()} · Category: ${index.category || "Sports"}`;
  }

  if (state.selected.size === 0) {
    DEFAULT_COUNTRIES.forEach((c) => state.selected.add(c));
  }

  renderStoreToggle();
  renderChecks();
  render();
}

function restorePrefs() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEYS.countries) || "[]");
    if (Array.isArray(saved)) saved.forEach((c) => state.selected.add(c));
  } catch (_) {}
  const store = localStorage.getItem(STORAGE_KEYS.store);
  if (store === "ios" || store === "android" || store === "both") state.store = store;
}

function savePrefs() {
  localStorage.setItem(STORAGE_KEYS.countries, JSON.stringify([...state.selected]));
  localStorage.setItem(STORAGE_KEYS.store, state.store);
}

// --- controls --------------------------------------------------------------

function renderStoreToggle() {
  els.storeToggle.querySelectorAll(".store-btn").forEach((btn) => {
    btn.classList.toggle("is-active", btn.dataset.store === state.store);
  });
  els.storeToggle.addEventListener("click", (e) => {
    const btn = e.target.closest(".store-btn");
    if (!btn) return;
    state.store = btn.dataset.store;
    els.storeToggle.querySelectorAll(".store-btn").forEach((b) =>
      b.classList.toggle("is-active", b === btn)
    );
    savePrefs();
    render();
  });
}

function renderChecks() {
  els.checks.innerHTML = "";
  for (const c of state.countries) {
    const checked = state.selected.has(c.code);
    const label = document.createElement("label");
    label.className = "country-chip" + (checked ? " is-checked" : "");
    label.innerHTML = `
      <input type="checkbox" value="${c.code}" ${checked ? "checked" : ""} />
      <span class="flag">${c.flag}</span><span>${c.name}</span>`;
    label.querySelector("input").addEventListener("change", (e) => {
      if (e.target.checked) state.selected.add(c.code);
      else state.selected.delete(c.code);
      label.classList.toggle("is-checked", e.target.checked);
      savePrefs();
      render();
    });
    els.checks.appendChild(label);
  }
}

// --- rendering -------------------------------------------------------------

async function render() {
  const codes = state.countries
    .map((c) => c.code)
    .filter((code) => state.selected.has(code)); // keep index order

  if (codes.length === 0) {
    els.columns.innerHTML = `<p class="placeholder">Select one or more countries above to see their top Sports apps.</p>`;
    return;
  }

  // Ensure all needed data is loaded.
  await Promise.all(codes.map((code) => loadCountry(code)));

  els.columns.innerHTML = "";
  for (const code of codes) {
    const data = state.cache.get(code);
    if (data) els.columns.appendChild(buildColumn(data));
  }
}

async function loadCountry(code) {
  if (state.cache.has(code)) return;
  try {
    const data = await fetchJSON(`data/${code}.json`);
    state.cache.set(code, data);
  } catch (err) {
    state.cache.set(code, { code, name: code, flag: "🏳️", ios: [], android: [], error: true });
  }
}

function buildColumn(data) {
  const col = document.createElement("section");
  col.className = "country-col";

  const storeBadge =
    state.store === "ios"
      ? `<span class="badge store-ios">App Store</span>`
      : state.store === "android"
      ? `<span class="badge store-android">Google Play</span>`
      : "";

  col.innerHTML = `
    <div class="col-head">
      <span class="flag">${data.flag || ""}</span>
      <span class="cname">${data.name || data.code}</span>
      ${storeBadge}
      <span class="badge cat">${data.category || "Sports"}</span>
    </div>`;

  if (state.store === "both") {
    col.appendChild(buildStoreSection("ios", "App Store", data.ios));
    col.appendChild(buildStoreSection("android", "Google Play", data.android));
  } else {
    col.appendChild(buildList(data[state.store], state.store, false));
  }
  return col;
}

function buildStoreSection(store, label, apps) {
  const section = document.createElement("div");
  section.className = "store-section";
  section.innerHTML = `<div class="store-section-head"><span class="store-mini ${store}">${label}</span></div>`;
  section.appendChild(buildList(apps, store, true));
  return section;
}

function buildList(apps, store, showMini) {
  if (!apps || apps.length === 0) {
    const p = document.createElement("p");
    p.className = "empty";
    p.textContent = "No data available.";
    return p;
  }
  const ul = document.createElement("ul");
  ul.className = "app-list";
  for (const app of apps) {
    const li = document.createElement("li");
    const a = document.createElement("a");
    a.className = "app-row";
    a.href = app.url || "#";
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.innerHTML = `
      <span class="rank">${app.rank}</span>
      <img class="app-icon" loading="lazy" alt="" src="${app.icon || ""}" onerror="this.style.visibility='hidden'" />
      <span class="app-meta">
        <span class="app-name">${escapeHtml(app.name)}</span>
        <span class="app-dev">${escapeHtml(app.developer || "")}</span>
        <span class="app-sub">
          ${ratingHtml(app.rating)}
          <span class="price-tag">${escapeHtml(app.price || "")}</span>
        </span>
      </span>
      <span class="right">${showMini ? "" : `<span class="store-mini ${store}">${store === "ios" ? "iOS" : "Play"}</span>`}</span>`;
    li.appendChild(a);
    ul.appendChild(li);
  }
  return ul;
}

function ratingHtml(rating) {
  if (rating == null) return `<span class="rating">—</span>`;
  return `<span class="rating"><span class="star">★</span>${rating.toFixed(1)}</span>`;
}

// --- helpers ---------------------------------------------------------------

async function fetchJSON(url) {
  const res = await fetch(url, { cache: "no-cache" });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.json();
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

init();
