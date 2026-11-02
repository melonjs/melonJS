import { Buffer } from "node:buffer";
import { createServer } from "node:http";

/**
 * Test servers on other origins, for the loader's cross-origin tests
 * (tests/loader-cors.spec.js).
 *
 * The tests run in a page served by Vitest; these listen on other ports of
 * 127.0.0.1, so a request to them is a cross-origin request. Each serves the
 * same two assets, a JSON file and a PNG image, with different CORS headers:
 *
 * - `cors`: `Access-Control-Allow-Origin: *`, as a public CDN sends
 * - `none`: no CORS headers at all
 * - `credentials`: the requesting origin and
 *   `Access-Control-Allow-Credentials: true`, as a server that accepts
 *   cookies from another origin must
 *
 * The ports are free ones picked at start, handed to the tests through
 * `provide("corsServers")`.
 */

const ASSETS = {
	"/level.json": {
		type: "application/json",
		body: Buffer.from('{"ok":1}'),
	},
	// a 1x1 white PNG
	"/dot.png": {
		type: "image/png",
		body: Buffer.from(
			"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==",
			"base64",
		),
	},
};

/** a server answering with the CORS headers of the given kind */
const serve = (kind) => {
	const server = createServer((request, response) => {
		if (kind === "cors") {
			response.setHeader("Access-Control-Allow-Origin", "*");
		} else if (kind === "credentials" && request.headers.origin) {
			response.setHeader("Access-Control-Allow-Origin", request.headers.origin);
			response.setHeader("Access-Control-Allow-Credentials", "true");
			response.setHeader("Vary", "Origin");
		}
		const asset = ASSETS[new URL(request.url, "http://x").pathname];
		if (asset === undefined) {
			response.writeHead(404).end();
			return;
		}
		response.writeHead(200, { "Content-Type": asset.type }).end(asset.body);
	});
	return new Promise((resolve) => {
		server.listen(0, "127.0.0.1", () => {
			resolve(server);
		});
	});
};

export default async function setup(project) {
	const servers = {
		cors: await serve("cors"),
		none: await serve("none"),
		credentials: await serve("credentials"),
	};
	const bases = {};
	for (const [kind, server] of Object.entries(servers)) {
		bases[kind] = `http://127.0.0.1:${server.address().port}/`;
	}
	project.provide("corsServers", bases);
	return async () => {
		for (const server of Object.values(servers)) {
			await new Promise((resolve) => {
				server.close(resolve);
			});
		}
	};
}
