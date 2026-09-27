import { fetchAnime, fetchAnimeById, fetchCachedAnime, isAbortError, normalizeQuery } from "./fetch-data.js";

const grid = document.querySelector("#grid");
const searchInput = document.querySelector("#search-input");
const searchForm = document.querySelector("#search-form");
const browseBtn = document.querySelector("#browse-btn");
const randomBtn = document.querySelector("#random-btn");
const savedBtn = document.querySelector("#saved-btn");
const savedCount = document.querySelector("#saved-count");
const loadMoreBtn = document.querySelector("#load-more-btn");
const loadMoreWrap = document.querySelector("#load-more-wrap");
const resultsHeading = document.querySelector("#results-heading");
const resultsStatus = document.querySelector("#results-status");
const message = document.querySelector("#message");
const messageText = document.querySelector("#message-text");
const messageBtn = document.querySelector("#message-btn");
const toast = document.querySelector("#toast");

const filterType = document.querySelector("#filter-type");
const filterScore = document.querySelector("#filter-score");
const filterStatus = document.querySelector("#filter-status");
const sortBy = document.querySelector("#sort-by");

const modal = document.querySelector("#modal");
const modalBox = document.querySelector(".modal-box");
const modalImage = document.querySelector("#modal-image");
const modalTitle = document.querySelector("#modal-title");
const modalSubtitle = document.querySelector("#modal-subtitle");
const modalScore = document.querySelector("#modal-score");
const modalType = document.querySelector("#modal-type");
const modalEpisodes = document.querySelector("#modal-episodes");
const modalStatus = document.querySelector("#modal-status");
const modalYear = document.querySelector("#modal-year");
const modalStudios = document.querySelector("#modal-studios");
const modalGenres = document.querySelector("#modal-genres");
const modalOverview = document.querySelector("#modal-overview");
const modalTrailer = document.querySelector("#modal-trailer");
const modalMalLink = document.querySelector("#modal-mal-link");
const modalClose = document.querySelector("#modal-close");
const modalFaveBtn = document.querySelector("#modal-fave-btn");

const FAVORITES_KEY = "favorites";
const PLACEHOLDER_IMAGE = `${import.meta.env.BASE_URL}placeholder.svg`;
const SKELETON_COUNT = 12;
const RANDOM_PAGE_LIMIT = 20;
const CACHED_RANDOM_PAGE_LIMIT = 2;
// Ignore backdrop clicks right after opening, so the second click of a double-click doesn't close the modal.
const BACKDROP_CLICK_DELAY = 400;
const DEFAULT_SORT = "members";
const SORT_DIRECTIONS = { members: "desc", score: "desc", start_date: "desc", title: "asc" };
const SORT_HEADINGS = {
    members: "Popular anime",
    score: "Top rated anime",
    start_date: "Newest anime",
    title: "Anime A–Z",
};
const BOOKMARK_ICON =
    '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M6.5 3h11A1.5 1.5 0 0 1 19 4.5V21l-7-4.2L5 21V4.5A1.5 1.5 0 0 1 6.5 3z"/></svg>';

let currentView = "results";
let currentQuery = "";
let currentPage = 1;
let totalResults = 0;
let isLoading = false;
let isFindingRandom = false;
let usingCache = false;
let hasMore = true;
let shownIds = new Set();
let stashedResults = [];
let listController = null;
let detailController = null;
let currentItem = null;
let lastFocused = null;
let modalOpenedAt = 0;
let messageAction = null;
let toastTimer = null;



const getFavorites = () => {
    try {
        const saved = JSON.parse(localStorage.getItem(FAVORITES_KEY) || "[]");
        return Array.isArray(saved) ? saved.filter((item) => item && typeof item.id === "number") : [];
    } catch {
        return [];
    }
};

const saveFavorites = (favorites) => {
    try {
        localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites));
        return true;
    } catch {
        showToast("Couldn't save. Your browser's storage is unavailable.");
        return false;
    }
};

const isFavorited = (animeId) => {
    return getFavorites().some((item) => item.id === animeId);
};

