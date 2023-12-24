import { nocache, crossOrigin, withCredentials } from "../settings.js";

/**
 * Fetches data from the specified URL.
 * @param {string} url - The URL to fetch the data from.
 * @param {string} responseType - The type of response expected ('json', 'text', 'blob', 'arrayBuffer').
 * @returns {Promise} A promise that resolves with the fetched data or rejects with an error.
 * @example
 * fetchData('https://api.example.com/data', 'json')
 *     .then(data => {
 *         // Handle the fetched JSON data
 *     })
 *     .catch(error => {
 *         // Handle the error
 *     });
 */
export function fetchData(url, responseType) {
    return new Promise((resolve, reject) => {
        fetch(url, {
            method: "GET",
            // internally nocache is a string with a generated random number
            cache: nocache === "" ? "no-cache" : "reload",
            credentials: withCredentials ? "include" : "omit",
            // see setting.crossorigin, "anonymous" is used for cross-origin requests
            mode: crossOrigin === "anonymous" ? "cors" : "no-cors"
        })
            .then(response => {
                if (!response.ok) {
                    // status = 0 when file protocol is used, or cross-domain origin
                    if (response.status !== 0) {
                        if (typeof onerror === "function") {
                            reject(new Error("`Network response was not ok ${response.statusText}`"));
                        }
                    }
                }

                switch (responseType) {
                    case "json":
                        return response.json();
                    case "text":
                        return response.text();
                    case "blob":
                        return response.blob();
                    case "arrayBuffer":
                        return response.arrayBuffer();
                    default:
                        reject(new Error("Invalid response type"));
                }
            })
            .then(data => resolve(data))
            .catch(error => reject(error));
    });
}
