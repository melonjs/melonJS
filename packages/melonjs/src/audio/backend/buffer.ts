import { fetchData } from "../../utils/fetchdata.js";
import { cache } from "./cache.ts";
import type { Sound } from "./core.ts";
import { audioEngine } from "./core.ts";
import { applySpatialAfterLoad } from "./spatial.ts";

/**
 * Fetches the bytes for an audio URL.
 *
 * Defaults to the engine's shared transport, which falls back to XHR for `file:`
 * URLs — `fetch()` cannot read that scheme in a Cordova or Capacitor WebView.
 * {@link setAudioFetcher} overrides it, for a custom transport or a test.
 *
 * The default is a working implementation rather than a stub that must be
 * installed, because a rejection here is not reported as an error: it tells the
 * backend to abandon Web Audio for that clip and fall back to a streaming HTML5
 * element. An un-installed stub would therefore degrade every network clip
 * silently instead of failing loudly.
 */
export type AudioFetcher = (
	url: string,
	options: { withCredentials?: boolean | undefined },
) => Promise<ArrayBuffer>;

let fetchAudioBytes: AudioFetcher = (url, options) =>
	fetchData(url, "arrayBuffer", {
		withCredentials: options.withCredentials === true,
	}) as Promise<ArrayBuffer>;

/**
 * Install the function the backend uses to fetch audio bytes.
 * @param fetcher - obtains the bytes for a URL, rejecting on failure
 */
export const setAudioFetcher = (fetcher: AudioFetcher) => {
	fetchAudioBytes = fetcher;
};

/**
 * Abandon Web Audio for a clip and reload it as a streaming HTML5 element.
 *
 * This is the response to a transport failure, not to a decode failure — a
 * decode failure emits `loaderror` instead. It is policy rather than error
 * handling: the clip is still expected to play, just by a different mechanism,
 * which is why the bytes could not be fetched somewhere else and handed in.
 * @param self - the clip to switch
 * @param url - the source that could not be fetched
 */
const fallBackToStreaming = (self: Sound, url: string) => {
	if (!self._webAudio) {
		return;
	}
	self._html5 = true;
	self._webAudio = false;
	self._sounds = [];
	delete cache[url];
	self.load();
};

export const loadBuffer = (self: Sound) => {
	const url = self._src as string;

	if (cache[url]) {
		self._duration = cache[url].duration;
		loadSound(self);
		return;
	}

	if (/^data:[^;]+;base64,/.test(url)) {
		const data = atob(url.split(",")[1]);
		const dataView = new Uint8Array(data.length);
		for (let i = 0; i < data.length; ++i) {
			dataView[i] = data.charCodeAt(i);
		}

		decodeAudioData(dataView.buffer, self);
	} else {
		// Use fetch API (supported in all target browsers)
		// Bytes come from whatever the engine installed; the backend does not
		// reach for the network itself. A rejection drives the HTML5 fallback
		// below, which is a backend decision and stays here.
		fetchAudioBytes(url, { withCredentials: self._xhr.withCredentials })
			.then((arrayBuffer: ArrayBuffer) => {
				if (arrayBuffer) {
					decodeAudioData(arrayBuffer, self);
				}
			})
			.catch(() => {
				fallBackToStreaming(self, url);
			});
	}
};

export const decodeAudioData = (arraybuffer: ArrayBuffer, self: Sound) => {
	const error = () => {
		self._emit("loaderror", null, "Decoding audio data failed.");
	};

	const success = (buffer: AudioBuffer) => {
		if (buffer && self._sounds.length > 0) {
			cache[self._src as string] = buffer;
			loadSound(self, buffer);
		} else {
			error();
		}
	};

	if (
		typeof Promise !== "undefined" &&
		audioEngine.ctx!.decodeAudioData.length === 1
	) {
		audioEngine.ctx!.decodeAudioData(arraybuffer).then(success).catch(error);
	} else {
		void audioEngine.ctx!.decodeAudioData(arraybuffer, success, error);
	}
};

export const loadSound = (self: Sound, buffer?: AudioBuffer) => {
	if (buffer && !self._duration) {
		self._duration = buffer.duration;
	}

	if (Object.keys(self._sprite).length === 0) {
		self._sprite = { __default: [0, self._duration * 1000] };
	}

	if (self._state !== "loaded") {
		self._state = "loaded";
		self._emit("load");
		self._loadQueue();

		// Execute plugin hooks
		applySpatialAfterLoad(self);
	}
};
