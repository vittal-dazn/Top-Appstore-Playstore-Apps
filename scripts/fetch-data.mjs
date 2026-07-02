// Build-time data generation for the Sports App Charts static site.
//
// Fetches the top 10 free Sports apps per country from:
//   - iOS  : Apple iTunes RSS feed (genre 6004 = Sports) + iTunes Lookup for ratings
//   - Android: google-play-scraper (category SPORTS, collection TOP_FREE)
//
// Writes one JSON file per country to public/data/<code>.json plus an index.json.
// This runs in Node only (Google Play has no browser-usable API); the site itself
// stays 100% static and just reads the generated JSON.

import { writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import gplayPkg from "google-play-scraper";

const gplay = gplayPkg.default || gplayPkg;

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "..", "public", "data");

const CATEGORY = "Sports";
const APPLE_GENRE_SPORTS = 6004; // iOS App Store genre id for Sports
const LIMIT = 10;

// Markets. `code` is the 2-letter store storefront (UK = gb for both stores).
const COUNTRIES = [
  { code: "us", name: "United States", flag: "🇺🇸" },
  { code: "ca", name: "Canada", flag: "🇨🇦" },
  { code: "gb", name: "United Kingdom", flag: "🇬🇧" },
  { code: "de", name: "Germany", flag: "🇩🇪" },
  { code: "at", name: "Austria", flag: "🇦🇹" },
  { code: "ch", name: "Switzerland", flag: "🇨🇭" },
  { code: "it", name: "Italy", flag: "🇮🇹" },
  { code: "es", name: "Spain", flag: "🇪🇸" },
  { code: "jp", name: "Japan", flag: "🇯🇵" },
  { code: "fr", name: "France", flag: "🇫🇷" },
  { code: "br", name: "Brazil", flag: "🇧🇷" },
  { code: "pt", name: "Portugal", flag: "🇵🇹" },
  { code: "be", name: "Belgium", flag: "🇧🇪" },
  { code: "ie", name: "Ireland", flag: "🇮🇪" },
  { code: "nl", name: "Netherlands", flag: "🇳🇱" },
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function round1(n) {
  return typeof n === "number" && !Number.isNaN(n) ? Math.round(n * 10) / 10 : null;
}

// --- iOS -------------------------------------------------------------------

async function fetchIosRatings(appIds, country) {
  if (appIds.length === 0) return {};
  try {
    const url = `https://itunes.apple.com/lookup?id=${appIds.join(",")}&country=${country}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`lookup HTTP ${res.status}`);
    const data = await res.json();
    const map = {};
    for (const r of data.results || []) {
      if (r.trackId != null) {
        map[String(r.trackId)] = round1(r.averageUserRating);
      }
    }
    return map;
  } catch (err) {
    console.warn(`  ! iOS ratings lookup failed for ${country}: ${err.message}`);
    return {};
  }
}

async function fetchIos(country) {
  try {
    const url = `https://itunes.apple.com/${country}/rss/topfreeapplications/limit=${LIMIT}/genre=${APPLE_GENRE_SPORTS}/json`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`RSS HTTP ${res.status}`);
    const data = await res.json();
    const entries = data?.feed?.entry ?? [];

    const apps = entries.map((e, i) => {
      const images = e["im:image"] || [];
      const icon = images.length ? images[images.length - 1].label : null;
      const appId = e.id?.attributes?.["im:id"] ?? null;
      return {
        rank: i + 1,
        appId,
        name: e["im:name"]?.label ?? "Unknown",
        developer: e["im:artist"]?.label ?? "",
        icon,
        rating: null,
        // This is the "top free applications" feed, so every entry is free
        // (im:price is localized, e.g. "Get"/"Ottieni"/"Kostenlos").
        price: "Free",
        url: e.id?.label ?? null,
      };
    });

    const ratings = await fetchIosRatings(
      apps.map((a) => a.appId).filter(Boolean),
      country
    );
    for (const a of apps) {
      if (a.appId && ratings[a.appId] != null) a.rating = ratings[a.appId];
      delete a.appId;
    }
    return apps;
  } catch (err) {
    console.warn(`  ! iOS fetch failed for ${country}: ${err.message}`);
    return [];
  }
}

// --- Android ---------------------------------------------------------------

async function fetchAndroid(country) {
  try {
    const results = await gplay.list({
      category: gplay.category.SPORTS,
      collection: gplay.collection.TOP_FREE,
      country,
      lang: "en",
      num: LIMIT,
    });
    return results.slice(0, LIMIT).map((a, i) => ({
      rank: i + 1,
      name: a.title ?? "Unknown",
      developer: a.developer ?? "",
      icon: a.icon ?? null,
      rating: round1(a.score),
      price: a.free ? "Free" : a.priceText || a.price || "",
      url: a.url ?? null,
    }));
  } catch (err) {
    console.warn(`  ! Android fetch failed for ${country}: ${err.message}`);
    return [];
  }
}

// --- Main ------------------------------------------------------------------

async function main() {
  await mkdir(DATA_DIR, { recursive: true });
  const generatedAt = new Date().toISOString();

  for (const c of COUNTRIES) {
    process.stdout.write(`Fetching ${c.name} (${c.code})... `);
    const [ios, android] = await Promise.all([
      fetchIos(c.code),
      fetchAndroid(c.code),
    ]);
    const payload = { ...c, category: CATEGORY, generatedAt, ios, android };
    await writeFile(
      join(DATA_DIR, `${c.code}.json`),
      JSON.stringify(payload, null, 2)
    );
    console.log(`iOS ${ios.length}, Android ${android.length}`);
    // Gentle throttle to avoid Google Play rate limiting.
    await sleep(600);
  }

  const index = {
    generatedAt,
    category: CATEGORY,
    countries: COUNTRIES,
  };
  await writeFile(join(DATA_DIR, "index.json"), JSON.stringify(index, null, 2));
  console.log(`\nDone. Wrote ${COUNTRIES.length} country files + index.json to public/data/`);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
