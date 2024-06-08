/*!
 * melonJS Game Engine - v17.4.0
 * http://www.melonjs.org
 * melonjs is licensed under the MIT License.
 * http://www.opensource.org/licenses/mit-license
 * @copyright (C) 2011 - 2024 Olivier Biot (AltByte Pte Ltd)
 */
/**
 * Fetches data from the specified URL.
 * @param {string} url - The URL to fetch the data from.
 * @param {string} responseType - The type of response expected ('json', 'text', 'blob', 'arrayBuffer').
 * @param {Object} [settings] - custom settings to apply to the request (@link https://developer.mozilla.org/en-US/docs/Web/API/fetch#options)
 * @returns {Promise} A promise that resolves with the fetched data or rejects with an error.
 * @ignore
 * @example
 * fetchData('https://api.example.com/data', 'json')
 *     .then(data => {
 *         // Handle the fetched JSON data
 *     })
 *     .catch(error => {
 *         // Handle the error
 *     });
 */
function fetchData(url, responseType, settings = {}) {
    return new Promise((resolve, reject) => {
        fetch(url, {
            method: "GET",
            // internally nocache is a string with a generated random number
            cache: settings.nocache === "" ? "no-cache" : "reload",
            credentials: settings.withCredentials === true ? "include" : "omit",
            // see setting.crossorigin, "anonymous" is used for cross-origin requests
            mode: settings.crossOrigin === "anonymous" ? "cors" : "no-cors"
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

export { fetchData };
