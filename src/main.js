import { fetchAnime, fetchAnimeById } from "./fetch-data.js";

const grid = document.querySelector("#grid");
const searchInput = document.querySelector("#search-input");
const searchForm = document.querySelector("#search-form");
const browseBtn = document.querySelector("#browse-btn");
const randomBtn = document.querySelector("#random-btn");
const savedBtn = document.querySelector("#saved-btn");
const loadMoreBtn = document.querySelector("#load-more-btn");
const loadMoreWrap = document.querySelector("#load-more-wrap");
const loadingText = document.querySelector("#loading-text");

const filterType = document.querySelector("#filter-type");
const filterScore = document.querySelector("#filter-score");
const filterStatus = document.querySelector("#filter-status");

const modalOverlay = document.querySelector("#modal-overlay");
const modalImage = document.querySelector("#modal-image");
const modalTitle = document.querySelector("#modal-title");
const modalScore = document.querySelector("#modal-score");
const modalType = document.querySelector("#modal-type");
const modalEpisodes = document.querySelector("#modal-episodes");
const modalStatus = document.querySelector("#modal-status");
const modalStudios = document.querySelector("#modal-studios");
const modalGenres = document.querySelector("#modal-genres");
const modalOverview = document.querySelector("#modal-overview");
const modalTrailer = document.querySelector("#modal-trailer");
const modalClose = document.querySelector("#modal-close");
const modalFaveBtn = document.querySelector("#modal-fave-btn");

let currentQuery = "";
let currentPage = 1;
let isLoading = false;
let hasMore = true;
let currentAnime = null;



const getFavorites = () => {
    const saved = localStorage.getItem("favorites");
    if (!saved) return [];
    return JSON.parse(saved);
};

const saveFavorites = (favorites) => {
    localStorage.setItem("favorites", JSON.stringify(favorites));
};

const isFavorited = (animeId) => {
    const favorites = getFavorites();
    return favorites.some((item) => item.id === animeId);
};

const addFavorite = (anime) => {
    const favorites = getFavorites();
    const already = favorites.some((item) => item.id === anime.id);
    if (already) return;
    favorites.push(anime);
    saveFavorites(favorites);
};

const removeFavorite = (animeId) => {
    const favorites = getFavorites();
    const updated = favorites.filter((item) => item.id !== animeId);
    saveFavorites(updated);
};



const resetPaging = () => {
    currentPage = 1;
    isLoading = false;
    hasMore = true;
    loadMoreBtn.disabled = false;
    loadMoreBtn.textContent = "Load More";
};

const setLoadingUI = (loading) => {
    loadMoreBtn.disabled = loading;
    loadingText.classList.toggle("hidden", !loading);
};

const formatScore = (score) => {
    return typeof score === "number" ? `${score.toFixed(2)} / 10` : "N/A";
};

const namesFromArray = (arr) => {
    return (arr || []).map((item) => item.name).join(", ") || "N/A";
};

const getActiveFilters = () => ({
    type: filterType.value,
    minScore: filterScore.value,
    status: filterStatus.value,
});

const clearFilters = () => {
    filterType.value = "";
    filterScore.value = "";
    filterStatus.value = "";
};



const fillModal = (anime) => {
    const title = anime.title_english || anime.title || "No title";
    currentAnime = anime;

    modalImage.src = anime.images?.jpg?.large_image_url || "";
    modalImage.alt = title;
    modalTitle.textContent = title;
    modalScore.textContent = formatScore(anime.score);
    modalType.textContent = anime.type ?? "N/A";
    modalEpisodes.textContent = anime.episodes ?? "N/A";
    modalStatus.textContent = anime.status ?? "N/A";
    modalStudios.textContent = namesFromArray(anime.studios);
    modalGenres.textContent = namesFromArray(anime.genres);
    modalOverview.textContent =
        anime.synopsis?.replace(/\[Written by MAL Rewrite\]/gi, "").trim() ||
        "No description available.";

    if (anime.trailer?.url) {
        modalTrailer.href = anime.trailer.url;
        modalTrailer.classList.remove("hidden");
    } else {
        modalTrailer.classList.add("hidden");
    }

    updateFaveBtn(anime.mal_id);
};

const openModal = async (anime) => {
    fillModal(anime);
    modalOverlay.classList.remove("hidden");
    document.body.style.overflow = "hidden";

    const full = await fetchAnimeById(anime.mal_id);
    if (full) fillModal(full);
};

const closeModal = () => {
    modalOverlay.classList.add("hidden");
    document.body.style.overflow = "";
    currentAnime = null;
};

const updateFaveBtn = (animeId) => {
    if (isFavorited(animeId)) {
        modalFaveBtn.textContent = "Saved";
        modalFaveBtn.classList.add("saved");
    } else {
        modalFaveBtn.textContent = "Save";
        modalFaveBtn.classList.remove("saved");
    }
};

