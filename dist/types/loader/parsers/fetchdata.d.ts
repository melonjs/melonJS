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
export function fetchData(url: string, responseType: string, settings?: Object | undefined): Promise<any>;
