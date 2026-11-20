// TEMPORARY, for one pull request: records what the test pages hold while the
// engine's tests run, to compare a run that re-validates its modules with one
// that keeps them. Removed before the pull request is merged.
import { readdirSync, readFileSync, statfsSync } from "node:fs";

const started = Date.now();
const seconds = () => {
	return `${new Date().toISOString()} ${String(Math.round((Date.now() - started) / 1000)).padStart(4)}s`;
};
const memory = () => {
	const kb = /MemAvailable:\s+(\d+)/.exec(
		readFileSync("/proc/meminfo", "utf8"),
	);
	return kb === null ? -1 : Math.round(Number(kb[1]) / 1024);
};
const free = () => {
	const s = statfsSync(process.env.TMPDIR ?? "/tmp");
	return Math.round((s.bavail * s.bsize) / 2 ** 20);
};
const peak = {
	handles: 0,
	buffersMB: 0,
	lowestFreeMB: free(),
	firstFreeMB: free(),
	lowestMemoryMB: memory(),
	firstMemoryMB: memory(),
};
const seen = new Map();
let limits = "";

function sample() {
	peak.lowestFreeMB = Math.min(peak.lowestFreeMB, free());
	peak.lowestMemoryMB = Math.min(peak.lowestMemoryMB, memory());
	const alive = new Set();
	for (const pid of readdirSync("/proc")) {
		if (!/^\d+$/.test(pid)) {
			continue;
		}
		try {
			const cmd = readFileSync(`/proc/${pid}/cmdline`, "utf8");
			if (!/chrome|headless/.test(cmd)) {
				continue;
			}
			const type = /--type=([a-z-]+)/.exec(cmd)?.[1] ?? "browser";
			const handles = readdirSync(`/proc/${pid}/fd`).length;
			let buffers = 0;
			if (type === "renderer") {
				for (const line of readFileSync(`/proc/${pid}/maps`, "utf8").split(
					"\n",
				)) {
					if (line.includes("(deleted)")) {
						const [from, to] = line.split(" ")[0].split("-");
						buffers += parseInt(to, 16) - parseInt(from, 16);
					}
				}
				if (limits === "") {
					limits = readFileSync(`/proc/${pid}/limits`, "utf8")
						.split("\n")
						.find((line) => {
							return line.startsWith("Max open files");
						})
						.replace(/\s+/g, " ");
					console.log(`${seconds()} a page's own limit: ${limits}`);
				}
			}
			const buffersMB = Math.round(buffers / 2 ** 20);
			alive.add(pid);
			seen.set(pid, { type, handles, buffersMB });
			if (type === "renderer") {
				peak.handles = Math.max(peak.handles, handles);
				peak.buffersMB = Math.max(peak.buffersMB, buffersMB);
			}
		} catch {
			// the process went away between the listing and the read
		}
	}
	for (const [pid, last] of seen) {
		if (!alive.has(pid)) {
			seen.delete(pid);
			console.log(
				`${seconds()} ${last.type} ${pid} is gone: it held ${last.handles} handles and ${last.buffersMB} MB of buffers just before, temp free ${free()} MB, memory available ${memory()} MB`,
			);
		}
	}
}

let ticks = 0;
const timer = setInterval(() => {
	sample();
	if (++ticks % 60 === 0) {
		const pages = [...seen.values()].filter((p) => {
			return p.type === "renderer";
		});
		console.log(
			`${seconds()} pages: ${pages
				.map((p) => {
					return `${p.handles} handles / ${p.buffersMB} MB`;
				})
				.join(
					", ",
				)} | temp free ${free()} MB | memory available ${memory()} MB`,
		);
	}
}, 250);

process.on("SIGTERM", () => {
	clearInterval(timer);
	console.log(
		`SUMMARY most handles held by one page: ${peak.handles} | most buffers held by one page: ${peak.buffersMB} MB | temp free: ${peak.firstFreeMB} MB at the start, ${peak.lowestFreeMB} MB at the lowest | memory available: ${peak.firstMemoryMB} MB at the start, ${peak.lowestMemoryMB} MB at the lowest`,
	);
	process.exit(0);
});