const toggleFavorite = (item) => {
    const favorites = getFavorites();
    const already = favorites.some((fav) => fav.id === item.id);
    const updated = already ? favorites.filter((fav) => fav.id !== item.id) : [...favorites, item];
    if (saveFavorites(updated)) syncFavoriteUI();
};



const toItem = (anime) => ({
    id: anime.mal_id,
    title: anime.title_english || anime.title || "Untitled",
    image: anime.images?.webp?.image_url || anime.images?.jpg?.image_url || "",
    imageLarge: anime.images?.webp?.large_image_url || anime.images?.jpg?.large_image_url || "",
    type: anime.type || "",
    score: anime.score ?? null,
    year: anime.year ?? anime.aired?.prop?.from?.year ?? null,
});

const formatScore = (score) => {
    return typeof score === "number" ? `${score.toFixed(2)} / 10` : "N/A";
};

const namesFromArray = (arr) => {
    return (arr || []).map((item) => item.name).join(", ") || "N/A";
};

const cardMeta = (item) => {
    const score = typeof item.score === "number" ? `★ ${item.score.toFixed(2)}` : "";
    return [item.type, item.year, score].filter(Boolean).join(" · ");
};

const cleanSynopsis = (synopsis) => {
    return synopsis?.replace(/\[Written by MAL Rewrite\]/gi, "").trim() || "No description available.";
};

const getTrailerUrl = (trailer) => {
    if (!trailer) return "";
    if (trailer.url?.startsWith("https://")) return trailer.url;
    const youtubeId = trailer.youtube_id || trailer.embed_url?.match(/\/embed\/([\w-]{11})/)?.[1];
    return youtubeId ? `https://www.youtube.com/watch?v=${youtubeId}` : "";
};

const setImage = (img, src, srcset = "") => {
    img.onerror = () => {
        img.onerror = null;
        img.removeAttribute("srcset");
        img.src = PLACEHOLDER_IMAGE;
    };
    if (srcset) img.srcset = srcset;
    else img.removeAttribute("srcset");
    img.src = src || PLACEHOLDER_IMAGE;
};

const getActiveFilters = () => ({
    type: filterType.value,
    minScore: filterScore.value,
    status: filterStatus.value,
    orderBy: sortBy.value,
    sort: SORT_DIRECTIONS[sortBy.value],
});

const hasActiveFilters = () => Boolean(filterType.value || filterScore.value || filterStatus.value);

const clearFilters = () => {
    filterType.value = "";
    filterScore.value = "";
    filterStatus.value = "";
    sortBy.value = DEFAULT_SORT;
};

const setSelectValue = (select, value) => {
    if ([...select.options].some((option) => option.value === value)) select.value = value;
};

const syncUrl = () => {
    const params = new URLSearchParams();
    if (currentQuery) params.set("q", currentQuery);
    if (filterType.value) params.set("type", filterType.value);
    if (filterScore.value) params.set("score", filterScore.value);
    if (filterStatus.value) params.set("status", filterStatus.value);
    if (sortBy.value !== DEFAULT_SORT) params.set("sort", sortBy.value);
    const search = params.toString();
    history.replaceState(null, "", search ? `?${search}` : location.pathname);
};

const restoreFromUrl = () => {
    const params = new URLSearchParams(location.search);
    currentQuery = normalizeQuery(params.get("q") || "");
    searchInput.value = currentQuery;
    setSelectValue(filterType, params.get("type"));
    setSelectValue(filterScore, params.get("score"));
    setSelectValue(filterStatus, params.get("status"));
    setSelectValue(sortBy, params.get("sort"));
};

const showToast = (text) => {
    toast.textContent = text;
    toast.classList.add("visible");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("visible"), 4000);
};



const setSaveButtonState = (button, saved) => {
    button.setAttribute("aria-pressed", String(saved));
    button.title = saved ? "Saved" : "Save";
};

const setModalSaveState = (saved) => {
    modalFaveBtn.setAttribute("aria-pressed", String(saved));
    modalFaveBtn.textContent = saved ? "Saved" : "Save";
};

