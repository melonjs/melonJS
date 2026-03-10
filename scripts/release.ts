import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const PACKAGES: Record<string, { dir: string; tagPrefix: string }> = {
	melonjs: { dir: "packages/melonjs", tagPrefix: "" },
	"debug-plugin": { dir: "packages/debug-plugin", tagPrefix: "debug-plugin/v" },
};

function run(cmd: string): string {
	return execSync(cmd, { encoding: "utf-8" }).trim();
}

function main() {
	const name = process.argv[2];
	if (!name || !PACKAGES[name]) {
		console.error(
			`Usage: tsx scripts/release.ts <${Object.keys(PACKAGES).join("|")}>`,
		);
		process.exit(1);
	}

	const pkg = PACKAGES[name];
	const pkgJsonPath = resolve(pkg.dir, "package.json");
	const { version } = JSON.parse(readFileSync(pkgJsonPath, "utf-8"));
	const tag = `${pkg.tagPrefix}${version}`;

	console.log(`Creating release for ${name} ${version} (tag: ${tag})`);

	// Check gh CLI is available and authenticated
	try {
		run("gh auth status");
	} catch {
		console.error("Error: gh CLI is not installed or not authenticated.");
		console.error("Install: https://cli.github.com  |  Auth: gh auth login");
		process.exit(1);
	}

	// Create and push git tag (skip if it already exists)
	const existingTags = run("git tag --list").split("\n");
	if (existingTags.includes(tag)) {
		console.log(`Tag ${tag} already exists, skipping tag creation.`);
	} else {
		console.log(`Creating tag ${tag}...`);
		run(`git tag "${tag}"`);
		console.log(`Pushing tag ${tag} to origin...`);
		run(`git push origin "refs/tags/${tag}"`);
	}

	// Find previous tag for this package to generate notes from
	const tagPattern = pkg.tagPrefix ? `${pkg.tagPrefix}*` : "[0-9]*";
	const previousTags = run(
		`git tag --list "${tagPattern}" --sort=-version:refname`,
	)
		.split("\n")
		.filter((t) => t && t !== tag);
	const previousTag = previousTags[0];

	// Build release notes with full commit history
	let notes = "";
	if (previousTag) {
		const commits = run(
			`git log "${previousTag}..${tag}" --pretty=format:"- %s (%h)" --no-merges`,
		);
		if (commits) {
			notes += "## What's Changed\n\n";
			notes += commits;
			notes += `\n\n**Full Changelog**: https://github.com/melonjs/melonJS/compare/${previousTag}...${tag}`;
		}
	}

	// Create GitHub release
	try {
		console.log("Creating GitHub release...");
		if (notes) {
			const releaseUrl = run(
				`gh release create "${tag}" --title "v${version}" --notes "${notes.replace(/"/g, '\\"')}"`,
			);
			console.log(`Release created: ${releaseUrl}`);
		} else {
			const releaseUrl = run(
				`gh release create "${tag}" --title "v${version}" --generate-notes`,
			);
			console.log(`Release created: ${releaseUrl}`);
		}
	} catch (e) {
		const msg = e instanceof Error ? e.message : String(e);
		if (msg.includes("already exists")) {
			console.log(`Release for ${tag} already exists, skipping.`);
		} else {
			throw e;
		}
	}
}

main();
