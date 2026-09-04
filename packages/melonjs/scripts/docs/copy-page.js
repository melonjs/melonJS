/**
 * "Copy page" — hand this page to an assistant.
 *
 * TypeDoc emits HTML, but what an assistant wants is the prose. This lifts the
 * page's own content into Markdown and either copies it, or opens it in a chat
 * with the canonical URL attached so the model can fetch the rest.
 *
 * Injected via `--customJs`; the styling lives in `copy-page.css`.
 */
(() => {
	const PROMPT = "Read the melonJS API reference page at";

	/** the page's main content, as Markdown */
	const toMarkdown = (root) => {
		const out = [];
		const walk = (node, depth) => {
			for (const el of node.children) {
				const tag = el.tagName.toLowerCase();
				if (tag === "a" && el.classList.contains("tsd-anchor")) continue;
				const h = /^h([1-6])$/.exec(tag);
				if (h) {
					out.push(`\n${"#".repeat(+h[1])} ${el.textContent.trim()}\n`);
				} else if (tag === "pre") {
					out.push(`\n\`\`\`js\n${el.textContent.replace(/\n+$/, "")}\n\`\`\`\n`);
				} else if (tag === "p" || tag === "li") {
					const t = el.textContent.trim().replace(/\s+/g, " ");
					if (t) out.push(tag === "li" ? `- ${t}` : `\n${t}\n`);
				} else if (el.children.length) {
					walk(el, depth + 1);
				}
			}
		};
		walk(root, 0);
		return out.join("\n").replace(/\n{3,}/g, "\n\n").trim();
	};

	const pageMarkdown = () => {
		const main = document.querySelector(".col-content") ?? document.body;
		const title = document.querySelector("h1")?.textContent.trim() ?? document.title;
		return `# ${title}\n\nSource: ${location.href}\n\n${toMarkdown(main)}`;
	};

	const open = (base) => {
		const q = `${PROMPT} ${location.href} and help me use this API.`;
		globalThis.open(`${base}${encodeURIComponent(q)}`, "_blank", "noopener");
	};

	const build = () => {
		const header = document.querySelector(".tsd-toolbar-contents");
		if (!header || document.querySelector(".mjs-copy-page")) return;

		const wrap = document.createElement("div");
		wrap.className = "mjs-copy-page";

		const copy = document.createElement("button");
		copy.type = "button";
		copy.className = "mjs-copy-page-main";
		copy.textContent = "Copy page";
		copy.addEventListener("click", async () => {
			try {
				await navigator.clipboard.writeText(pageMarkdown());
				copy.textContent = "Copied";
			} catch {
				// clipboard blocked (insecure origin, or the user said no)
				copy.textContent = "Copy failed";
			}
			setTimeout(() => {
				copy.textContent = "Copy page";
			}, 1600);
		});

		const toggle = document.createElement("button");
		toggle.type = "button";
		toggle.className = "mjs-copy-page-toggle";
		toggle.setAttribute("aria-label", "More options");
		toggle.setAttribute("aria-expanded", "false");
		toggle.textContent = "▾";

		const menu = document.createElement("div");
		menu.className = "mjs-copy-page-menu";
		menu.hidden = true;
		for (const [label, sub, url] of [
			["Open in ChatGPT", "Ask questions about this page", "https://chatgpt.com/?q="],
			["Open in Claude", "Ask questions about this page", "https://claude.ai/new?q="],
		]) {
			const item = document.createElement("button");
			item.type = "button";
			item.className = "mjs-copy-page-item";
			item.innerHTML = `<span>${label}</span><small>${sub}</small>`;
			item.addEventListener("click", () => {
				menu.hidden = true;
				toggle.setAttribute("aria-expanded", "false");
				open(url);
			});
			menu.appendChild(item);
		}

		const setOpen = (open) => {
			menu.hidden = !open;
			toggle.setAttribute("aria-expanded", String(open));
		};
		toggle.addEventListener("click", () => {
			setOpen(menu.hidden);
		});
		// Close on any click outside the control. Deliberately a containment
		// test rather than `stopPropagation` on the toggle: that made closing
		// depend on listener order, so a stray handler between the two — or a
		// click landing on the wrapper rather than the button — could leave
		// the menu stuck open.
		document.addEventListener("click", (e) => {
			if (!wrap.contains(e.target)) {
				setOpen(false);
			}
		});
		copy.addEventListener("click", () => {
			setOpen(false);
		});
		document.addEventListener("keydown", (e) => {
			if (e.key === "Escape") {
				setOpen(false);
			}
		});

		wrap.append(copy, toggle, menu);
		header.appendChild(wrap);
	};

	if (document.readyState === "loading") {
		document.addEventListener("DOMContentLoaded", build);
	} else {
		build();
	}
})();