const syncFavoriteUI = () => {
    const ids = new Set(getFavorites().map((item) => item.id));
    savedCount.textContent = ids.size;
    savedCount.classList.toggle("hidden", ids.size === 0);
    grid.querySelectorAll(".card[data-id]").forEach((card) => {
        setSaveButtonState(card.querySelector(".card-save"), ids.has(Number(card.dataset.id)));
    });
    if (currentItem) setModalSaveState(ids.has(currentItem.id));
};

const createCard = (item, anime = null) => {
    const card = document.createElement("article");
    const img = document.createElement("img");
    const saveBtn = document.createElement("button");
    const info = document.createElement("div");
    const heading = document.createElement("h3");
    const openBtn = document.createElement("button");
    const meta = document.createElement("p");

    card.className = "card";
    card.dataset.id = item.id;
    info.className = "card-info";
    meta.className = "card-meta";

    img.alt = "";
    img.width = 225;
    img.height = 350;
    img.loading = "lazy";
    img.sizes = "(max-width: 480px) 45vw, 220px";
    setImage(img, item.image, item.image && item.imageLarge ? `${item.image} 225w, ${item.imageLarge} 386w` : "");

    openBtn.type = "button";
    openBtn.className = "card-open";
    openBtn.textContent = item.title;
    openBtn.title = item.title;
    meta.textContent = cardMeta(item);

    saveBtn.type = "button";
    saveBtn.className = "card-save";
    saveBtn.innerHTML = BOOKMARK_ICON;
    saveBtn.setAttribute("aria-label", `Save ${item.title}`);
    setSaveButtonState(saveBtn, isFavorited(item.id));

    openBtn.addEventListener("click", () => openModal(item, anime));
    saveBtn.addEventListener("click", () => {
        toggleFavorite(item);
        if (currentView === "saved" && !isFavorited(item.id)) removeSavedCard(item.id);
    });

    heading.append(openBtn);
    info.append(heading, meta);
    card.append(img, saveBtn, info);
    return card;
};

const renderSkeletons = () => {
    const skeletons = Array.from({ length: SKELETON_COUNT }, () => {
        const card = document.createElement("div");
        card.className = "card skeleton";
        card.setAttribute("aria-hidden", "true");
        card.innerHTML =
            '<div class="skeleton-img"></div><div class="card-info"><div class="skeleton-line"></div><div class="skeleton-line short"></div></div>';
        return card;
    });
    grid.replaceChildren(...skeletons);
};

const countCards = () => grid.querySelectorAll(".card[data-id]").length;



const showMessage = (text, actionLabel = "", action = null) => {
    messageText.textContent = text;
    messageBtn.textContent = actionLabel;
    messageBtn.classList.toggle("hidden", !action);
    messageAction = action;
    message.classList.remove("hidden");
    updateLoadMore();
};

const hideMessage = () => {
    message.classList.add("hidden");
    messageAction = null;
};

const setView = (view) => {
    currentView = view;
    savedBtn.setAttribute("aria-pressed", String(view === "saved"));
};

const updateHeading = () => {
    if (currentView === "saved") {
        resultsHeading.textContent = "Saved anime";
    } else if (currentQuery) {
        resultsHeading.textContent = `Results for “${currentQuery}”`;
    } else if (usingCache) {
        resultsHeading.textContent = "Top anime";
    } else {
        resultsHeading.textContent = SORT_HEADINGS[sortBy.value] || "Anime";
    }
};

const updateStatus = () => {
    const shown = countCards();
    const cached = currentView === "results" && usingCache && shown > 0;
    resultsStatus.classList.toggle("warning", cached);
    if (currentView === "saved") {
        resultsStatus.textContent = shown ? `${shown} saved` : "";
    } else if (!shown) {
        resultsStatus.textContent = "";
    } else if (cached) {
        resultsStatus.textContent = `MyAnimeList is down right now, so these ${shown} results are from Jikan's cache`;
    } else if (!hasMore) {
        resultsStatus.textContent = `Showing all ${shown.toLocaleString()}`;
    } else {
        resultsStatus.textContent = `Showing ${shown.toLocaleString()} of ${totalResults.toLocaleString()}`;
    }
};

