import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
	boot,
	Container,
	Ellipse,
	game,
	Light2d,
	Stage,
	state,
	video,
} from "../src/index.js";

describe("Light2d + Stage lighting", () => {
	beforeAll(() => {
		boot();
		video.init(800, 600, {
			parent: "screen",
			scale: "auto",
			renderer: video.CANVAS,
		});
	});

	afterAll(() => {
		// leave the world clean for any later test files
		const stage = state.current();
		if (stage instanceof Stage) {
			const children = stage._activeLights ? [...stage._activeLights] : [];
			for (const light of children) {
				if (light.ancestor) {
					light.ancestor.removeChildNow(light);
				}
			}
			stage.lights.clear();
		}
	});

	describe("auto-registration via lifecycle", () => {
		it("adds the light to _activeLights when added to the world", () => {
			const stage = state.current();
			expect(stage).toBeInstanceOf(Stage);
			const before = stage._activeLights.size;

			const light = new Light2d(0, 0, 50);
			game.world.addChild(light);
			expect(stage._activeLights.has(light)).toBe(true);
			expect(stage._activeLights.size).toBe(before + 1);

			game.world.removeChildNow(light, true);
			expect(stage._activeLights.has(light)).toBe(false);
			expect(stage._activeLights.size).toBe(before);
		});

		it("works for lights parented to any container in the world tree", () => {
			const stage = state.current();
			const before = stage._activeLights.size;

			const parent = new Container(0, 0, 100, 100);
			game.world.addChild(parent);
			const light = new Light2d(0, 0, 50);
			parent.addChild(light);
			expect(stage._activeLights.has(light)).toBe(true);
			expect(stage._activeLights.size).toBe(before + 1);

			game.world.removeChildNow(parent, true);
			// removing the parent fires onDeactivateEvent on its descendants
			expect(stage._activeLights.has(light)).toBe(false);
		});

		it("does not double-register when reparented from one container to another", () => {
			// Real game pattern: a torch held by one character is handed to
			// another. The recommended reparenting flow is detach with
			// `keepalive=true` first (so the engine doesn't recycle/destroy
			// the instance), then `addChild` on the new parent. The
			// active-lights set must end up with exactly one entry.
			const stage = state.current();
			const before = stage._activeLights.size;

			const a = new Container(0, 0, 100, 100);
			const b = new Container(0, 0, 100, 100);
			game.world.addChild(a);
			game.world.addChild(b);

			const light = new Light2d(0, 0, 50);
			a.addChild(light);
			expect(stage._activeLights.has(light)).toBe(true);
			expect(stage._activeLights.size).toBe(before + 1);

			a.removeChildNow(light, true);
			b.addChild(light);
			expect(stage._activeLights.has(light)).toBe(true);
			expect(stage._activeLights.size).toBe(before + 1);
			expect(light.ancestor).toBe(b);

			// cleanup
			game.world.removeChildNow(a, true);
			game.world.removeChildNow(b, true);
		});

		it("re-registers when added back after being removed", () => {
			const stage = state.current();
			const light = new Light2d(0, 0, 50);

			game.world.addChild(light);
			expect(stage._activeLights.has(light)).toBe(true);

			game.world.removeChildNow(light, true);
			expect(stage._activeLights.has(light)).toBe(false);

			game.world.addChild(light);
			expect(stage._activeLights.has(light)).toBe(true);

			game.world.removeChildNow(light, true);
		});

		it("tracks multiple lights independently", () => {
			const stage = state.current();
			const before = stage._activeLights.size;

			const a = new Light2d(0, 0, 50);
			const b = new Light2d(50, 50, 30);
			const c = new Light2d(100, 100, 80);
			game.world.addChild(a);
			game.world.addChild(b);
			game.world.addChild(c);
			expect(stage._activeLights.size).toBe(before + 3);

			game.world.removeChildNow(b, true);
			expect(stage._activeLights.has(a)).toBe(true);
			expect(stage._activeLights.has(b)).toBe(false);
			expect(stage._activeLights.has(c)).toBe(true);
			expect(stage._activeLights.size).toBe(before + 2);

			// cleanup
			game.world.removeChildNow(a, true);
			game.world.removeChildNow(c, true);
		});
	});

	describe("ambient overlay (Stage.drawLighting)", () => {
		it("Stage.drawLighting is a no-op when ambient alpha is 0", () => {
			const stage = state.current();
			stage.ambientLight.setColor(0, 0, 0, 0);

			const calls = [];
			const stub = {
				save: () => {
					calls.push("save");
				},
				setMask: () => {
					calls.push("setMask");
				},
				setColor: () => {
					calls.push("setColor");
				},
				fillRect: () => {
					calls.push("fillRect");
				},
				clearMask: () => {
					calls.push("clearMask");
				},
				restore: () => {
					calls.push("restore");
				},
			};

			stage.drawLighting(stub, game.viewport);
			expect(calls).toEqual([]);
		});

		it("Stage.drawLighting fills + masks once per active light", () => {
			const stage = state.current();
			// reset state
			while (stage._activeLights.size > 0) {
				const light = [...stage._activeLights][0];
				if (light.ancestor) {
					light.ancestor.removeChildNow(light);
				} else {
					stage._activeLights.delete(light);
				}
			}
			stage.ambientLight.setColor(0, 0, 0, 0.5);

			const a = new Light2d(0, 0, 30);
			const b = new Light2d(50, 50, 30);
			game.world.addChild(a);
			game.world.addChild(b);

			const calls = [];
			const stub = {
				save: () => {
					calls.push("save");
				},
				setMask: () => {
					calls.push("setMask");
				},
				setColor: () => {
					calls.push("setColor");
				},
				fillRect: () => {
					calls.push("fillRect");
				},
				clearMask: () => {
					calls.push("clearMask");
				},
				restore: () => {
					calls.push("restore");
				},
			};

			stage.drawLighting(stub, game.viewport);

			// expected sequence: save, setMask×N, setColor, fillRect, clearMask, restore
			expect(calls[0]).toBe("save");
			expect(calls[calls.length - 1]).toBe("restore");
			const setMaskCount = calls.filter((c) => {
				return c === "setMask";
			}).length;
			expect(setMaskCount).toBe(2);
			expect(calls).toContain("setColor");
			expect(calls).toContain("fillRect");
			expect(calls).toContain("clearMask");

			// reset for next tests
			game.world.removeChildNow(a, true);
			game.world.removeChildNow(b, true);
			stage.ambientLight.setColor(0, 0, 0, 0);
		});

		// helper: clean active-lights and ambient state before each alignment test
		function freshAlignmentState() {
			const stage = state.current();
			while (stage._activeLights.size > 0) {
				const l = [...stage._activeLights][0];
				if (l.ancestor) {
					l.ancestor.removeChildNow(l, true);
				} else {
					stage._activeLights.delete(l);
				}
			}
			stage.ambientLight.setColor(0, 0, 0, 0.5);
			return stage;
		}

		// helper: stub renderer that captures setMask shapes + accumulated translate
		function makeAlignmentStub() {
			const setMaskShapes = [];
			const translateCalls = [];
			const stub = {
				save: () => {},
				translate: (x, y) => translateCalls.push([x, y]),
				setMask: (shape) =>
					setMaskShapes.push({ cx: shape.pos.x, cy: shape.pos.y }),
				setColor: () => {},
				fillRect: () => {},
				clearMask: () => {},
				restore: () => {},
			};
			return {
				stub,
				effective: (i) => {
					const acc = translateCalls.reduce(
						(a, [x, y]) => ({ x: a.x + x, y: a.y + y }),
						{ x: 0, y: 0 },
					);
					return {
						x: setMaskShapes[i].cx + acc.x,
						y: setMaskShapes[i].cy + acc.y,
					};
				},
				setMaskShapes,
				translateCalls,
			};
		}

		// helper: spawn a Light2d whose center sits at world (cx, cy).
		// Light2d's anchorPoint is (0.5, 0.5), so the constructor's x/y is
		// already the center — same convention as Ellipse(x, y, w, h).
		function lightAtWorld(cx, cy, radius = 30) {
			return new Light2d(cx, cy, radius, radius);
		}

		it("scrolled camera (X axis): cutout follows the gradient", () => {
			// Real-world scenario: torch attached to player, camera scrolls
			// horizontally. The bright gradient stays glued to the player
			// (because Light2d.draw runs inside the world's translate context),
			// but the cutout must also track or the dark fill will cover the
			// torch's lit area while a phantom hole appears at a fixed world
			// position.
			const stage = freshAlignmentState();
			const light = lightAtWorld(100, 100);
			game.world.addChild(light);

			const camera = game.viewport;
			const orig = { x: camera.pos.x, y: camera.pos.y };
			camera.pos.x = 50;
			camera.pos.y = 0;

			const cap = makeAlignmentStub();
			stage.drawLighting(cap.stub, camera);

			expect(cap.setMaskShapes).toHaveLength(1);
			const eff = cap.effective(0);
			expect(eff.x).toBe(50); // worldX 100 − cameraX 50
			expect(eff.y).toBe(100);

			camera.pos.x = orig.x;
			camera.pos.y = orig.y;
			game.world.removeChildNow(light, true);
			stage.ambientLight.setColor(0, 0, 0, 0);
		});

		it("scrolled camera (Y axis): cutout follows the gradient", () => {
			// Vertical scroll case (e.g. platformer where the camera follows
			// the player's jump). Same bug, different axis.
			const stage = freshAlignmentState();
			const light = lightAtWorld(100, 100);
			game.world.addChild(light);

			const camera = game.viewport;
			const orig = { x: camera.pos.x, y: camera.pos.y };
			camera.pos.x = 0;
			camera.pos.y = 80;

			const cap = makeAlignmentStub();
			stage.drawLighting(cap.stub, camera);

			const eff = cap.effective(0);
			expect(eff.x).toBe(100);
			expect(eff.y).toBe(20); // worldY 100 − cameraY 80

			camera.pos.x = orig.x;
			camera.pos.y = orig.y;
			game.world.removeChildNow(light, true);
			stage.ambientLight.setColor(0, 0, 0, 0);
		});

		it("negative camera position: cutout aligns correctly", () => {
			// Common when the level extends into negative world coords (e.g.
			// player walks left of origin). Sign of the offset matters — a
			// naive subtract that flips the sign would break this case while
			// the positive-X test passes.
			const stage = freshAlignmentState();
			const light = lightAtWorld(-50, 50);
			game.world.addChild(light);

			const camera = game.viewport;
			const orig = { x: camera.pos.x, y: camera.pos.y };
			camera.pos.x = -100;
			camera.pos.y = 0;

			const cap = makeAlignmentStub();
			stage.drawLighting(cap.stub, camera);

			const eff = cap.effective(0);
			expect(eff.x).toBe(50); // worldX -50 − cameraX -100 = 50
			expect(eff.y).toBe(50);

			camera.pos.x = orig.x;
			camera.pos.y = orig.y;
			game.world.removeChildNow(light, true);
			stage.ambientLight.setColor(0, 0, 0, 0);
		});

		it("light parented to a translated container: cutout uses world coords", () => {
			// Torch attached to a player Container at world (200, 150); the
			// torch itself is positioned at (40, 30) relative to the player
			// (its center) → world center (240, 180).
			// `getAbsolutePosition` walks ancestors so getBounds returns
			// world-space — the cutout (no scrolled camera) should sit at
			// (240, 180) in world coords ≡ screen coords here.
			const stage = freshAlignmentState();
			const player = new Container(200, 150, 32, 32);
			game.world.addChild(player);
			const torchRadius = 30;
			const torch = new Light2d(40, 30, torchRadius, torchRadius);
			player.addChild(torch);

			const camera = game.viewport;
			const orig = { x: camera.pos.x, y: camera.pos.y };
			camera.pos.x = 0;
			camera.pos.y = 0;

			const cap = makeAlignmentStub();
			stage.drawLighting(cap.stub, camera);

			const eff = cap.effective(0);
			expect(eff.x).toBe(240); // worldX
			expect(eff.y).toBe(180);

			camera.pos.x = orig.x;
			camera.pos.y = orig.y;
			game.world.removeChildNow(player, true);
			stage.ambientLight.setColor(0, 0, 0, 0);
		});

		it("nested container + scrolled camera: both transforms compose correctly", () => {
			// The compound case from the original Copilot concern: torch on
			// player, camera scrolls. Both the parent translate and the
			// camera scroll must be accounted for.
			const stage = freshAlignmentState();
			const player = new Container(200, 150, 32, 32);
			game.world.addChild(player);
			const torchRadius = 30;
			// torch local center (40, 30) → world center (240, 180)
			const torch = new Light2d(40, 30, torchRadius, torchRadius);
			player.addChild(torch);

			const camera = game.viewport;
			const orig = { x: camera.pos.x, y: camera.pos.y };
			camera.pos.x = 90;
			camera.pos.y = 30;

			const cap = makeAlignmentStub();
			stage.drawLighting(cap.stub, camera);

			// torch world center = (240, 180); screen = world − camera = (150, 150)
			const eff = cap.effective(0);
			expect(eff.x).toBe(150);
			expect(eff.y).toBe(150);

			camera.pos.x = orig.x;
			camera.pos.y = orig.y;
			game.world.removeChildNow(player, true);
			stage.ambientLight.setColor(0, 0, 0, 0);
		});

		it("multiple lights at different positions: each cutout aligns independently", () => {
			// Two lights, one at world (100, 100) attached to root, one at
			// world (300, 200) inside a translated container. Camera scrolls.
			// Each cutout must end up at its own world − camera position.
			const stage = freshAlignmentState();

			const lightA = lightAtWorld(100, 100);
			game.world.addChild(lightA);

			const player = new Container(250, 150, 32, 32);
			game.world.addChild(player);
			const radB = 30;
			// world center = player.pos + lightB.pos = (250, 150) + (50, 50) = (300, 200)
			const lightB = new Light2d(50, 50, radB, radB);
			player.addChild(lightB);

			const camera = game.viewport;
			const orig = { x: camera.pos.x, y: camera.pos.y };
			camera.pos.x = 60;
			camera.pos.y = 0;

			const cap = makeAlignmentStub();
			stage.drawLighting(cap.stub, camera);

			expect(cap.setMaskShapes).toHaveLength(2);
			// We can't rely on iteration order of a Set, so check the set of
			// effective positions matches the expected set.
			const expected = new Set(["40,100", "240,200"]); // (worldX − 60, worldY)
			const got = new Set([
				`${cap.effective(0).x},${cap.effective(0).y}`,
				`${cap.effective(1).x},${cap.effective(1).y}`,
			]);
			expect(got).toEqual(expected);

			camera.pos.x = orig.x;
			camera.pos.y = orig.y;
			game.world.removeChildNow(lightA, true);
			game.world.removeChildNow(player, true);
			stage.ambientLight.setColor(0, 0, 0, 0);
		});

		it("light moved at runtime: cutout follows the new position", () => {
			// Move the light after creation (centerOn is the public API
			// shown in the example for mouse-following). The cutout must
			// reflect the new position on the next drawLighting call.
			const stage = freshAlignmentState();
			const radius = 30;
			const light = new Light2d(0, 0, radius, radius);
			game.world.addChild(light);

			// move the light so its center is at world (75, 60)
			light.centerOn(75, 60);

			const camera = game.viewport;
			const orig = { x: camera.pos.x, y: camera.pos.y };
			camera.pos.x = 0;
			camera.pos.y = 0;

			const cap = makeAlignmentStub();
			stage.drawLighting(cap.stub, camera);

			const eff = cap.effective(0);
			expect(eff.x).toBe(75);
			expect(eff.y).toBe(60);

			camera.pos.x = orig.x;
			camera.pos.y = orig.y;
			game.world.removeChildNow(light, true);
			stage.ambientLight.setColor(0, 0, 0, 0);
		});

		it("baseline: default camera at origin still aligns (regression guard)", () => {
			// Sanity check that the no-scroll case remains correct after the
			// fix lands — we don't want to over-correct and break the
			// originally-working setup.
			const stage = freshAlignmentState();
			const light = lightAtWorld(64, 64);
			game.world.addChild(light);

			const camera = game.viewport;
			const orig = { x: camera.pos.x, y: camera.pos.y };
			camera.pos.x = 0;
			camera.pos.y = 0;

			const cap = makeAlignmentStub();
			stage.drawLighting(cap.stub, camera);

			const eff = cap.effective(0);
			expect(eff.x).toBe(64);
			expect(eff.y).toBe(64);

			camera.pos.x = orig.x;
			camera.pos.y = orig.y;
			game.world.removeChildNow(light, true);
			stage.ambientLight.setColor(0, 0, 0, 0);
		});
	});

	describe("Light2d coordinate semantics", () => {
		it("constructor x/y is the CENTER of the light (anchorPoint = 0.5, 0.5)", () => {
			// Light2d uses a centered anchor so the constructor's x/y means
			// the light's center — same convention as Ellipse(x, y, w, h).
			// A light created at (100, 100) with radius 30 has its visible
			// gradient center at (100, 100); bounds extend (70, 70)–(130, 130).
			const light = new Light2d(100, 100, 30, 30);
			game.world.addChild(light);
			const b = light.getBounds();
			expect(b.centerX).toBe(100);
			expect(b.centerY).toBe(100);
			expect(b.width).toBe(60); // 2 * radius
			expect(b.height).toBe(60);
			expect(b.x).toBe(70); // center − radius
			expect(b.y).toBe(70);
			game.world.removeChildNow(light, true);
		});

		it("centerOn(x, y) repositions the light's center", () => {
			const light = new Light2d(0, 0, 30, 30);
			game.world.addChild(light);
			light.centerOn(200, 150);
			const b = light.getBounds();
			expect(b.centerX).toBe(200);
			expect(b.centerY).toBe(150);
			game.world.removeChildNow(light, true);
		});

		it("getVisibleArea() reflects the bounding-box center in world coords", () => {
			// The cutout shape used by Stage.drawLighting comes from
			// getVisibleArea — its center must match getBounds().centerX/Y
			// (i.e. world-space) so the alignment fix in drawLighting can
			// rely on a single coord space.
			const light = new Light2d(75, 105, 25, 25);
			game.world.addChild(light);
			const va = light.getVisibleArea();
			expect(va.pos.x).toBe(light.getBounds().centerX);
			expect(va.pos.y).toBe(light.getBounds().centerY);
			expect(va.pos.x).toBe(75);
			expect(va.pos.y).toBe(105);
			game.world.removeChildNow(light, true);
		});

		it("getVisibleArea() walks ancestors (parented light → world coords)", () => {
			// When a light is parented to a translated container, its
			// visible area's center must be in world space, not parent-local.
			const player = new Container(200, 150, 32, 32);
			game.world.addChild(player);
			// torch local center (40, 30) → world center (240, 180)
			const torch = new Light2d(40, 30, 30, 30);
			player.addChild(torch);
			const va = torch.getVisibleArea();
			expect(va.pos.x).toBe(240);
			expect(va.pos.y).toBe(180);
			game.world.removeChildNow(player, true);
		});

		it("constructor: pos is offset by (-radiusX, -radiusY) from the requested center", () => {
			// Implementation detail of how the center semantic is achieved:
			// Renderable's underlying Rect uses top-left positioning, so the
			// constructor translates the requested center by -radius to set
			// `pos`. This test pins that contract so any future refactor
			// (e.g. switching to anchorPoint=(0.5,0.5)) still has to keep the
			// constructor x/y == center.
			const light = new Light2d(100, 100, 30, 25);
			expect(light.pos.x).toBe(70); // center 100 − radiusX 30
			expect(light.pos.y).toBe(75); // center 100 − radiusY 25
			// the visible center, not the pos, is what users care about
			const b = light.getBounds();
			expect(b.centerX).toBe(100);
			expect(b.centerY).toBe(100);
			light.destroy();
		});

		it("constructor: asymmetric radii (radiusX !== radiusY) center correctly on both axes", () => {
			// Adversarial: catch a regression where a fix accidentally uses
			// radiusX for both axes (or width/2 only for X).
			const light = new Light2d(50, 50, 40, 10);
			game.world.addChild(light);
			const b = light.getBounds();
			expect(b.centerX).toBe(50);
			expect(b.centerY).toBe(50);
			expect(b.width).toBe(80); // 2 * radiusX
			expect(b.height).toBe(20); // 2 * radiusY
			expect(b.x).toBe(10); // 50 − 40
			expect(b.y).toBe(40); // 50 − 10
			game.world.removeChildNow(light, true);
		});

		it("constructor at origin (0, 0): bounds extend symmetrically into negative coords", () => {
			// Catches off-by-one fixes that hardcode positive offsets.
			const light = new Light2d(0, 0, 25, 25);
			game.world.addChild(light);
			const b = light.getBounds();
			expect(b.centerX).toBe(0);
			expect(b.centerY).toBe(0);
			expect(b.x).toBe(-25);
			expect(b.y).toBe(-25);
			game.world.removeChildNow(light, true);
		});

		it("constructor: matches Ellipse(x, y, w, h) center semantics", () => {
			// The whole point of choosing the center semantic — verify it
			// actually matches what users would write for an Ellipse, so
			// `Light2d(x, y, r, r)` and `new Ellipse(x, y, 2r, 2r)` describe
			// the same region.
			const x = 120;
			const y = 90;
			const r = 35;
			const light = new Light2d(x, y, r, r);
			game.world.addChild(light);
			const lightArea = light.getVisibleArea();
			// `Ellipse(x, y, w, h)` uses x/y as center (per its setShape docstring),
			// w/h as full diameters — same as `Light2d` after this PR.
			const ref = new Ellipse(x, y, 2 * r, 2 * r);
			expect(lightArea.pos.x).toBe(ref.pos.x);
			expect(lightArea.pos.y).toBe(ref.pos.y);
			expect(lightArea.radiusV.x).toBe(ref.radiusV.x);
			expect(lightArea.radiusV.y).toBe(ref.radiusV.y);
			game.world.removeChildNow(light, true);
		});

		it("constructor + centerOn(): centerOn moves the visible center, not the constructor's local pos", () => {
			// Document the interplay: after `new Light2d(x, y, …)`, calling
			// `centerOn(nx, ny)` should make the light's gradient center
			// land at (nx, ny) — the constructor's (x, y) is just the
			// initial center, replaceable later via centerOn.
			const light = new Light2d(50, 50, 30, 30);
			game.world.addChild(light);
			expect(light.getBounds().centerX).toBe(50);
			light.centerOn(200, 175);
			expect(light.getBounds().centerX).toBe(200);
			expect(light.getBounds().centerY).toBe(175);
			game.world.removeChildNow(light, true);
		});
	});

	describe("backward compatibility — legacy `lights.set` API", () => {
		it("a light registered via stage.lights.set is adopted into the world on reset", () => {
			// reset() is what adopts entries from `lights` into the world
			// tree. We simulate the legacy pattern (set BEFORE reset adopts)
			// by populating the active stage's `lights` Map then calling
			// `reset(game)` so the adoption pass runs.
			const stage = state.current();
			expect(stage).toBeInstanceOf(Stage);

			const light = new Light2d(0, 0, 30);
			stage.lights.set("test_legacy", light);
			expect(light.ancestor).toBeUndefined();

			stage.reset(game);

			expect(light.ancestor).toBeDefined();
			expect(stage._activeLights.has(light)).toBe(true);

			// cleanup
			if (light.ancestor) {
				light.ancestor.removeChildNow(light);
			}
			stage.lights.clear();
		});
	});
});