modalFaveBtn.addEventListener("click", () => {
    if (!currentAnime) return;
    const animeId = currentAnime.mal_id;
    if (isFavorited(animeId)) {
        removeFavorite(animeId);
    } else {
        addFavorite({
            id: animeId,
            title: currentAnime.title_english || currentAnime.title || "No title",
            image: currentAnime.images?.jpg?.image_url || "",
            type: currentAnime.type ?? "",
            score: currentAnime.score ?? null,
        });
    }
    updateFaveBtn(animeId);
});

modalOverlay.addEventListener("click", (e) => {
    if (e.target === modalOverlay) closeModal();
});

document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeModal();
});

modalClose.addEventListener("click", closeModal);



const appendCards = (animeList) => {
    animeList.forEach((anime) => {
        const title = anime.title_english || anime.title || "No title";

        const card = document.createElement("article");
        const img = document.createElement("img");
        const info = document.createElement("div");
        const h2 = document.createElement("h2");
        const meta = document.createElement("p");

        card.className = "card";
        info.className = "card-info";
        meta.className = "card-meta";

        img.src = anime.images?.jpg?.image_url || "";
        img.alt = title;
        img.loading = "lazy";

        h2.textContent = title;
        meta.textContent = `${anime.type ?? ""}  ${anime.score ? "★ " + anime.score : ""}`.trim();

        info.append(h2, meta);
        card.append(img, info);
        grid.appendChild(card);

        card.addEventListener("click", () => openModal(anime));
    });
};

const clearGrid = () => {
    grid.innerHTML = "";
};



const showSaved = () => {
    const favorites = getFavorites();
    clearGrid();
    loadMoreWrap.classList.add("hidden");

    if (favorites.length === 0) {
        const msg = document.createElement("p");
        msg.textContent = "No saved anime yet. Open any anime and click Save.";
        msg.style.cssText = "color:#888899; text-align:center; padding:40px 0; grid-column:1/-1;";
        grid.appendChild(msg);
        return;
    }

    favorites.forEach((anime) => {
        const card = document.createElement("article");
        const img = document.createElement("img");
        const info = document.createElement("div");
        const h2 = document.createElement("h2");
        const meta = document.createElement("p");

        card.className = "card";
        info.className = "card-info";
        meta.className = "card-meta";

        img.src = anime.image || "";
        img.alt = anime.title;
        img.loading = "lazy";

        h2.textContent = anime.title;
        meta.textContent = `${anime.type || ""}  ${anime.score ? "★ " + anime.score : ""}`.trim();

        info.append(h2, meta);
        card.append(img, info);
        grid.appendChild(card);

        card.addEventListener("click", async () => {
            const full = await fetchAnimeById(anime.id);
            if (full) openModal(full);
        });
    });
};



const loadFirstPage = async () => {
    clearGrid();
    resetPaging();
    if (!currentQuery) {
        currentPage = Math.floor(Math.random() * 15) + 1;
    }
    await loadNextPage();
};

const loadNextPage = async () => {
    if (isLoading) return;
    if (!hasMore) return;

    isLoading = true;
    setLoadingUI(true);

    const filters = getActiveFilters();
    const results = await fetchAnime({
        query: currentQuery,
        page: currentPage,
        type: filters.type,
        minScore: filters.minScore,
        status: filters.status,
    });

    if (results.length === 0) {
        hasMore = false;
        loadMoreBtn.disabled = true;
        loadMoreBtn.textContent = "No More Results";
        setLoadingUI(false);
        isLoading = false;
        return;
    }

    appendCards(results);
    currentPage += 1;
    setLoadingUI(false);
    isLoading = false;
};



searchForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const query = searchInput.value.trim();
    if (!query) return;
    currentQuery = query;
    searchInput.value = "";
    loadMoreWrap.classList.remove("hidden");
    await loadFirstPage();
});

browseBtn.addEventListener("click", async () => {
    currentQuery = "";
    searchInput.value = "";
    clearFilters();
    loadMoreWrap.classList.remove("hidden");
    await loadFirstPage();
});

randomBtn.addEventListener("click", async () => {
    randomBtn.disabled = true;
    randomBtn.textContent = "Finding...";
    try {
        const randomPage = Math.floor(Math.random() * 20) + 1;
        const randomType = Math.random() < 0.5 ? "tv" : "movie";
        const results = await fetchAnime({ type: randomType, page: randomPage });
        if (results.length === 0) throw new Error("No results returned.");
        const randomAnime = results[Math.floor(Math.random() * results.length)];
        clearGrid();
        appendCards([randomAnime]);
        loadMoreWrap.classList.add("hidden");
    } catch (err) {
        console.error("Random failed:", err.message);
        alert("Could not find a random anime. Please try again.");
    } finally {
        randomBtn.disabled = false;
        randomBtn.textContent = "Random";
    }
});

savedBtn.addEventListener("click", showSaved);

filterType.addEventListener("change", loadFirstPage);
filterScore.addEventListener("change", loadFirstPage);
filterStatus.addEventListener("change", loadFirstPage);
loadMoreBtn.addEventListener("click", loadNextPage);



document.addEventListener("DOMContentLoaded", async () => {
    await loadFirstPage();
});