const updateLoadMore = () => {
    const errorShown = !message.classList.contains("hidden");
    loadMoreWrap.classList.toggle("hidden", currentView !== "results" || !hasMore || errorShown || !countCards());
};

const setLoadingUI = (loading) => {
    isLoading = loading;
    grid.setAttribute("aria-busy", String(loading));
    // aria-disabled instead of disabled, so keyboard focus stays on the button while it loads.
    loadMoreBtn.setAttribute("aria-disabled", String(loading));
    loadMoreBtn.textContent = loading ? "Loading…" : "Load More";
    if (loading) resultsStatus.textContent = "Loading…";
};

const cancelListRequest = () => {
    listController?.abort();
    listController = null;
    setLoadingUI(false);
};



const canUseCache = (error) => error.status === 0 || error.status >= 500;

// Try the live search first; if MyAnimeList is down, fall back to Jikan's cached listings.
const fetchList = async (options, { cacheOnly = false, cacheFallback = true } = {}) => {
    if (!cacheOnly) {
        try {
            return { ...(await fetchAnime(options)), cached: false };
        } catch (error) {
            if (isAbortError(error) || !cacheFallback || !canUseCache(error)) throw error;
        }
    }
    return { ...(await fetchCachedAnime(options)), cached: true };
};

const focusAfterLoadMore = (firstNewCard) => {
    if (!loadMoreWrap.classList.contains("hidden")) return;
    if (firstNewCard) firstNewCard.querySelector(".card-open").focus();
    else if (!messageBtn.classList.contains("hidden")) messageBtn.focus();
    else resultsHeading.focus();
};

const loadFirstPage = async () => {
    cancelListRequest();
    setView("results");
    currentPage = 1;
    totalResults = 0;
    hasMore = true;
    usingCache = false;
    shownIds = new Set();
    stashedResults = [];
    hideMessage();
    renderSkeletons();
    updateHeading();
    updateLoadMore();
    syncUrl();
    await loadNextPage();
};

const loadNextPage = async () => {
    if (isLoading || !hasMore || currentView !== "results") return;

    const controller = new AbortController();
    const hadFocus = document.activeElement === loadMoreBtn;
    let firstNewCard = null;
    listController = controller;
    hideMessage();
    setLoadingUI(true);

    try {
        const results = await fetchList(
            { query: currentQuery, page: currentPage, ...getActiveFilters(), signal: controller.signal },
            { cacheOnly: usingCache, cacheFallback: currentPage === 1 }
        );

        if (currentPage === 1) grid.replaceChildren();
        results.items.forEach((anime) => {
            if (shownIds.has(anime.mal_id)) return;
            shownIds.add(anime.mal_id);
            const card = createCard(toItem(anime), anime);
            firstNewCard ??= card;
            grid.append(card);
        });

        usingCache = results.cached;
        hasMore = results.hasNextPage;
        totalResults = results.total;
        currentPage += 1;
        updateHeading();

        if (!countCards()) showEmptyResults();
    } catch (error) {
        if (isAbortError(error)) return;
        if (currentPage === 1) {
            grid.replaceChildren();
            showMessage(error.message, "Try again", loadFirstPage);
        } else {
            showMessage(error.message, "Try again", loadNextPage);
        }
    } finally {
        if (listController === controller) {
            listController = null;
            setLoadingUI(false);
            updateStatus();
            updateLoadMore();
            if (hadFocus) focusAfterLoadMore(firstNewCard);
        }
    }
};

const showEmptyResults = () => {
    if (usingCache) {
        showMessage("MyAnimeList is down right now, and none of the cached anime match. Please try again later.", "Try again", loadFirstPage);
        return;
    }
    const text = currentQuery ? `No anime found for “${currentQuery}”.` : "No anime match these filters.";
    if (hasActiveFilters()) {
        showMessage(`${text} Try removing some filters.`, "Clear filters", () => {
            clearFilters();
            loadFirstPage();
        });
    } else {
        showMessage(`${text} Try a different search.`);
    }
};



