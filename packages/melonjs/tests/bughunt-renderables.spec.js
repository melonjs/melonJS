import { beforeAll, describe, expect, it } from "vitest";
import {
	Application,
	BitmapText,
	boot,
	Camera2d,
	Container,
	DropTarget,
	Entity,
	event,
	loader,
	NineSliceSprite,
	ParticleEmitter,
	Renderable,
	Sprite,
	Stage,
	Text,
	Vector2d,
	video,
} from "../src/index.js";

/**
 * Regression specs for the 2026-07 renderables/camera/particles bug-hunt
 * batch. One describe block per confirmed finding.
 */

function makeSpriteSheet() {
	const canvas = document.createElement("canvas");
	canvas.width = 64;
	canvas.height = 64;
	return new Sprite(0, 0, {
		image: canvas,
		framewidth: 32,
		frameheight: 32,
	});
}

describe("Bug-hunt: renderables / camera / particles", () => {
	let app;
	beforeAll(async () => {
		boot();
		app = new Application(800, 600, {
			parent: "screen",
			scale: "auto",
			renderer: video.CANVAS,
		});
		await app.init();
		// bitmap font fixture for the BitmapText aliasing test
		await new Promise((resolve) => {
			loader.preload(
				[
					{
						name: "xolo12",
						type: "image",
						src: "/data/fnt/xolo12.png",
					},
					{
						name: "xolo12",
						type: "binary",
						src: "/data/fnt/xolo12.fnt",
					},
				],
				resolve,
			);
		});
	});

	describe("onVisibilityChange fires only on actual transitions", () => {
		it("a continuously-visible object gets no callbacks after entering", () => {
			const obj = new Renderable(10, 10, 20, 20);
			const calls = [];
			obj.onVisibilityChange = (visible) => {
				calls.push(visible);
			};
			app.world.addChild(obj);

			app.world.update(16);
			expect(calls).toEqual([true]); // enter once

			app.world.update(16);
			app.world.update(16);
			expect(calls).toEqual([true]); // no churn while visible

			obj.pos.x = -5000; // move far off-screen
			app.world.update(16);
			expect(calls).toEqual([true, false]); // leave once

			app.world.removeChildNow(obj);
		});
	});

	describe("Container/Entity destroy forwards real arguments to onDestroyEvent", () => {
		it("a Container subclass receives the actual value, not an Arguments object", () => {
			let received = "unset";
			class TestContainer extends Container {
				onDestroyEvent(arg) {
					received = arg;
				}
			}
			const c = new TestContainer(0, 0, 10, 10);
			c.destroy("the-app");
			expect(received).toBe("the-app");
		});

		it("an Entity subclass receives the actual value, not an Arguments object", () => {
			let received = "unset";
			class TestEntity extends Entity {
				onDestroyEvent(arg) {
					received = arg;
				}
			}
			const e = new TestEntity(0, 0, { width: 10, height: 10 });
			e.destroy("the-app");
			expect(received).toBe("the-app");
		});
	});

	describe("Container.getNextChild", () => {
		it("returns undefined for a non-member instead of the first child", () => {
			const c = new Container(0, 0, 100, 100);
			const a = new Renderable(0, 0, 1, 1);
			const b = new Renderable(0, 0, 1, 1);
			c.addChild(a);
			c.addChild(b);
			const orphan = new Renderable(0, 0, 1, 1);

			expect(c.getNextChild(orphan)).toBe(undefined);
			expect(c.getNextChild(c.getChildren()[0])).toBe(c.getChildren()[1]);
			expect(c.getNextChild(c.getChildren()[1])).toBe(undefined);
		});
	});

	describe("DropTarget.setCheckMethod validates the new method", () => {
		it("rejects an invalid method name and accepts a valid one", () => {
			const target = new DropTarget(0, 0, 10, 10);
			const before = target.checkMethod;

			target.setCheckMethod("nonsense");
			expect(target.checkMethod).toBe(before);

			target.setCheckMethod(target.CHECKMETHOD_CONTAINS);
			expect(target.checkMethod).toBe("contains");
			target.destroy();
		});
	});

	describe("Camera2d bounds clamp honors a non-zero origin", () => {
		it("moveTo can reach the far edge of an offset world", () => {
			const cam = new Camera2d(0, 0, 320, 240);
			cam.setBounds(100, 50, 500, 400); // world spans x:[100,600] y:[50,450]

			cam.moveTo(10000, 10000);
			expect(cam.pos.x).toBe(600 - 320);
			expect(cam.pos.y).toBe(450 - 240);

			cam.moveTo(-10000, -10000);
			expect(cam.pos.x).toBe(100);
			expect(cam.pos.y).toBe(50);
			cam.destroy();
		});

		it("the follow path clamps against the far edges too", () => {
			const cam = new Camera2d(0, 0, 320, 240);
			cam.setBounds(100, 50, 500, 400);
			// target far past the deadzone → must clamp to right/bottom edge
			expect(cam._followH(new Vector2d(10000, 0))).toBe(600 - 320);
			expect(cam._followV(new Vector2d(0, 10000))).toBe(450 - 240);
			cam.destroy();
		});
	});

	describe("Camera2d.destroy unsubscribes global listeners", () => {
		it("a destroyed camera no longer reacts to GAME_RESET", () => {
			const cam = new Camera2d(0, 0, 100, 100);
			cam.destroy();
			// before the fix the zombie listener ran reset() on freed state
			// (this.pos is undefined after destroy) and threw a TypeError
			expect(() => {
				event.emit(event.GAME_RESET);
			}).not.toThrow();
			expect(() => {
				event.emit(event.CANVAS_ONRESIZE, 800, 600);
			}).not.toThrow();
		});

		it("Stage.destroy destroys the cameras it constructed, sparing user cameras", () => {
			const userCam = new Camera2d(0, 0, 100, 100);
			// a secondary user camera (a camera named "default" would occupy
			// the default slot and the stage would construct nothing)
			userCam.name = "minimap";
			const stage = new Stage({
				cameras: [userCam],
				cameraClass: Camera2d,
			});
			stage.reset(app);
			const stageCam = stage.cameras.get("default");
			expect(stageCam).not.toBe(userCam);

			stage.destroy(app);
			// the stage-constructed default is destroyed (freed state)...
			expect(stageCam.pos).toBe(undefined);
			// ...the user-provided camera is untouched (re-added on next reset)
			expect(userCam.pos).not.toBe(undefined);
			userCam.destroy();
		});
	});

	describe("completed play-once animations can be replayed", () => {
		it("setCurrentAnimation with the same name restarts a finished loop:false run", () => {
			const sprite = makeSpriteSheet();
			sprite.addAnimation("once", [0, 1], 10);
			sprite.setCurrentAnimation("once", { loop: false });

			sprite.update(25); // 25ms across 2×10ms frames → completes, holds last
			expect(sprite.getCurrentAnimationFrame()).toBe(1);
			sprite.update(50); // stays held
			expect(sprite.getCurrentAnimationFrame()).toBe(1);

			// replay — before the fix this was a permanent no-op
			sprite.setCurrentAnimation("once", { loop: false });
			expect(sprite.getCurrentAnimationFrame()).toBe(0);
			sprite.update(12);
			expect(sprite.getCurrentAnimationFrame()).toBe(1);
			sprite.destroy();
		});

		it("re-selecting a RUNNING animation stays a no-op (call-every-frame idiom)", () => {
			const sprite = makeSpriteSheet();
			sprite.addAnimation("walk", [0, 1, 2], 10);
			sprite.setCurrentAnimation("walk");

			sprite.update(12);
			expect(sprite.getCurrentAnimationFrame()).toBe(1);

			sprite.setCurrentAnimation("walk"); // must not restart mid-run
			expect(sprite.getCurrentAnimationFrame()).toBe(1);
			sprite.destroy();
		});
	});

	describe("zero-delay animation frames do not hang the update loop", () => {
		it("advances one frame per tick instead of spinning forever", () => {
			const sprite = makeSpriteSheet();
			sprite.addAnimation("zero", [
				{ name: 0, delay: 0 },
				{ name: 1, delay: 0 },
			]);
			sprite.setCurrentAnimation("zero");

			sprite.update(16); // before the fix: infinite while loop (tab freeze)
			expect(sprite.getCurrentAnimationFrame()).toBe(1);
			sprite.update(16);
			expect(sprite.getCurrentAnimationFrame()).toBe(0);
			sprite.destroy();
		});
	});

	describe("dead particles are removed synchronously", () => {
		it("a particle reaching end-of-life leaves its emitter within the same update", () => {
			const emitter = new ParticleEmitter(100, 100, { totalParticles: 1 });
			app.world.addChild(emitter);
			emitter.burstParticles(1);
			expect(emitter.getChildren().length).toBe(1);

			const particle = emitter.getChildren()[0];
			particle.life = 0; // force end-of-life
			particle.update(16);

			// before the fix removal was deferred to a macrotask while the
			// instance was ALREADY released to the pool — a same-frame
			// respawn could be silently killed by the stale deferred removal
			expect(emitter.getChildren().length).toBe(0);
			expect(particle.ancestor).toBe(undefined);

			app.world.removeChildNow(emitter);
		});
	});

	describe("Text does not alias the caller's string array", () => {
		it("destroy() no longer wipes an array passed to setText", () => {
			const lines = ["line one", "line two"];
			const text = new Text(0, 0, {
				font: "Arial",
				size: 10,
				text: "placeholder",
			});
			text.setText(lines);
			text.destroy();
			expect(lines).toEqual(["line one", "line two"]);
		});

		it("BitmapText.destroy() no longer wipes an array passed to setText", () => {
			const lines = ["line one", "line two"];
			const text = new BitmapText(0, 0, {
				font: "xolo12",
				text: "placeholder",
			});
			text.setText(lines);
			text.destroy();
			expect(lines).toEqual(["line one", "line two"]);
		});
	});

	describe("NineSliceSprite fractional corners", () => {
		it("slices tile the source and target exactly for a non-/4 width", () => {
			// w = 30 → corner = 7.5; the old `<< 1` truncated 2×7.5 = 15 to
			// 14, so the three slice widths summed to 31/91 (1px bleed/seam)
			const canvas = document.createElement("canvas");
			canvas.width = 30;
			canvas.height = 30;
			const nss = new NineSliceSprite(0, 0, {
				image: canvas,
				width: 90,
				height: 90,
			});
			const calls = [];
			nss.draw({
				drawImage: (...args) => {
					calls.push(args);
				},
			});
			expect(calls.length).toBe(9);
			// args: (image, sx, sy, sw, sh, dx, dy, dw, dh) — row 0 = calls 0..2
			const sourceRowWidth = calls[0][3] + calls[1][3] + calls[2][3];
			const targetRowWidth = calls[0][7] + calls[1][7] + calls[2][7];
			expect(sourceRowWidth).toBe(30);
			expect(targetRowWidth).toBe(90);
			nss.destroy();
		});
	});
});
