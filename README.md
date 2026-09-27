# Anime Explorer

Anime Explorer is a web application that lets users search, browse, filter, and save anime using live data from the Jikan (MyAnimeList) API. The app loads results in pages, allows filtering and sorting, shows details in a pop-up window, and saves favorites in the browser using local storage.

**Live site:** https://ibrahim-zoulkarnein-anime-explorer.github.io/anime-explorer/

---

Ai Usage: [View Documentation](https://docs.google.com/document/d/1Bs2bp5pbq0skzaUaQhxRokhxhmveg--JVWugvN_1kRA/edit?usp=sharing)

---

## Team Members

* Ibrahima
* Zulka

---

## API

**API:** Jikan REST API (Unofficial MyAnimeList API)
Base URL:

```
https://api.jikan.moe/v4
```

### Endpoints Used

**GET /v4/anime**

* `q` – search query
* `type` – tv, movie, ova, ona, or special
* `min_score` – minimum rating filter
* `status` – airing, complete, or upcoming
* `order_by` / `sort` – sort by popularity (`members`), rating (`score`), newest (`start_date`), or title
* `sfw` – hide adult titles
* `page` – pagination
* `limit` – number of results (24 per page)

**GET /v4/anime/{id}**

* Retrieves detailed anime information by MAL ID (used when opening a saved anime)

**GET /v4/top/anime**

* Fallback when MyAnimeList is down: Jikan still serves this list from its cache, so the app shows cached top anime (filtered in the browser) instead of an empty page

Jikan allows about 3 requests per second, so the app spaces out requests, retries failed ones, and caches responses it has already loaded.

---

## Features

* Search for anime by name
* Browse the most popular anime
* Filter by type, rating, and status, and sort by popularity, rating, date, or title
* Get a random anime suggestion (respects the active filters)
* View full anime details in a pop-up, including genres, studio, and trailer
* Load more results
* Save anime to favorites from any card or the pop-up, and view them in the Saved tab
* Search and filters are kept in the URL, so refreshing or sharing a link keeps them
* Clear loading, empty, and error states with a "Try again" button
* Works with a keyboard (press `/` to jump to search) and on phones

---

## Setup Instructions

Requires Node.js 20.19+ or 22.12+.

### Install dependencies

```
npm install
```

### Run development server

```
npm run dev
```

Then open http://localhost:5173 in your browser.

### Build and preview the production version

```
npm run build
npm run preview
```

Then open http://localhost:4173/anime-explorer/.

Pushing to `main` deploys the site to GitHub Pages automatically (see `.github/workflows/deploy.yml`).

---

## Screenshots

### HomePage
![Homepage Grid](./screenshot/home_page.png)

### Pop Up Menu
![Modal View](./screenshot/pop_up_menu.png)

### bookMark tab
![Saved Page](./screenshot/bookmark_tab.png)
