# Sports App Charts

A static web page that shows the **top Sports apps** on both the **iOS App Store** and **Google Play**, broken down by country. Pick countries with checkboxes, switch between stores, and choose how many to show (**Top 10 / 50 / 100**) — laid out as ranked columns per country.

![Country columns of ranked Sports apps](docs/preview.png)

## How it works

The site itself is **100% static** (plain `index.html` / `styles.css` / `app.js`, no runtime backend). All ranking data is fetched **at build time** by a Node script and written to static JSON files under `public/data/`, because:

- **iOS** — Apple's iTunes RSS feed (`genre=6004`, Sports) is used for the top-free list; ratings come from the iTunes Lookup API.
- **Android** — Google Play has no public API and no CORS, so `google-play-scraper` (Node-only) is used. It cannot run in a browser, hence the build-time step.

A daily **GitHub Action** re-runs the fetch and commits fresh JSON.

## Local development

```bash
npm install          # install the build-time scraper
npm run fetch-data   # generate public/data/*.json (needs internet)
npm run serve        # serve ./public over HTTP (http://localhost:3000)
```

> Serve over HTTP (`npm run serve`), not by opening the file directly — `fetch('data/…')` needs an HTTP origin.

## Configuration

Edit `scripts/fetch-data.mjs`:

- `COUNTRIES` — the markets shown as checkboxes.
- `CATEGORY` / `APPLE_GENRE_SPORTS` / `gplay.category.SPORTS` — the category (currently Sports).
- `MAX_APPS` — apps fetched per store per country (default 100; the UI's Show dropdown displays the top 10 / 50 / 100 of these).

## Data shape

`public/data/index.json` lists countries + `generatedAt`. Each `public/data/<code>.json`:

```jsonc
{
  "code": "it", "name": "Italy", "flag": "🇮🇹", "category": "Sports",
  "generatedAt": "2026-07-03T...",
  "ios":     [ { "rank": 1, "name": "...", "developer": "...", "icon": "...", "rating": 4.7, "price": "Free", "url": "..." } ],
  "android": [ { "rank": 1, "name": "...", "developer": "...", "icon": "...", "rating": 3.8, "price": "Free", "url": "..." } ]
}
```

## Deploy

`public/` is the deploy root — publish it to GitHub Pages, Netlify, S3, etc. The GitHub Action in `.github/workflows/refresh-data.yml` keeps the committed JSON current (daily + manual `workflow_dispatch`).

## Note vs. paid tools

The numeric aggregator "score" badge (e.g. 81/100) seen in tools like AppFigures comes from a paid provider and isn't available from free sources. This app shows the **star rating** instead; rank, icon, name, developer, price and store are all real.
