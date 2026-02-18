const fetchMovies = async (type) => {
    try {
        const response = await fetch(`https://api.jikan.moe/v4/anime?type=${type}`); // fetching from the jikan api
        if (!response.ok) {
            throw new Error("Failed to fetch"); // throws error if fetching failed
        }
        const data = await response.json(); // turns data into json 
        console.log(data.data); //  list of anime wit no pagination(extra info)
        return data.data; // return only the array of anime
    } catch (error) {
        console.log("Something went wrong:", error.message);
        return []; // return empty array on error
    }
};
// fetchMovies("tv")

// Jikan API – Unofficial MyAnimeList REST API providing anime, manga, characters, seasons, users & more in JSON format; no API key needed.
// Base: https://api.jikan.moe/v4
// Get anime by ID, search by name, top lists, seasonal anime, characters, user lists, etc.
// Call fetch function with a jikan parameter.



