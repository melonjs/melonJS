#!/usr/bin/env node

import { execSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
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
	try {
		// try degit first (fast, no git history)
		execSync(`npx --yes degit ${REPO}#${BRANCH} "${targetDir}"`, {
			stdio: "inherit",
		});
	} catch {
		// fallback to git clone
		console.log("Falling back to git clone...");
		execSync(
			`git clone --depth 1 -b ${BRANCH} https://github.com/${REPO}.git "${targetDir}"`,
			{ stdio: "inherit" },
		);
		// remove .git directory
		execSync(
			process.platform === "win32"
				? `rmdir /s /q "${join(targetDir, ".git")}"`
				: `rm -rf "${join(targetDir, ".git")}"`,
		);
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
