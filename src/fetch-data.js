export const fetchAnime = async ({
    query = "",
    page = 1,
    type = "",
    minScore = "",
    status = "",
}) => {
    try {
        const url = new URL("https://api.jikan.moe/v4/anime");

        if (query.trim()) url.searchParams.set("q", query.trim());
        if (type) url.searchParams.set("type", type);
        if (minScore) url.searchParams.set("min_score", String(minScore));
        if (status) url.searchParams.set("status", status);

        url.searchParams.set("sfw", "true");
        url.searchParams.set("page", String(page));
        url.searchParams.set("limit", "24");

        const response = await fetch(url.toString());
        if (!response.ok) throw new Error(`Fetch failed with status: ${response.status}`);

        const data = await response.json();
        return data.data || [];

    } catch (error) {
        console.error("Could not load anime:", error.message);
        return [];
    }
};

export const fetchAnimeById = async (id) => {
    try {
        const response = await fetch(`https://api.jikan.moe/v4/anime/${id}`);
        if (!response.ok) throw new Error(`Fetch failed: ${response.status}`);

        const data = await response.json();
        return data.data || null;

    } catch (error) {
        console.error("Could not load anime details:", error.message);
        return null;
    }
};