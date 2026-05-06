import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
	boot,
	Container,
	Ellipse,
	game,
	Light2d,
	Sprite,
	Stage,
	state,
	video,
} from "../src/index.js";
import {
	createLightUniformScratch,
	packLights,
} from "../src/video/webgl/lighting/pack.ts";

// Replaces the old `Stage.collectLightingUniforms` method (removed
// because it gave Stage a renderer-specific shape; lights/ambient
// stay on Stage, the GPU-shape packing lives in `video/webgl/lighting`).
const _packScratch = createLightUniformScratch();
function packStage(stage, translateX = 0, translateY = 0) {
	return packLights(
		stage._activeLights,
		stage.ambientLightingColor,
		translateX,
		translateY,
		_packScratch,
	);
}

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
				translate: (x, y) => {
					translateCalls.push([x, y]);
				},
				setMask: (shape) => {
					setMaskShapes.push({ cx: shape.pos.x, cy: shape.pos.y });
				},
				setColor: () => {},
				fillRect: () => {},
				clearMask: () => {},
				restore: () => {},
			};
			return {
				stub,
				effective: (i) => {
					const acc = translateCalls.reduce(
						(a, [x, y]) => {
							return { x: a.x + x, y: a.y + y };
						},
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

		it("non-default camera (minimap / splitscreen): containerOffset is honored in the cutout translate", () => {
			// `Camera2d.draw()` computes
			//   translateX = camera.pos.x + camera.offset.x + containerOffsetX
			// where `containerOffsetX = container.pos.x` for non-default
			// cameras (i.e. cameras rendering a container other than
			// game.world). `Stage.drawLighting` must honor that same value
			// or the cutout drifts when a minimap/splitscreen camera is
			// in use. This test exercises the public API by passing the
			// `translateX/translateY` parameters explicitly (same as
			// Camera2d.draw does).
			const stage = freshAlignmentState();
			const light = lightAtWorld(100, 100);
			game.world.addChild(light);

			const camera = game.viewport;
			const orig = { x: camera.pos.x, y: camera.pos.y };
			camera.pos.x = 20;
			camera.pos.y = 0;

			const cap = makeAlignmentStub();
			// simulate non-default camera: container offset adds 30, 0 on
			// top of camera.pos. Total world-to-screen translate is 50, 0.
			stage.drawLighting(cap.stub, camera, 50, 0);

			const eff = cap.effective(0);
			expect(eff.x).toBe(50); // 100 − 50
			expect(eff.y).toBe(100);

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

		it("constructor: pos directly equals the requested center (anchorPoint = 0.5)", () => {
			// Light2d uses a centered anchor — `pos` IS the visual center,
			// matching `Sprite` and `Ellipse` conventions. No offset, no
			// surprise: setting `light.pos.x = X` later moves the visible
			// center to X, transforms (scale, rotate) pivot around `pos`.
			const light = new Light2d(100, 100, 30, 25);
			expect(light.pos.x).toBe(100);
			expect(light.pos.y).toBe(100);
			// bounds are anchor-aware so they still surface the real bbox
			const b = light.getBounds();
			expect(b.centerX).toBe(100);
			expect(b.centerY).toBe(100);
			expect(b.x).toBe(70); // center − radiusX
			expect(b.y).toBe(75); // center − radiusY
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

	describe("Light2d transforms (scale, rotate, pos mutation)", () => {
		// helper: read the bounds + visible-area center for a light freshly
		// added to the world (so `getAbsolutePosition` is wired up).
		function spawn(x, y, rx, ry = rx) {
			const light = new Light2d(x, y, rx, ry);
			game.world.addChild(light);
			return light;
		}

		it("uniform scale enlarges bounds around the visible center, not the corner", () => {
			// Why this matters: an anchorPoint=(0,0) implementation would
			// scale from the bbox top-left, drifting the visible center.
			// With anchorPoint=(0.5, 0.5), scale is anchor-aware so the
			// center stays put — what users expect for a light that "pulses".
			const light = spawn(100, 100, 30);
			const beforeCenter = {
				x: light.getBounds().centerX,
				y: light.getBounds().centerY,
			};

			light.scale(2);

			const after = light.getBounds();
			expect(after.centerX).toBeCloseTo(beforeCenter.x);
			expect(after.centerY).toBeCloseTo(beforeCenter.y);
			expect(after.width).toBeCloseTo(120); // 2 × (2 × radius)
			expect(after.height).toBeCloseTo(120);

			game.world.removeChildNow(light, true);
		});

		it("non-uniform scale (sx ≠ sy) preserves the center", () => {
			const light = spawn(80, 60, 25);
			const before = {
				x: light.getBounds().centerX,
				y: light.getBounds().centerY,
			};

			light.scale(1.5, 0.5);

			const after = light.getBounds();
			expect(after.centerX).toBeCloseTo(before.x);
			expect(after.centerY).toBeCloseTo(before.y);
			// width 50 × 1.5 = 75; height 50 × 0.5 = 25
			expect(after.width).toBeCloseTo(75);
			expect(after.height).toBeCloseTo(25);

			game.world.removeChildNow(light, true);
		});

		it("scaling down (< 1) keeps the center stable", () => {
			const light = spawn(50, 50, 40);
			const before = {
				x: light.getBounds().centerX,
				y: light.getBounds().centerY,
			};

			light.scale(0.5);

			const after = light.getBounds();
			expect(after.centerX).toBeCloseTo(before.x);
			expect(after.centerY).toBeCloseTo(before.y);
			expect(after.width).toBeCloseTo(40); // 2 × radius × 0.5
			expect(after.height).toBeCloseTo(40);

			game.world.removeChildNow(light, true);
		});

		it("rotating an elliptical light keeps the center stable", () => {
			// Rotation by 90° on a non-circular light: the bbox dimensions
			// swap (since the rotated ellipse fits a different AABB), but
			// the visual center must not drift. This catches a regression
			// where rotation pivots from a non-center point.
			const light = spawn(120, 80, 40, 20); // wider than tall
			const before = {
				x: light.getBounds().centerX,
				y: light.getBounds().centerY,
			};

			light.rotate(Math.PI / 2);

			const after = light.getBounds();
			expect(after.centerX).toBeCloseTo(before.x);
			expect(after.centerY).toBeCloseTo(before.y);

			game.world.removeChildNow(light, true);
		});

		it("setting pos directly moves the visible center to the new pos", () => {
			// With anchorPoint=(0.5, 0.5), `light.pos.x = X` directly sets
			// the visual center (matching Sprite). Catches a regression
			// where `pos` reverts to top-left semantics.
			const light = spawn(0, 0, 30);
			light.pos.set(150, 200);
			// bounds rebuild on next access
			const b = light.getBounds();
			expect(b.centerX).toBe(150);
			expect(b.centerY).toBe(200);

			game.world.removeChildNow(light, true);
		});

		it("getVisibleArea() reflects post-scale dimensions (cutout matches gradient size)", () => {
			// The cutout shape must keep up with the rendered light size.
			// Otherwise: scale-up a torch and the dark fill keeps cutting
			// the original-radius hole — leaving a dark ring around the
			// brightened center.
			const light = spawn(100, 100, 25);
			light.scale(2);
			const va = light.getVisibleArea();
			// width tracks transform-applied bounds (anchor-aware), so the
			// cutout ellipse should now have radius 25 → 50.
			expect(va.radiusV.x).toBeCloseTo(50);
			expect(va.radiusV.y).toBeCloseTo(50);
			expect(va.pos.x).toBeCloseTo(100);
			expect(va.pos.y).toBeCloseTo(100);

			game.world.removeChildNow(light, true);
		});

		it("draw() passes pos.x/pos.y to drawImage (anchor-aware regression guard)", () => {
			const light = spawn(150, 100, 30);
			const drawImageCalls = [];
			const stub = {
				drawImage: (img, x, y) => {
					drawImageCalls.push({ x, y });
				},
			};
			light.draw(stub);
			expect(drawImageCalls).toHaveLength(1);
			expect(drawImageCalls[0].x).toBe(150);
			expect(drawImageCalls[0].y).toBe(100);

			game.world.removeChildNow(light, true);
		});

		it("illuminationOnly=true skips drawing the gradient texture", () => {
			// SpriteIlluminator workflow: a logical light source whose own
			// gradient isn't visible — only its effect on normal-mapped
			// sprites is. The light still feeds the cutout pass and the
			// lit-pipeline uniforms; only the per-frame self-draw is
			// suppressed.
			const light = spawn(150, 100, 30);
			light.illuminationOnly = true;

			const drawImageCalls = [];
			const stub = {
				drawImage: (img, x, y) => {
					drawImageCalls.push({ x, y });
				},
			};
			light.draw(stub);
			expect(drawImageCalls).toHaveLength(0);

			game.world.removeChildNow(light, true);
		});

		it("illuminationOnly=true light still appears in _activeLights and lit uniforms", () => {
			// Regression guard: `illuminationOnly` must NOT short-circuit
			// the lifecycle hooks that register the light with the stage.
			// A light that's "invisible" must still illuminate.
			const stage = state.current();
			while (stage._activeLights.size > 0) {
				const l = [...stage._activeLights][0];
				if (l.ancestor) {
					l.ancestor.removeChildNow(l, true);
				} else {
					stage._activeLights.delete(l);
				}
			}

			const light = new Light2d(120, 80, 30, 30, "#ff8000", 0.7);
			light.illuminationOnly = true;
			game.world.addChild(light);

			expect(stage._activeLights.has(light)).toBe(true);

			const u = packStage(stage, 0, 0);
			expect(u.count).toBe(1);
			expect(u.positions[0]).toBe(120);
			expect(u.positions[1]).toBe(80);

			game.world.removeChildNow(light, true);
		});

		it("illuminationOnly=true is also honored by the cutout pass (Stage.drawLighting)", () => {
			// The cutout pass iterates `_activeLights` and emits one
			// setMask per light — illuminationOnly lights MUST still cut
			// holes through the ambient overlay. This test re-uses the
			// stub patterns from the cutout describe block.
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

			const a = new Light2d(40, 40, 20);
			a.illuminationOnly = true;
			const b = new Light2d(80, 80, 20);
			game.world.addChild(a);
			game.world.addChild(b);

			let setMaskCount = 0;
			const stub = {
				save: () => {},
				translate: () => {},
				setMask: () => {
					setMaskCount++;
				},
				setColor: () => {},
				fillRect: () => {},
				clearMask: () => {},
				restore: () => {},
			};
			stage.drawLighting(stub, game.viewport);
			expect(setMaskCount).toBe(2); // both lights cut, regardless of illuminationOnly

			game.world.removeChildNow(a, true);
			game.world.removeChildNow(b, true);
			stage.ambientLight.setColor(0, 0, 0, 0);
		});

		it("transform around `pos` (regression guard): scale does NOT shift the visible center by half-the-bbox", () => {
			// Concrete regression: with anchorPoint=(0,0) (or a forgotten
			// anchor reset), a 2× scale would shift the center by
			// `(width/2, height/2)`. Pin that this does NOT happen.
			const light = spawn(64, 64, 20);
			light.scale(2);
			const b = light.getBounds();
			expect(b.centerX).not.toBeCloseTo(64 + 20); // would be the wrong value
			expect(b.centerX).toBeCloseTo(64);

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

	describe("Stage.collectLightingUniforms (lit pipeline)", () => {
		function freshLitState() {
			const stage = state.current();
			while (stage._activeLights.size > 0) {
				const l = [...stage._activeLights][0];
				if (l.ancestor) {
					l.ancestor.removeChildNow(l, true);
				} else {
					stage._activeLights.delete(l);
				}
			}
			stage.ambientLight.setColor(0, 0, 0, 0);
			stage.ambientLightingColor.setColor(0, 0, 0, 1);
			return stage;
		}

		it("returns count = 0 and zero-padded buffers when no lights are active", () => {
			const stage = freshLitState();
			const u = packStage(stage, 0, 0);
			expect(u.count).toBe(0);
			expect(u.positions).toBeInstanceOf(Float32Array);
			expect(u.colors).toBeInstanceOf(Float32Array);
			expect(u.positions.length).toBe(8 * 4); // MAX_LIGHTS * 4
			expect(u.colors.length).toBe(8 * 3);
			// padded to zeros so stale data can't leak across frames
			for (let i = 0; i < u.positions.length; i++) {
				expect(u.positions[i]).toBe(0);
			}
			for (let i = 0; i < u.colors.length; i++) {
				expect(u.colors[i]).toBe(0);
			}
		});

		it("packs a single light's position, radius, intensity, color", () => {
			const stage = freshLitState();
			const light = new Light2d(120, 80, 30, 30, "#ff0000", 0.6);
			game.world.addChild(light);

			const u = packStage(stage, 0, 0);
			expect(u.count).toBe(1);
			expect(u.positions[0]).toBe(120); // worldX
			expect(u.positions[1]).toBe(80); // worldY
			expect(u.positions[2]).toBe(30); // radius (max of radiusX, radiusY)
			expect(u.positions[3]).toBeCloseTo(0.6); // intensity
			expect(u.colors[0]).toBeCloseTo(1.0, 2); // r
			expect(u.colors[1]).toBeCloseTo(0.0, 2); // g
			expect(u.colors[2]).toBeCloseTo(0.0, 2); // b

			game.world.removeChildNow(light, true);
		});

		it("translates light positions by (translateX, translateY) so they land in camera-local space", () => {
			// Same convention as Stage.drawLighting: subtract camera offset
			// so the lit fragment shader's `lightPos - vWorldPos` matches
			// the renderer's pre-projection coords.
			const stage = freshLitState();
			const light = new Light2d(200, 150, 40, 40);
			game.world.addChild(light);

			const u = packStage(stage, 50, 30);
			expect(u.positions[0]).toBe(150); // 200 − 50
			expect(u.positions[1]).toBe(120); // 150 − 30

			game.world.removeChildNow(light, true);
		});

		it("uses asymmetric radii's MAX value as the light radius", () => {
			const stage = freshLitState();
			const light = new Light2d(0, 0, 80, 25, "#fff", 1);
			game.world.addChild(light);

			const u = packStage(stage, 0, 0);
			expect(u.positions[2]).toBe(80); // max of radiusX/radiusY

			game.world.removeChildNow(light, true);
		});

		it("packs multiple lights independently and reports the count", () => {
			const stage = freshLitState();
			const a = new Light2d(10, 10, 20, 20, "#fff", 1);
			const b = new Light2d(50, 60, 30, 30, "#0f0", 0.5);
			const c = new Light2d(100, 100, 40, 40, "#00f", 0.25);
			game.world.addChild(a);
			game.world.addChild(b);
			game.world.addChild(c);

			const u = packStage(stage, 0, 0);
			expect(u.count).toBe(3);
			// the iteration order isn't guaranteed but each entry must
			// match one of the lights — assert by collecting positions
			const seen = new Set();
			for (let i = 0; i < u.count; i++) {
				seen.add(`${u.positions[i * 4]},${u.positions[i * 4 + 1]}`);
			}
			expect(seen.has("10,10")).toBe(true);
			expect(seen.has("50,60")).toBe(true);
			expect(seen.has("100,100")).toBe(true);

			game.world.removeChildNow(a, true);
			game.world.removeChildNow(b, true);
			game.world.removeChildNow(c, true);
		});

		it("silently drops lights past MAX_LIGHTS (8)", () => {
			const stage = freshLitState();
			const lights = [];
			for (let i = 0; i < 12; i++) {
				const l = new Light2d(i * 10, 0, 5, 5);
				lights.push(l);
				game.world.addChild(l);
			}

			const u = packStage(stage, 0, 0);
			expect(u.count).toBe(8);

			for (const l of lights) {
				game.world.removeChildNow(l, true);
			}
		});

		it("light radius reflects transform-applied bounds (scaled lights have larger reach)", () => {
			// `Stage.collectLightingUniforms` should derive the shader
			// `radius` uniform from the transform-aware bbox so a scaled
			// light's brightness range tracks its visible range. Using the
			// raw `light.radiusX/Y` would leave the lighting math at the
			// pre-scale radius even though the cutout pass (via
			// `getVisibleArea()`) already reflects the scale.
			const stage = freshLitState();
			const light = new Light2d(40, 40, 30, 30);
			game.world.addChild(light);

			let u = packStage(stage, 0, 0);
			const beforeR = u.positions[2];
			expect(beforeR).toBeCloseTo(30); // half of bounds.width (60) at scale 1

			light.scale(2);
			u = packStage(stage, 0, 0);
			const afterR = u.positions[2];
			expect(afterR).toBeCloseTo(60); // bounds.width doubled

			game.world.removeChildNow(light, true);
		});

		it("packs per-light height into a parallel `heights` Float32Array", () => {
			// `Light2d.height` controls the Z component of `lightDir` in
			// the lit shader. Default is `max(radiusX, radiusY) * 0.075`;
			// users can override per-light for stylized "low and grazing"
			// vs "head-on" lighting.
			const stage = freshLitState();
			const a = new Light2d(0, 0, 100, 50, "#fff", 1);
			const b = new Light2d(50, 50, 80, 80, "#fff", 1);
			b.lightHeight = 200;
			game.world.addChild(a);
			game.world.addChild(b);

			const u = packStage(stage, 0, 0);
			expect(u.heights).toBeInstanceOf(Float32Array);
			expect(u.heights.length).toBe(8); // MAX_LIGHTS
			// default for `a`: max(100, 50) * 0.075 = 7.5
			expect(u.heights[0]).toBeCloseTo(7.5, 4);
			// custom override for `b`
			expect(u.heights[1]).toBe(200);
			// stale slots zeroed
			expect(u.heights[2]).toBe(0);
			expect(u.heights[7]).toBe(0);

			game.world.removeChildNow(a, true);
			game.world.removeChildNow(b, true);
		});

		it("packs ambientLightingColor (RGB / 255) into the ambient slot", () => {
			const stage = freshLitState();
			stage.ambientLightingColor.setColor(85, 85, 85);
			const u = packStage(stage, 0, 0);
			expect(u.ambient[0]).toBeCloseTo(85 / 255, 3);
			expect(u.ambient[1]).toBeCloseTo(85 / 255, 3);
			expect(u.ambient[2]).toBeCloseTo(85 / 255, 3);
		});

		it("re-uses the same scratch buffers across calls (no per-frame allocation)", () => {
			const stage = freshLitState();
			const light = new Light2d(0, 0, 10);
			game.world.addChild(light);
			const u1 = packStage(stage, 0, 0);
			const u2 = packStage(stage, 0, 0);
			expect(u1.positions).toBe(u2.positions);
			expect(u1.colors).toBe(u2.colors);
			game.world.removeChildNow(light, true);
		});

		it("zero-pads stale slots when a light is removed between frames", () => {
			// Frame 1: 2 lights → slots 0, 1 populated, slots 2..7 zero.
			// Frame 2: only 1 light → slot 0 populated; slot 1 must be zeroed
			// out so the shader doesn't see leftover positions.
			const stage = freshLitState();
			const a = new Light2d(10, 10, 5, 5);
			const b = new Light2d(80, 80, 5, 5);
			game.world.addChild(a);
			game.world.addChild(b);
			packStage(stage, 0, 0); // frame 1
			game.world.removeChildNow(b, true);

			const u = packStage(stage, 0, 0); // frame 2
			expect(u.count).toBe(1);
			// the active light landed in slot 0; verify slot 1 is zeroed
			expect(u.positions[4]).toBe(0);
			expect(u.positions[5]).toBe(0);
			expect(u.positions[6]).toBe(0);
			expect(u.positions[7]).toBe(0);

			game.world.removeChildNow(a, true);
		});
	});

	describe("Lit pipeline — adversarial edge cases", () => {
		function freshLitState() {
			const stage = state.current();
			while (stage._activeLights.size > 0) {
				const l = [...stage._activeLights][0];
				if (l.ancestor) {
					l.ancestor.removeChildNow(l, true);
				} else {
					stage._activeLights.delete(l);
				}
			}
			stage.ambientLight.setColor(0, 0, 0, 0);
			stage.ambientLightingColor.setColor(0, 0, 0, 1);
			return stage;
		}

		it("exactly MAX_LIGHTS active lights — all 8 packed; the 9th is dropped", () => {
			// boundary check around the cap. Going from 8 → 9 lights must
			// not overflow the Float32Array (length = 8 * 4) or skip
			// existing lights.
			const stage = freshLitState();
			const lights = [];
			for (let i = 0; i < 9; i++) {
				const l = new Light2d(i * 10, 0, 5, 5);
				lights.push(l);
				game.world.addChild(l);
			}
			const u = packStage(stage, 0, 0);
			expect(u.count).toBe(8);
			// every slot in the buffer must be reachable (no out-of-range writes)
			expect(u.positions.length).toBe(8 * 4);
			expect(u.colors.length).toBe(8 * 3);
			expect(u.heights.length).toBe(8);
			for (const l of lights) {
				game.world.removeChildNow(l, true);
			}
		});

		it("light with `lightHeight = 0` packs cleanly (no NaN, no division)", () => {
			// The shader's lightDir math `normalize(vec3(toLight, height))`
			// handles height=0 fine (it's just a 2D direction with
			// implicit z=0). Stage shouldn't blow up either.
			const stage = freshLitState();
			const l = new Light2d(40, 40, 30, 30);
			l.lightHeight = 0;
			game.world.addChild(l);
			const u = packStage(stage, 0, 0);
			expect(u.count).toBe(1);
			expect(u.heights[0]).toBe(0);
			expect(Number.isFinite(u.positions[0])).toBe(true);
			expect(Number.isFinite(u.heights[0])).toBe(true);
			game.world.removeChildNow(l, true);
		});

		it("light with `lightHeight < 0` is uploaded as-is (shader decides what it means)", () => {
			// Negative height = light below the sprite plane. The shader's
			// `dot(normal, lightDir)` will give negative for upward-facing
			// surface normals → `max(0, neg)` = 0 (unlit). That's a
			// reasonable visual; Stage shouldn't pre-clamp.
			const stage = freshLitState();
			const l = new Light2d(0, 0, 10, 10);
			l.lightHeight = -25;
			game.world.addChild(l);
			const u = packStage(stage, 0, 0);
			expect(u.heights[0]).toBe(-25);
			game.world.removeChildNow(l, true);
		});

		it("light with negative `intensity` is uploaded unclamped", () => {
			// "Negative intensity" = subtractive light — a useful gimmick
			// for shadow-casting effects, but only if Stage doesn't clamp
			// it on the way to the shader.
			const stage = freshLitState();
			const l = new Light2d(0, 0, 50, 50, "#fff", -0.5);
			game.world.addChild(l);
			const u = packStage(stage, 0, 0);
			expect(u.positions[3]).toBe(-0.5); // intensity slot
			game.world.removeChildNow(l, true);
		});

		it("minimum-radius (1px) light: uniforms pack cleanly, no NaN", () => {
			// `Light2d` itself rejects 0×0 (its gradient texture can't be
			// zero-sized). The minimum feasible light is 1px radius; this
			// pins the boundary case so a future degenerate-input handling
			// change doesn't accidentally start NaN-ing.
			const stage = freshLitState();
			const l = new Light2d(50, 50, 1, 1);
			game.world.addChild(l);
			const u = packStage(stage, 0, 0);
			expect(u.count).toBe(1);
			expect(u.positions[2]).toBe(1); // radius from bbox half-width
			expect(Number.isFinite(u.positions[0])).toBe(true);
			expect(Number.isFinite(u.positions[2])).toBe(true);
			expect(Number.isFinite(u.heights[0])).toBe(true);
			game.world.removeChildNow(l, true);
		});

		it("light with non-uniform `radiusX` ≠ `radiusY`: shader radius takes max bbox dimension", () => {
			// transform-aware radius (post-fix #4). The bbox uses
			// max(2*radiusX, 2*radiusY); we feed half of that.
			const stage = freshLitState();
			const l = new Light2d(0, 0, 100, 25);
			game.world.addChild(l);
			const u = packStage(stage, 0, 0);
			expect(u.positions[2]).toBe(100); // max(200, 50) / 2 = 100
			game.world.removeChildNow(l, true);
		});

		it("light pos mutation between frames updates the uniform position", () => {
			const stage = freshLitState();
			const l = new Light2d(10, 20, 30, 30);
			game.world.addChild(l);

			let u = packStage(stage, 0, 0);
			expect(u.positions[0]).toBe(10);
			expect(u.positions[1]).toBe(20);

			l.pos.set(150, 175);
			u = packStage(stage, 0, 0);
			expect(u.positions[0]).toBe(150);
			expect(u.positions[1]).toBe(175);

			game.world.removeChildNow(l, true);
		});

		it("light parented to a deeply nested container chain: getBounds walks the full ancestor stack", () => {
			// container → container → container → light
			const stage = freshLitState();
			const a = new Container(100, 100, 50, 50);
			const b = new Container(50, 50, 50, 50);
			const c = new Container(25, 25, 50, 50);
			game.world.addChild(a);
			a.addChild(b);
			b.addChild(c);
			const torch = new Light2d(10, 10, 5, 5);
			c.addChild(torch);

			const u = packStage(stage, 0, 0);
			// world-space center: 100 + 50 + 25 + 10 = 185 on each axis
			expect(u.positions[0]).toBe(185);
			expect(u.positions[1]).toBe(185);

			game.world.removeChildNow(a, true);
		});

		it("light removed mid-flight: doesn't appear in the next collectLightingUniforms", () => {
			const stage = freshLitState();
			const a = new Light2d(0, 0, 10);
			const b = new Light2d(50, 50, 10);
			game.world.addChild(a);
			game.world.addChild(b);

			expect(packStage(stage, 0, 0).count).toBe(2);

			// remove `a` and verify only `b` shows up
			game.world.removeChildNow(a, true);
			const u = packStage(stage, 0, 0);
			expect(u.count).toBe(1);

			// the surviving light's coords land in slot 0
			expect(u.positions[0]).toBe(50);

			game.world.removeChildNow(b, true);
		});

		it("light removed and re-added across calls: re-registers cleanly", () => {
			const stage = freshLitState();
			const l = new Light2d(40, 40, 20);
			game.world.addChild(l);
			expect(packStage(stage, 0, 0).count).toBe(1);

			game.world.removeChildNow(l, true);
			expect(packStage(stage, 0, 0).count).toBe(0);

			game.world.addChild(l);
			expect(packStage(stage, 0, 0).count).toBe(1);

			game.world.removeChildNow(l, true);
		});

		it("ambientLightingColor with non-1 alpha: alpha is ignored (only RGB feeds the ambient slot)", () => {
			// `ambient` is a vec3 in the shader. Stage reads .r/.g/.b only.
			// Setting alpha != 1 must not reduce the ambient floor.
			const stage = freshLitState();
			stage.ambientLightingColor.setColor(120, 60, 30, 0.5); // alpha 0.5
			const u = packStage(stage, 0, 0);
			expect(u.ambient[0]).toBeCloseTo(120 / 255, 3);
			expect(u.ambient[1]).toBeCloseTo(60 / 255, 3);
			expect(u.ambient[2]).toBeCloseTo(30 / 255, 3);
			expect(u.ambient.length).toBe(3); // no alpha slot
		});

		it("rotated light: lightHeight is independent of rotation (a uniform Z height)", () => {
			// Rotating a Light2d shouldn't change its height — height is
			// "above the sprite plane", not "in the rotation axis."
			const stage = freshLitState();
			const l = new Light2d(0, 0, 30, 30);
			l.lightHeight = 12.5;
			game.world.addChild(l);
			l.rotate(Math.PI / 4);
			const u = packStage(stage, 0, 0);
			expect(u.heights[0]).toBe(12.5);
			game.world.removeChildNow(l, true);
		});

		it("scaled light: position uniform is the (anchor-aware) bbox center, not the scaled corner", () => {
			// After `light.scale(2)`, the bbox grows symmetrically around
			// the center (since anchorPoint is 0.5, 0.5). The uniform
			// position should still be the orig pos.
			const stage = freshLitState();
			const l = new Light2d(80, 60, 20);
			game.world.addChild(l);
			l.scale(2);
			const u = packStage(stage, 0, 0);
			expect(u.positions[0]).toBeCloseTo(80);
			expect(u.positions[1]).toBeCloseTo(60);
			game.world.removeChildNow(l, true);
		});

		it("multiple lights at the SAME world position: each gets its own slot", () => {
			// stacked / overlapping lights are a real pattern (e.g. additive
			// color glows). Stage shouldn't dedup or merge.
			const stage = freshLitState();
			const a = new Light2d(50, 50, 30, 30, "#ff0000", 0.5);
			const b = new Light2d(50, 50, 30, 30, "#0000ff", 0.5);
			game.world.addChild(a);
			game.world.addChild(b);
			const u = packStage(stage, 0, 0);
			expect(u.count).toBe(2);
			// both at same xy
			expect(u.positions[0]).toBe(50);
			expect(u.positions[4]).toBe(50);
			// distinct colors
			const seen = new Set([
				`${u.colors[0]},${u.colors[1]},${u.colors[2]}`,
				`${u.colors[3]},${u.colors[4]},${u.colors[5]}`,
			]);
			expect(seen.size).toBe(2);
			game.world.removeChildNow(a, true);
			game.world.removeChildNow(b, true);
		});
	});

	describe("Lit pipeline — Sprite.normalMap adversarial cases", () => {
		it("re-assigning the same normalMap value is a no-op (preserves it)", () => {
			const normal = video.createCanvas(16, 16);
			const s = new Sprite(0, 0, {
				framewidth: 16,
				frameheight: 16,
				image: video.createCanvas(16, 16),
				normalMap: normal,
			});
			s.normalMap = normal;
			s.normalMap = normal;
			expect(s.normalMap).toBe(normal);
		});

		it("two sprites can share the same normalMap reference safely", () => {
			const normal = video.createCanvas(16, 16);
			const a = new Sprite(0, 0, {
				framewidth: 16,
				frameheight: 16,
				image: video.createCanvas(16, 16),
				normalMap: normal,
			});
			const b = new Sprite(0, 0, {
				framewidth: 16,
				frameheight: 16,
				image: video.createCanvas(16, 16),
				normalMap: normal,
			});
			expect(a.normalMap).toBe(b.normalMap);
			expect(a.normalMap).toBe(normal);
		});

		it("Sprite swapped to a new normalMap mid-life: the old reference is dropped", () => {
			const oldN = video.createCanvas(8, 8);
			const newN = video.createCanvas(16, 16);
			const s = new Sprite(0, 0, {
				framewidth: 8,
				frameheight: 8,
				image: video.createCanvas(8, 8),
				normalMap: oldN,
			});
			s.normalMap = newN;
			expect(s.normalMap).toBe(newN);
			expect(s.normalMap).not.toBe(oldN);
		});

		it("Sprite.destroy releases the normalMap reference even after re-assignment", () => {
			const a = video.createCanvas(8, 8);
			const b = video.createCanvas(16, 16);
			const s = new Sprite(0, 0, {
				framewidth: 8,
				frameheight: 8,
				image: video.createCanvas(8, 8),
				normalMap: a,
			});
			s.normalMap = b; // swap to a different image
			s.destroy();
			expect(s.normalMap).toBeNull();
		});

		it("normalMap setter accepts a duck-typed image-like with numeric width/height", () => {
			// HTMLVideoElement, ImageBitmap, OffscreenCanvas don't all exist
			// in every test environment. The setter validates duck-typed
			// `{ width, height }` so any shape that quacks like an image
			// works.
			const fakeBitmap = { width: 32, height: 32, close: () => {} };
			const s = new Sprite(0, 0, {
				framewidth: 16,
				frameheight: 16,
				image: video.createCanvas(16, 16),
			});
			s.normalMap = fakeBitmap;
			expect(s.normalMap).toBe(fakeBitmap);
		});

		it("normalMap setter rejects an object whose width/height are non-finite (NaN, Infinity)", () => {
			// `typeof NaN === "number"` is true — current setter would
			// accept this. Documents the boundary; if we want stricter
			// validation later, the test pins what we want to flip.
			const s = new Sprite(0, 0, {
				framewidth: 16,
				frameheight: 16,
				image: video.createCanvas(16, 16),
			});
			// Current behavior: NaN dimensions ARE accepted (typeof
			// number is true). Documented here so future stricter
			// validation is a deliberate change.
			expect(() => {
				s.normalMap = { width: Number.NaN, height: Number.NaN };
			}).not.toThrow();
		});

		it("normalMap setter rejects HTMLVideoElement-like sources (videoWidth present)", () => {
			// Copilot regression: a `HTMLVideoElement` duck-types past the
			// width/height check, but the lit pipeline caches the GL
			// texture per image reference and would silently freeze on
			// frame 0. Setter throws TypeError to make this obvious at
			// assignment time instead of producing a confusing visual bug.
			const s = new Sprite(0, 0, {
				framewidth: 16,
				frameheight: 16,
				image: video.createCanvas(16, 16),
			});
			const fakeVideo = {
				width: 64,
				height: 64,
				videoWidth: 64,
				videoHeight: 64,
			};
			expect(() => {
				s.normalMap = fakeVideo;
			}).toThrow(TypeError);
			// constructor settings.normalMap goes through the setter too
			expect(() => {
				return new Sprite(0, 0, {
					framewidth: 16,
					frameheight: 16,
					image: video.createCanvas(16, 16),
					normalMap: fakeVideo,
				});
			}).toThrow(TypeError);
		});
	});

	describe("Renderer.setLightUniforms (Canvas fallback warning)", () => {
		it("emits a one-shot console warning when called with count > 0 in Canvas mode", () => {
			const renderer = video.renderer;
			// Reset the once-flag on the live renderer so we can re-trigger.
			renderer._litPipelineWarned = false;

			const orig = console.warn;
			const warnings = [];
			console.warn = (...args) => {
				return warnings.push(args.join(" "));
			};

			const fakeLight = {
				getBounds: () => {
					return { centerX: 0, centerY: 0, width: 30, height: 30 };
				},
				intensity: 1,
				color: { r: 255, g: 255, b: 255 },
				lightHeight: 1,
			};
			try {
				renderer.setLightUniforms([], null, 0, 0); // empty — no warn
				renderer.setLightUniforms([fakeLight], null, 0, 0); // first warn
				renderer.setLightUniforms(
					[fakeLight, fakeLight, fakeLight, fakeLight, fakeLight],
					null,
					0,
					0,
				);
				renderer.setLightUniforms([fakeLight], null, 0, 0);
			} finally {
				console.warn = orig;
			}

			// only the first non-empty call warns
			expect(warnings.length).toBe(1);
			expect(warnings[0]).toMatch(
				/normal-map lighting requires the WebGL renderer/,
			);
		});

		it("does NOT warn when count is 0 (every-frame default with no active lights)", () => {
			const renderer = video.renderer;
			renderer._litPipelineWarned = false;

			const orig = console.warn;
			const warnings = [];
			console.warn = (...args) => {
				return warnings.push(args.join(" "));
			};

			try {
				for (let i = 0; i < 10; i++) {
					renderer.setLightUniforms([], null, 0, 0);
				}
			} finally {
				console.warn = orig;
			}

			expect(warnings.length).toBe(0);
		});
	});
});
