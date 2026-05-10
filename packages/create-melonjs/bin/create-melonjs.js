#!/usr/bin/env node
/* global process, console */

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const TEMPLATES = {
	default: "melonjs/typescript-boilerplate",
	capacitor: "melonjs/typescript-boilerplate-capacitor",
};
const BRANCH = "main";

const green = (text) => `\x1b[32m${text}\x1b[0m`;
const bold = (text) => `\x1b[1m${text}\x1b[0m`;
const dim = (text) => `\x1b[2m${text}\x1b[0m`;

function parseArgs(argv) {
	const args = { positional: [], template: "default" };
	for (let i = 0; i < argv.length; i++) {
		const token = argv[i];
		if (token === "--template" || token === "-t") {
			args.template = argv[++i];
		} else if (token?.startsWith("--template=")) {
			args.template = token.slice("--template=".length);
		} else if (token?.startsWith("-")) {
			console.error(`\nError: unknown flag "${token}".\n`);
			process.exit(1);
		} else {
			args.positional.push(token);
		}
	}
	return args;
}

function main() {
	const { positional, template } = parseArgs(process.argv.slice(2));
	const projectName = positional[0];

	if (!projectName) {
		console.log(`
${bold("Usage:")} npm create melonjs ${dim("<project-name>")} ${dim("[--template <name>]")}

${bold("Templates:")}
  ${dim("default")}    Plain TypeScript + Vite boilerplate (default)
  ${dim("capacitor")}  TypeScript + Vite + Capacitor wrapper for iOS/Android

${bold("Examples:")}
  npm create melonjs my-game
  npm create melonjs my-game --template capacitor
  cd my-game
  npm install
  npm run dev
`);
		process.exit(1);
	}

	const repo = TEMPLATES[template];
	if (!repo) {
		console.error(
			`\nError: unknown template "${template}". Known templates: ${Object.keys(TEMPLATES).join(", ")}.\n`,
		);
		process.exit(1);
	}

	const targetDir = resolve(projectName);

	if (existsSync(targetDir)) {
		console.error(`\nError: directory "${projectName}" already exists.\n`);
		process.exit(1);
	}

	console.log(
		`\nCreating a new melonJS game in ${green(targetDir)} (template: ${bold(template)})...\n`,
	);

	// download the boilerplate
	// try degit first (fast, no git history)
	const degitResult = spawnSync(
		"npx",
		["--yes", "degit", `${repo}#${BRANCH}`, targetDir],
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
				`https://github.com/${repo}.git`,
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

	const nextSteps =
		template === "capacitor"
			? `  ${dim("$")} cd ${projectName}
  ${dim("$")} npm install
  ${dim("$")} npm run dev          ${dim("# develop in the browser")}
  ${dim("$")} npm run build
  ${dim("$")} npx cap add ios      ${dim("# or: npx cap add android")}
  ${dim("$")} npx cap copy
  ${dim("$")} npx cap open ios     ${dim("# build & run from Xcode / Android Studio")}`
			: `  ${dim("$")} cd ${projectName}
  ${dim("$")} npm install
  ${dim("$")} npm run dev`;

	console.log(`
${green("Done!")} Created ${bold(projectName)}.

Next steps:

${nextSteps}

Happy game making! ${green("🍈")}
`);
}

main();
