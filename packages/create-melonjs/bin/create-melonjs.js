#!/usr/bin/env node
/* global process, console */

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const REPO = "melonjs/typescript-boilerplate";
const BRANCH = "main";

const green = (text) => `\x1b[32m${text}\x1b[0m`;
const bold = (text) => `\x1b[1m${text}\x1b[0m`;
const dim = (text) => `\x1b[2m${text}\x1b[0m`;

function main() {
	const projectName = process.argv[2];

	if (!projectName) {
		console.log(`
${bold("Usage:")} npm create melonjs ${dim("<project-name>")}

${bold("Example:")}
  npm create melonjs my-game
  cd my-game
  npm install
  npm run dev
`);
		process.exit(1);
	}

	const targetDir = resolve(projectName);

	if (existsSync(targetDir)) {
		console.error(`\nError: directory "${projectName}" already exists.\n`);
		process.exit(1);
	}

	console.log(`\nCreating a new melonJS game in ${green(targetDir)}...\n`);

	// download the boilerplate
	// try degit first (fast, no git history)
	const degitResult = spawnSync(
		"npx",
		["--yes", "degit", `${REPO}#${BRANCH}`, targetDir],
		{
			stdio: "inherit",
			shell: process.platform === "win32",
		},
	);

	if (degitResult.status !== 0) {
		// fallback to git clone
		console.log("Falling back to git clone...");
		const cloneResult = spawnSync(
			"git",
			[
				"clone",
				"--depth",
				"1",
				"-b",
				BRANCH,
				`https://github.com/${REPO}.git`,
				targetDir,
			],
			{ stdio: "inherit" },
		);

		if (cloneResult.status !== 0) {
			console.error("\nError: failed to download the boilerplate.\n");
			process.exit(1);
		}

		// remove .git directory
		rmSync(join(targetDir, ".git"), { recursive: true, force: true });
	}

	// update package.json with the project name
	const pkgPath = join(targetDir, "package.json");
	if (existsSync(pkgPath)) {
		const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
		pkg.name = projectName;
		pkg.version = "1.0.0";
		writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n");
	}

	console.log(`
${green("Done!")} Created ${bold(projectName)}.

Next steps:

  ${dim("$")} cd ${projectName}
  ${dim("$")} npm install
  ${dim("$")} npm run dev

Happy game making! ${green("🍈")}
`);
}

main();
