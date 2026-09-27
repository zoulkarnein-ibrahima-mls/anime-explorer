const API_BASE = "https://api.jikan.moe/v4";
const PAGE_SIZE = 24;
const MAX_RETRIES = 2;
const MAX_QUERY_LENGTH = 100;
const REQUEST_TIMEOUT = 15000;
const MAX_CACHED_RESPONSES = 100;
// Jikan allows 3 requests per second, so space requests out a little more than that.
const MIN_REQUEST_GAP = 400;

export class ApiError extends Error {
    constructor(message, status = 0) {
        super(message);
        this.name = "ApiError";
        this.status = status;
    }
}

export const isAbortError = (error) => error?.name === "AbortError";

const abortError = () => new DOMException("The request was aborted.", "AbortError");

const wait = (ms, signal) =>
    new Promise((resolve, reject) => {
        if (signal?.aborted) return reject(abortError());
        const onAbort = () => {
            clearTimeout(timer);
            reject(abortError());
        };
        const timer = setTimeout(() => {
            signal?.removeEventListener("abort", onAbort);
            resolve();
        }, ms);
        signal?.addEventListener("abort", onAbort, { once: true });
    });

let nextRequestAt = 0;

const waitForTurn = (signal) => {
    const now = Date.now();
    const startAt = Math.max(now, nextRequestAt);
    nextRequestAt = startAt + MIN_REQUEST_GAP;
    return wait(startAt - now, signal);
};

const errorMessage = (status) => {
    if (status === 0) return "Network error. Check your connection and try again.";
    if (status === 404) return "That anime could not be found.";
    if (status === 429) return "Too many requests. Please wait a moment and try again.";
    if (status >= 500) return "MyAnimeList isn't responding right now. Please try again in a moment.";
    return `Request failed (status ${status}).`;
};

const fetchWithTimeout = async (url, signal) => {
    const controller = new AbortController();
    const onAbort = () => controller.abort();
    const timer = setTimeout(onAbort, REQUEST_TIMEOUT);
    signal?.addEventListener("abort", onAbort, { once: true });
    try {
        return await fetch(url, { signal: controller.signal });
    } finally {
        clearTimeout(timer);
        signal?.removeEventListener("abort", onAbort);
    }
};

const cache = new Map();

const request = async (path, params = {}, signal, retries = MAX_RETRIES) => {
    const url = new URL(`${API_BASE}${path}`);
    Object.entries(params).forEach(([key, value]) => {
        if (value !== "" && value != null) url.searchParams.set(key, String(value));
    });

    const key = url.toString();
    if (cache.has(key)) return cache.get(key);

    for (let attempt = 0; ; attempt++) {
        await waitForTurn(signal);

        let status = 0;
        try {
            const response = await fetchWithTimeout(key, signal);
            if (response.ok) {
                const data = await response.json();
                if (cache.size >= MAX_CACHED_RESPONSES) cache.delete(cache.keys().next().value);
                cache.set(key, data);
                return data;
            }
            status = response.status;
        } catch (error) {
            if (signal?.aborted) throw error;
            // Otherwise it was a network failure or timeout, which is worth retrying.
        }

        const retryable = status === 0 || status === 429 || status >= 500;
        if (!retryable || attempt >= retries) throw new ApiError(errorMessage(status), status);
        await wait(1000 * 2 ** attempt, signal);
    }
};

const details = new Map();

const STATUS_NAMES = { airing: "Currently Airing", complete: "Finished Airing", upcoming: "Not yet aired" };
const ADULT_GENRE_IDS = [12, 49];

// Jikan rejects queries with tabs or line breaks, so collapse all whitespace.
export const normalizeQuery = (query) => query.replace(/[\s\0]+/g, " ").trim().slice(0, MAX_QUERY_LENGTH);

const toResults = (data, page) => {
    const items = Array.isArray(data.data) ? data.data : [];
    items.forEach((anime) => details.set(anime.mal_id, anime));

    return {
        items,
        hasNextPage: Boolean(data.pagination?.has_next_page),
        lastPage: data.pagination?.last_visible_page ?? page,
        total: data.pagination?.items?.total ?? items.length,
    };
};

export const fetchAnime = async ({
    query = "",
    page = 1,
    type = "",
    minScore = "",
    status = "",
    orderBy = "",
    sort = "",
    signal,
} = {}) => {
    const data = await request(
        "/anime",
        {
            q: normalizeQuery(query),
            type,
            min_score: minScore,
            status,
            order_by: orderBy,
            sort: orderBy ? sort : "",
            sfw: "true",
            page,
            limit: PAGE_SIZE,
        },
        signal,
        1
    );
    return toResults(data, page);
};

const matchesFilters = (anime, { type, minScore, status }) => {
    if (type && anime.type?.toLowerCase() !== type) return false;
    if (minScore && !(anime.score >= Number(minScore))) return false;
    if (status && anime.status !== STATUS_NAMES[status]) return false;
    if (anime.rating?.startsWith("Rx")) return false;
    const genres = [...(anime.genres || []), ...(anime.explicit_genres || [])];
    return !genres.some((genre) => ADULT_GENRE_IDS.includes(genre.mal_id));
};

// When MyAnimeList is down, Jikan still serves a few plain URLs (like /top/anime or
// /anime?q=naruto) from its cache. Those URLs take no filters, so filter the results here.
export const fetchCachedAnime = async ({ query = "", page = 1, type = "", minScore = "", status = "", signal } = {}) => {
    const q = normalizeQuery(query).toLowerCase();
    const pageParam = page > 1 ? page : "";
    const data = q
        ? await request("/anime", { q, page: pageParam }, signal, 0)
        : await request("/top/anime", { page: pageParam }, signal, 0);

    const results = toResults(data, page);
    const items = results.items.filter((anime) => matchesFilters(anime, { type, minScore, status }));
    return { ...results, items, total: null };
};

export const fetchAnimeById = async (id, { signal } = {}) => {
    if (details.has(id)) return details.get(id);

    const data = await request(`/anime/${id}`, {}, signal);
    if (!data.data) throw new ApiError(errorMessage(404), 404);

    details.set(id, data.data);
    return data.data;
};