const showSaved = () => {
    if (currentView === "results") {
        const cards = [...grid.children];
        stashedResults = cards.some((card) => card.classList.contains("skeleton")) ? [] : cards;
    }
    cancelListRequest();
    setView("saved");
    hideMessage();
    updateHeading();
    renderSaved();
};

const renderSaved = () => {
    const favorites = getFavorites();
    grid.replaceChildren(...favorites.map((item) => createCard(item)));
    if (!favorites.length) showMessage("No saved anime yet. Tap the bookmark on any anime to save it here.");
    updateStatus();
    updateLoadMore();
};

const showResults = () => {
    if (!stashedResults.length) {
        loadFirstPage();
        return;
    }
    setView("results");
    hideMessage();
    grid.replaceChildren(...stashedResults);
    stashedResults = [];
    updateHeading();
    syncFavoriteUI();
    updateStatus();
    updateLoadMore();
};

const removeSavedCard = (animeId) => {
    const card = grid.querySelector(`.card[data-id="${animeId}"]`);
    if (!card) return;
    const neighbor = card.nextElementSibling || card.previousElementSibling;
    const hadFocus = card.contains(document.activeElement);
    card.remove();
    if (hadFocus) (neighbor?.querySelector(".card-open") || resultsHeading).focus();
    if (!countCards()) renderSaved();
    else updateStatus();
};



const renderModal = (item, anime, errorText = "") => {
    const pending = errorText ? "N/A" : "…";
    const title = anime ? toItem(anime).title : item.title;
    const otherTitles = anime ? [anime.title, anime.title_japanese].filter((name) => name && name !== title) : [];

    modalTitle.textContent = title;
    modalSubtitle.textContent = otherTitles.join(" · ");
    modalSubtitle.classList.toggle("hidden", !otherTitles.length);

    modalImage.alt = `Poster for ${title}`;
    modalImage.classList.add("is-loading");
    modalImage.onload = () => modalImage.classList.remove("is-loading");
    setImage(modalImage, anime?.images?.webp?.large_image_url || anime?.images?.jpg?.large_image_url || item.image);

    modalScore.textContent = formatScore(anime ? anime.score : item.score);
    modalType.textContent = (anime ? anime.type : item.type) || "N/A";
    modalEpisodes.textContent = anime ? anime.episodes ?? "N/A" : pending;
    modalStatus.textContent = anime ? anime.status ?? "N/A" : pending;
    modalYear.textContent = anime ? toItem(anime).year ?? "N/A" : item.year ?? pending;
    modalStudios.textContent = anime ? namesFromArray(anime.studios) : pending;

    const genres = anime ? [...(anime.genres || []), ...(anime.themes || [])] : [];
    modalGenres.replaceChildren(
        ...genres.map((genre) => {
            const li = document.createElement("li");
            li.textContent = genre.name;
            return li;
        })
    );
    modalGenres.classList.toggle("hidden", !genres.length);

    if (anime) {
        modalOverview.textContent = cleanSynopsis(anime.synopsis);
    } else {
        modalOverview.textContent = errorText ? `Couldn't load full details. ${errorText}` : "Loading details…";
    }

    const trailerUrl = anime ? getTrailerUrl(anime.trailer) : "";
    modalTrailer.href = trailerUrl || "#";
    modalTrailer.classList.toggle("hidden", !trailerUrl);

    modalMalLink.href = anime?.url || `https://myanimelist.net/anime/${item.id}`;
    setModalSaveState(isFavorited(item.id));
};

const openModal = async (item, anime = null) => {
    detailController?.abort();
    detailController = null;
    currentItem = anime ? toItem(anime) : item;
    renderModal(currentItem, anime);

    if (!modal.open) {
        lastFocused = document.activeElement;
        modal.showModal();
        modalOpenedAt = performance.now();
    }
    modalBox.scrollTop = 0;
    modalBox.querySelector(".modal-right").scrollTop = 0;

    if (anime) return;

    const controller = new AbortController();
    detailController = controller;
    try {
        const full = await fetchAnimeById(item.id, { signal: controller.signal });
        if (detailController !== controller) return;
        currentItem = toItem(full);
        renderModal(currentItem, full);
    } catch (error) {
        if (isAbortError(error) || detailController !== controller) return;
        renderModal(item, null, error.message);
    } finally {
        if (detailController === controller) detailController = null;
    }
};

