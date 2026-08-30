/**
 * Whether `url` must be loaded over the `file:` scheme — either an absolute
 * `file://` URL, or a relative URL resolved against a `file:` document (the
 * case for a Cordova/Capacitor build packaged into an APK, where the app runs
 * from `file://`). `fetch()` cannot load such URLs in several WebView contexts
 * (it rejects with an opaque network error), whereas `XMLHttpRequest` can. The
 * document `protocol` is injectable so the relative-URL branch is unit-testable
 * (`location` is non-configurable in a real browser).
 * @param {string} url
 * @param {string} [protocol] - the hosting document's protocol
 * @returns {boolean}
 * @ignore
 */
export function isFileProtocol(url, protocol = globalThis.location?.protocol) {
	return url.startsWith("file://") || protocol === "file:";
}

/**
 * `file:`-scheme transport via `XMLHttpRequest` — the fallback for contexts
 * where `fetch()` refuses local files (Cordova/Capacitor APK on Android). It
 * resolves with a minimal `fetch`-`Response`-shaped object (`ok` / `status` /
 * `statusText` + `json()` / `text()` / `blob()` / `arrayBuffer()`) so
 * {@link fetchData} handles the response identically to the `fetch` path. A
 * successful local read reports `status === 0` (there is no HTTP status).
 * @param {string} url
 * @param {string} responseType - 'json' | 'text' | 'blob' | 'arrayBuffer'
 * @param {object} settings
 * @returns {Promise} resolves with a `Response`-like object
 * @ignore
 */
function fetchDataXHR(url, responseType, settings) {
	return new Promise((resolve, reject) => {
		const xhr = new XMLHttpRequest();
		xhr.open("GET", url, true);
		xhr.withCredentials = settings.withCredentials === true;
		// `json` is parsed from the response text (matches `fetch`'s throw-on-
		// invalid-JSON); blob/arrayBuffer use the native XHR response types.
		xhr.responseType =
			responseType === "blob"
				? "blob"
				: responseType === "arrayBuffer"
					? "arraybuffer"
					: "text";

		xhr.onload = () => {
			// status 0 = a successful `file:` read (no HTTP status); an http(s)
			// server, if this path is ever hit there, reports the usual 2xx range
			resolve({
				ok: xhr.status === 0 || (xhr.status >= 200 && xhr.status < 300),
				status: xhr.status,
				statusText: xhr.statusText,
				json: () => {
					return Promise.resolve().then(() => {
						return JSON.parse(xhr.responseText);
					});
				},
				text: () => {
					return Promise.resolve(xhr.responseText);
				},
				blob: () => {
					return Promise.resolve(xhr.response);
				},
				arrayBuffer: () => {
					return Promise.resolve(xhr.response);
				},
			});
		};
		xhr.onerror = () => {
			reject(new Error(`fetchData: XHR error loading ${url}`));
		};
		xhr.send();
	});
}

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
export function fetchData(url, responseType, settings = {}) {
	// `fetch()` can't load `file:` URLs in several WebView contexts — notably a
	// Cordova/Capacitor APK on Android, where the app is served from `file://`
	// and `fetch()` rejects with a network error. Route those through XHR, which
	// supports the `file:` scheme and returns a `Response`-shaped object so the
	// response handling below is shared verbatim between both transports.
	const request = isFileProtocol(url)
		? fetchDataXHR(url, responseType, settings)
		: fetch(url, {
				method: "GET",
				// internally nocache is a string with a generated random number
				cache: settings.nocache === "" ? "no-cache" : "reload",
				credentials: settings.withCredentials === true ? "include" : "omit",
				// see setting.crossorigin, "anonymous" is used for cross-origin requests
				mode: settings.crossOrigin === "anonymous" ? "cors" : "no-cors",
			});

	return request.then((response) => {
		// status = 0 when file protocol is used, or cross-domain origin
		if (!response.ok && response.status !== 0) {
			throw new Error(
				`Network response was not ok: ${response.status} ${response.statusText}`,
			);
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
				throw new Error("Invalid response type: " + responseType);
		}
	});
}
