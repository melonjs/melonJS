import { execSync } from "node:child_process";
import { readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const PACKAGES: Record<string, { dir: string; tagPrefix: string }> = {
	melonjs: { dir: "packages/melonjs", tagPrefix: "" },
	"debug-plugin": { dir: "packages/debug-plugin", tagPrefix: "debug-plugin/v" },
};

// GitHub usernames of melonJS team members (org admins / maintainers)
const TEAM_MEMBERS = new Set(["obiot"]);

const REPO = "melonjs/melonJS";

function run(cmd: string): string {
	return execSync(cmd, { encoding: "utf-8" }).trim();
}

interface Commit {
	message: string;
	hash: string;
	email: string;
}

/**
 * Resolve a git author email to a GitHub login via the commit search API.
 * Falls back to the git author name if the lookup fails.
 * @param email - the git author email
 * @param sampleHash - a commit hash from this author to look up
 * @returns the GitHub login or git author name
 */
function resolveGitHubLogin(email: string, sampleHash: string): string {
	try {
		const login = run(
			`gh api repos/${REPO}/commits/${sampleHash} --jq '.author.login // empty'`,
		);
		if (login) return login;
	} catch {
		// ignore
	}
	// Fallback to git author name
	return run(`git log -1 "${sampleHash}" --pretty=format:"%aN"`);
}

function getCommits(previousTag: string, currentTag: string): Commit[] {
	const log = run(
		`git log "${previousTag}..${currentTag}" --pretty=format:"%h|||%aE|||%s" --no-merges`,
	);
	if (!log) return [];

	return log.split("\n").map((line) => {
		const [hash, email, ...msgParts] = line.split("|||");
		return { hash, email, message: msgParts.join("|||") };
	});
}

function buildCategorizedNotes(
	previousTag: string,
	currentTag: string,
): string {
	const commits = getCommits(previousTag, currentTag);
	if (commits.length === 0) return "";

	// Collect unique emails and resolve each to a GitHub login (one API call per unique author)
	const emailToCommits = new Map<string, Commit[]>();
	for (const commit of commits) {
		const existing = emailToCommits.get(commit.email) || [];
		existing.push(commit);
		emailToCommits.set(commit.email, existing);
	}

	console.log(
		`Resolving ${emailToCommits.size} unique author(s) to GitHub logins...`,
	);
	const emailToLogin = new Map<string, string>();
	for (const [email, authorCommits] of emailToCommits) {
		const login = resolveGitHubLogin(email, authorCommits[0].hash);
		emailToLogin.set(email, login);
	}

	// Categorize by team vs contributor
	const teamCommits: Commit[] = [];
	const contributorMap = new Map<string, Commit[]>();

	for (const commit of commits) {
		const login = emailToLogin.get(commit.email) || "";
		if (TEAM_MEMBERS.has(login)) {
			teamCommits.push(commit);
		} else {
			const existing = contributorMap.get(login) || [];
			existing.push(commit);
			contributorMap.set(login, existing);
		}
	}

	// Determine new vs returning contributors by checking if they have commits before previousTag
	console.log("Checking for new contributors...");
	const newContributors = new Map<string, Commit[]>();
	const returningContributors = new Map<string, Commit[]>();

	for (const [login, userCommits] of contributorMap) {
		const email = userCommits[0].email;
		// Check if this author has any commits before the previous tag
		const priorCount = run(
			`git log "${previousTag}" --author="${email}" --oneline --no-merges | head -1 | wc -l`,
		).trim();
		if (Number.parseInt(priorCount) > 0) {
			returningContributors.set(login, userCommits);
		} else {
			newContributors.set(login, userCommits);
		}
	}

	// Build notes
	let notes = "## What's Changed\n\n";

	if (teamCommits.length > 0) {
		notes += "### melonJS Team\n\n";
		for (const c of teamCommits) {
			notes += `- ${c.message} (${c.hash})\n`;
		}
		notes += "\n";
	}

	if (returningContributors.size > 0) {
		notes += "### Contributors\n\n";
		for (const [login, userCommits] of returningContributors) {
			notes += `#### @${login}\n`;
			for (const c of userCommits) {
				notes += `- ${c.message} (${c.hash})\n`;
			}
			notes += "\n";
		}
	}

	if (newContributors.size > 0) {
		notes += "### New Contributors\n\n";
		for (const [login, userCommits] of newContributors) {
			notes += `- @${login} made their first contribution\n`;
			for (const c of userCommits) {
				notes += `  - ${c.message} (${c.hash})\n`;
			}
			notes += "\n";
		}
	}

	notes += `**Full Changelog**: https://github.com/${REPO}/compare/${previousTag}...${currentTag}`;
	return notes;
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

	// Build categorized release notes
	let notes = "";
	if (previousTag) {
		notes = buildCategorizedNotes(previousTag, tag);
	}

	// Create GitHub release
	try {
		console.log("Creating GitHub release...");
		if (notes) {
			const notesFile = join(tmpdir(), `release-notes-${Date.now()}.md`);
			writeFileSync(notesFile, notes);
			try {
				const releaseUrl = run(
					`gh release create "${tag}" --title "v${version}" --notes-file "${notesFile}"`,
				);
				console.log(`Release created: ${releaseUrl}`);
			} finally {
				unlinkSync(notesFile);
			}
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