modalFaveBtn.addEventListener("click", () => {
    if (currentItem) toggleFavorite(currentItem);
});

modal.addEventListener("close", () => {
    detailController?.abort();
    detailController = null;
    const closedItem = currentItem;
    currentItem = null;

    if (lastFocused?.isConnected) lastFocused.focus();
    lastFocused = null;

    if (currentView === "saved" && closedItem && !isFavorited(closedItem.id)) removeSavedCard(closedItem.id);
});

// Close when the backdrop is clicked, but not when a drag that started inside the box ends outside it.
let pressedBackdrop = false;
modal.addEventListener("pointerdown", (e) => {
    pressedBackdrop = e.target === modal;
});
modal.addEventListener("click", (e) => {
    const box = modalBox.getBoundingClientRect();
    const outsideBox = e.clientX < box.left || e.clientX > box.right || e.clientY < box.top || e.clientY > box.bottom;
    const justOpened = performance.now() - modalOpenedAt < BACKDROP_CLICK_DELAY;
    if (e.target === modal && pressedBackdrop && outsideBox && !justOpened) modal.close();
});

modalClose.addEventListener("click", () => modal.close());



const pickRandomAnime = async () => {
    const filters = { ...getActiveFilters(), orderBy: "members", sort: "desc" };
    const first = await fetchList({ ...filters, page: 1 });
    if (!first.items.length) return null;

    const pageLimit = first.cached ? CACHED_RANDOM_PAGE_LIMIT : RANDOM_PAGE_LIMIT;
    const page = Math.floor(Math.random() * Math.min(first.lastPage, pageLimit)) + 1;
    let pool = first.items;
    if (page > 1) {
        try {
            const next = await fetchList({ ...filters, page }, { cacheOnly: first.cached, cacheFallback: false });
            if (next.items.length) pool = next.items;
        } catch {
            // Keep the first page's results.
        }
    }
    return pool[Math.floor(Math.random() * pool.length)];
};

randomBtn.addEventListener("click", async () => {
    if (isFindingRandom) return;
    isFindingRandom = true;
    randomBtn.setAttribute("aria-disabled", "true");
    randomBtn.textContent = "Finding…";
    try {
        const anime = await pickRandomAnime();
        if (!anime) showToast("No anime match these filters. Try changing them.");
        else if (!modal.open) openModal(toItem(anime), anime);
    } catch (error) {
        showToast(error.message);
    } finally {
        isFindingRandom = false;
        randomBtn.setAttribute("aria-disabled", "false");
        randomBtn.textContent = "Random";
    }
});



searchForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const query = normalizeQuery(searchInput.value);
    searchInput.value = query;
    if (!query) {
        searchInput.reportValidity();
        return;
    }
    currentQuery = query;
    loadFirstPage();
});

browseBtn.addEventListener("click", () => {
    currentQuery = "";
    searchInput.value = "";
    clearFilters();
    loadFirstPage();
});

savedBtn.addEventListener("click", () => {
    if (currentView === "saved") showResults();
    else showSaved();
});

[filterType, filterScore, filterStatus, sortBy].forEach((select) => {
    select.addEventListener("change", loadFirstPage);
});

loadMoreBtn.addEventListener("click", loadNextPage);
messageBtn.addEventListener("click", () => messageAction?.());

document.addEventListener("keydown", (e) => {
    const typing = e.target.closest?.("input, select, textarea");
    if (e.key === "/" && !typing && !modal.open) {
        e.preventDefault();
        searchInput.focus();
    }
});

window.addEventListener("storage", (e) => {
    if (e.key !== FAVORITES_KEY && e.key !== null) return;
    syncFavoriteUI();
    if (currentView === "saved") renderSaved();
});



restoreFromUrl();
syncFavoriteUI();
loadFirstPage();
