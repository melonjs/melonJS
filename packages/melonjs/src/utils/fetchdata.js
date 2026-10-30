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
 * @internal
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
 * @internal
 */
function fetchDataXHR(url, responseType, settings) {
	return new Promise((resolve, reject) => {
		const xhr = new XMLHttpRequest();
		xhr.open("GET", url, true);
		// XHR always sends same-origin credentials; `withCredentials` only adds
		// them to cross-origin requests, matching the `fetch` path's
		// "same-origin" / "include"
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
 * The bytes of a percent-encoded string, as the URL standard decodes a
 * `data:` URI's payload: each `%XX` is that byte, anything else its UTF-8
 * bytes. Unlike `decodeURIComponent`, any byte can be spelled this way, not
 * only those of valid UTF-8 text.
 * @param {string} str - the payload
 * @returns {Uint8Array} its bytes
 * @ignore
 * @internal
 */
function percentDecodeBytes(str) {
	const input = new TextEncoder().encode(str);
	const out = new Uint8Array(input.length);
	const hex = (c) => {
		return (
			(c >= 48 && c <= 57) || (c >= 65 && c <= 70) || (c >= 97 && c <= 102)
		);
	};
	let n = 0;
	for (let i = 0; i < input.length; i++) {
		if (input[i] === 37 && hex(input[i + 1]) && hex(input[i + 2])) {
			out[n++] = parseInt(String.fromCharCode(input[i + 1], input[i + 2]), 16);
			i += 2;
		} else {
			out[n++] = input[i];
		}
	}
	return out.slice(0, n);
}

/**
 * Decode a `data:` URI in place, with no network request. `fetch()` of a
 * `data:` URL is governed by the CSP `connect-src` directive, which hardened
 * pages (sandboxed embeds, hosted artifacts, ...) often restrict to `'self'`,
 * so the browser refuses it, e.g. for the engine's inlined loading-screen logo.
 * Resolves with the same minimal `Response`-shaped object as the XHR path.
 * @param {string} url - a `data:[<mediatype>][;base64],<data>` URI
 * @returns {Promise} resolves with a `Response`-like object
 * @ignore
 * @internal
 */
export function decodeDataURI(url) {
	return Promise.resolve().then(() => {
		const comma = url.indexOf(",");
		if (comma < 0) {
			throw new Error("fetchData: malformed data URI");
		}
		const meta = url.substring(5, comma).split(";");
		const isBase64 = meta[meta.length - 1].toLowerCase() === "base64";
		if (isBase64) {
			meta.pop();
		}
		// no media type is text/plain, whether parameters follow or not
		let type = meta.join(";");
		if (type === "") {
			type = "text/plain;charset=US-ASCII";
		} else if (type.startsWith(";")) {
			type = "text/plain" + type;
		}
		const payload = url.substring(comma + 1);

		let bytes;
		if (isBase64) {
			const binary = atob(decodeURIComponent(payload));
			bytes = new Uint8Array(binary.length);
			for (let i = 0; i < binary.length; i++) {
				bytes[i] = binary.charCodeAt(i);
			}
		} else {
			bytes = percentDecodeBytes(payload);
		}

		const text = () => {
			return new TextDecoder().decode(bytes);
		};
		return {
			ok: true,
			status: 200,
			statusText: "OK",
			json: () => {
				return Promise.resolve().then(() => {
					return JSON.parse(text());
				});
			},
			text: () => {
				return Promise.resolve(text());
			},
			blob: () => {
				return Promise.resolve(new Blob([bytes], { type }));
			},
			arrayBuffer: () => {
				// copy, so the caller owns an exact-length buffer
				return Promise.resolve(bytes.slice().buffer);
			},
		};
	});
}

/**
 * Fetches data from the specified URL.
 * @param {string} url - The URL to fetch the data from.
 * @param {string} responseType - The type of response expected ('json', 'text', 'blob', 'arrayBuffer').
 * @param {Object} [settings] - custom settings to apply to the request (@link https://developer.mozilla.org/en-US/docs/Web/API/fetch#options)
 * @returns {Promise} A promise that resolves with the fetched data or rejects with an error.
 * @ignore
 * @internal
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
	// `data:` URIs are decoded locally: no request, so no CSP `connect-src`
	// check. Checked first, as a `file:` document would otherwise route them
	// to XHR.
	const request = url.startsWith("data:")
		? decodeDataURI(url)
		: isFileProtocol(url)
			? fetchDataXHR(url, responseType, settings)
			: fetch(url, {
					method: "GET",
					// internally nocache is a string with a generated random number
					cache: settings.nocache === "" ? "no-cache" : "reload",
					// same-origin requests always carry cookies / HTTP auth (the
					// browser's own `fetch` default), so assets behind a same-origin
					// session load; `withCredentials` extends that to cross-origin.
					credentials:
						settings.withCredentials === true ? "include" : "same-origin",
					// see setting.crossorigin, "anonymous" is used for cross-origin
					// requests. A same-origin response is readable in either mode; a
					// cross-origin one under "no-cors" is opaque (status 0, empty body).
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
