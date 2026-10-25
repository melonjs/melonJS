/**
 * `Renderable#visibilityLayer` and `Camera2d#cullMask`: a camera draws a
 * renderable only if they share a bit.
 *
 * Driven through `Container#draw`, the one place a camera walks the world,
 * counting which children get drawn.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
	Application,
	Camera2d,
	Camera3d,
	Container,
	Light2d,
	ParticleEmitter,
	Renderable,
	Stage,
	state,
	TMXTileMap,
	video,
} from "../src/index.js";
import { resetRenderableState } from "../src/renderable/renderable.js";

describe("visibilityLayer and cullMask", () => {
	let app;
	let renderer;

	beforeAll(async () => {
		app = new Application(100, 100, { renderer: video.CANVAS });
		await app.init();
		renderer = app.renderer;
	});

	afterAll(() => {
		app?.destroy();
	});

	// a renderable that counts its draws, on `layer` when given
	const counted = (layer) => {
		const r = new Renderable(0, 0, 10, 10);
		if (layer !== undefined) {
			r.visibilityLayer = layer;
		}
		r.draws = 0;
		r.draw = () => {
			r.draws++;
		};
		return r;
	};

	// a container of `children`, all in view, drawn once by `camera`
	const drawWith = (camera, ...children) => {
		const world = new Container(0, 0, 100, 100);
		for (const child of children) {
			world.addChild(child);
			child.inViewport = true;
		}
		renderer.save();
		world.draw(renderer, camera);
		renderer.restore();
		return world;
	};

	// a camera drawn in a corner of the screen, as a minimap is
	const corner = () => {
		const camera = new Camera2d(0, 0, 50, 50);
		camera.screenX = 50;
		return camera;
	};

	describe("by default", () => {
		it("draws every layer in a container drawn with no camera", () => {
			// code that calls draw(renderer) itself, as a custom container
			// drawing its children with super.draw(renderer)
			const children = [counted(1), counted(2), counted(1 << 30)];
			drawWith(undefined, ...children);
			for (const child of children) {
				expect(child.draws).toBe(1);
			}
		});

		it("puts every renderable on layer 1", () => {
			expect(new Renderable(0, 0, 1, 1).visibilityLayer).toBe(1);
			expect(new Container(0, 0, 1, 1).visibilityLayer).toBe(1);
		});

		it("lets every camera draw every layer", () => {
			expect(new Camera2d(0, 0, 10, 10).cullMask).toBe(-1);
			expect(new Camera3d(0, 0, 10, 10).cullMask).toBe(-1);
		});

		it("draws everything, whatever its layer", () => {
			const children = [counted(), counted(2), counted(1 << 30)];
			drawWith(app.viewport, ...children);
			drawWith(corner(), ...children);
			for (const child of children) {
				expect(child.draws).toBe(2);
			}
		});
	});

	describe("a camera with a mask", () => {
		it("leaves out a renderable on a layer it does not draw", () => {
			const camera = corner();
			camera.cullMask = ~2;
			const kept = counted(1);
			const left = counted(2);
			drawWith(camera, kept, left);
			expect(kept.draws).toBe(1);
			expect(left.draws).toBe(0);
		});

		it("draws a renderable on several layers if one of them is in the mask", () => {
			const camera = corner();
			camera.cullMask = 4;
			const both = counted(2 | 4);
			drawWith(camera, both);
			expect(both.draws).toBe(1);
		});

		it("leaves it out on the default camera too", () => {
			app.viewport.cullMask = ~2;
			try {
				const left = counted(2);
				drawWith(app.viewport, left);
				expect(left.draws).toBe(0);
			} finally {
				app.viewport.cullMask = -1;
			}
		});

		it("leaves out a container with everything inside it", () => {
			const camera = corner();
			camera.cullMask = ~2;
			const inside = counted(1);
			const box = new Container(0, 0, 50, 50);
			box.visibilityLayer = 2;
			box.addChild(inside);
			inside.inViewport = true;
			drawWith(camera, box);
			expect(inside.draws).toBe(0);
		});

		it("draws a container's contents only on the layers they share with it", () => {
			// the container is drawn (layer 2), but its child is on layer 1
			const camera = corner();
			camera.cullMask = 2;
			const inside = counted(1);
			const box = new Container(0, 0, 50, 50);
			box.visibilityLayer = 2;
			box.addChild(inside);
			inside.inViewport = true;
			drawWith(camera, box);
			expect(inside.draws).toBe(0);
		});

		it("leaves out a floating renderable drawn by every camera", () => {
			// `visibleInAllCameras` lets a camera draw it; the mask still applies
			const floating = counted(2);
			floating.floating = true;
			floating.visibleInAllCameras = true;
			const camera = corner();
			drawWith(camera, floating);
			expect(floating.draws).toBe(1);
			camera.cullMask = ~2;
			drawWith(camera, floating);
			expect(floating.draws).toBe(1);
		});

		it("works the same on a Camera3d", () => {
			const camera = new Camera3d(0, 0, 50, 50);
			camera.screenX = 50;
			camera.cullMask = ~2;
			const kept = counted(1);
			const left = counted(2);
			drawWith(camera, kept, left);
			expect(kept.draws).toBe(1);
			expect(left.draws).toBe(0);
		});
	});

	describe("at the edges of a 32-bit mask", () => {
		it("treats bit 31, the sign bit, as a layer like any other", () => {
			const top = counted(1 << 31);
			const camera = corner();
			drawWith(camera, top);
			camera.cullMask = ~(1 << 31);
			drawWith(camera, top);
			camera.cullMask = 1 << 31;
			drawWith(camera, top);
			expect(top.draws).toBe(2);
		});

		it("draws a renderable on no layer in no camera, even one drawing every layer", () => {
			const nowhere = counted(0);
			drawWith(app.viewport, nowhere);
			drawWith(corner(), nowhere);
			expect(nowhere.draws).toBe(0);
		});

		it("draws nothing at all through an empty mask, floating or not", () => {
			const camera = corner();
			camera.cullMask = 0;
			const plain = counted();
			const floating = counted();
			floating.floating = true;
			floating.visibleInAllCameras = true;
			drawWith(camera, plain, floating);
			expect(plain.draws + floating.draws).toBe(0);
		});
	});

	describe("from one draw to the next", () => {
		it("lets two cameras draw their own layers of the same world in one frame", () => {
			const ground = counted(1);
			const sparks = counted(2);
			const minimap = corner();
			minimap.cullMask = ~2;
			const world = new Container(0, 0, 100, 100);
			for (const child of [ground, sparks]) {
				world.addChild(child);
				child.inViewport = true;
			}
			for (const camera of [app.viewport, minimap, app.viewport]) {
				renderer.save();
				world.draw(renderer, camera);
				renderer.restore();
			}
			expect(ground.draws).toBe(3);
			expect(sparks.draws).toBe(2);
		});

		it("takes a change of layer or of mask on the very next draw", () => {
			const camera = corner();
			camera.cullMask = ~2;
			const r = counted(2);
			drawWith(camera, r);
			expect(r.draws).toBe(0);
			r.visibilityLayer = 1;
			drawWith(camera, r);
			expect(r.draws).toBe(1);
			camera.cullMask = 0;
			drawWith(camera, r);
			expect(r.draws).toBe(1);
		});

		it("leaves the renderer's transform as it found it, around what it leaves out", () => {
			// a left out child is skipped before its preDraw, so nothing is
			// pushed that its postDraw would have to pop
			const camera = corner();
			camera.cullMask = ~2;
			const moved = (layer) => {
				const r = counted(layer);
				r.pos.set(13, 7, 0);
				r.anchorPoint.set(0.5, 0.5);
				r.flipX(true);
				return r;
			};
			const before = renderer.getContext().getTransform().toString();
			drawWith(camera, moved(2), moved(1), moved(2), moved(1));
			expect(renderer.getContext().getTransform().toString()).toBe(before);
		});
	});

	describe("down a tree", () => {
		it("leaves out every descendant of a container left out, however deep", () => {
			const camera = corner();
			camera.cullMask = ~2;
			const leaf = counted(1);
			const inner = new Container(0, 0, 50, 50);
			inner.addChild(leaf);
			const middle = new Container(0, 0, 50, 50);
			middle.visibilityLayer = 2;
			middle.addChild(inner);
			const outer = new Container(0, 0, 50, 50);
			outer.addChild(middle);
			for (const node of [leaf, inner, middle, outer]) {
				node.inViewport = true;
			}
			drawWith(camera, outer);
			expect(leaf.draws).toBe(0);
			middle.visibilityLayer = 1;
			drawWith(camera, outer);
			expect(leaf.draws).toBe(1);
		});

		it("draws none of a particle emitter's particles when it is left out", () => {
			const emitter = new ParticleEmitter(0, 0, {
				width: 10,
				height: 10,
				totalParticles: 6,
			});
			emitter.burstParticles();
			let draws = 0;
			for (const particle of emitter.getChildren()) {
				particle.inViewport = true;
				particle.draw = () => {
					draws++;
				};
			}
			expect(emitter.getChildren().length).toBeGreaterThan(0);
			const camera = corner();
			drawWith(camera, emitter);
			const shown = draws;
			expect(shown).toBeGreaterThan(0);
			emitter.visibilityLayer = 2;
			camera.cullMask = ~2;
			drawWith(camera, emitter);
			expect(draws).toBe(shown);
			emitter.destroy();
		});

		it("draws nothing of a world on a layer the camera leaves out", () => {
			const camera = corner();
			const world = new Container(0, 0, 100, 100);
			const child = counted(1);
			world.addChild(child);
			child.inViewport = true;
			camera.draw(renderer, world);
			expect(child.draws).toBe(1);
			world.visibilityLayer = 2;
			camera.cullMask = ~2;
			camera.draw(renderer, world);
			expect(child.draws).toBe(1);
		});
	});

	describe("lights", () => {
		// a stage lit by two lights, one on layer 2
		const litStage = () => {
			const stage = new Stage();
			stage.ambientLight.setColor(0, 0, 0, 0.8);
			const kept = new Light2d(10, 10, 20, 20);
			const left = new Light2d(60, 10, 20, 20);
			left.visibilityLayer = 2;
			stage._activeLights.add(kept);
			stage._activeLights.add(left);
			return { stage, kept, left };
		};

		// the lights cut into a camera's darkness, through a recording renderer
		const cut = (stage, camera) => {
			const holes = [];
			const recorder = {
				save() {},
				restore() {},
				translate() {},
				setColor() {},
				fillRect() {},
				clearMask() {},
				setMask(shape) {
					holes.push(shape);
				},
				drawAmbientLight(color, lights) {
					holes.push(...lights);
				},
			};
			stage.drawLighting(recorder, camera, 0, 0);
			return holes;
		};

		it("cuts no hole in a camera's darkness for a light it leaves out", () => {
			const { stage, kept } = litStage();
			const camera = corner();
			expect(cut(stage, camera).length).toBe(2);
			camera.cullMask = ~2;
			const holes = cut(stage, camera);
			expect(holes.length).toBe(1);
			expect(holes[0]).toBe(kept.getVisibleArea());
		});

		it("leaves it out of the soft darkness too", () => {
			const { stage, kept, left } = litStage();
			kept.softness = 1;
			left.softness = 1;
			const camera = corner();
			camera.cullMask = ~2;
			expect(cut(stage, camera)).toEqual([kept]);
		});

		it("does not light normal-mapped sprites with it in that camera", () => {
			const { stage, kept } = litStage();
			const current = state.current();
			const saved = new Set(current._activeLights);
			for (const light of stage._activeLights) {
				current._activeLights.add(light);
			}
			const given = [];
			const setLightUniforms = renderer.setLightUniforms;
			renderer.setLightUniforms = (lights) => {
				given.push(...lights);
			};
			try {
				const camera = corner();
				camera.cullMask = ~2;
				camera.draw(renderer, new Container(0, 0, 10, 10));
				expect(given).toEqual([kept]);
			} finally {
				renderer.setLightUniforms = setLightUniforms;
				current._activeLights.clear();
				for (const light of saved) {
					current._activeLights.add(light);
				}
			}
		});

		it("leaves out a light inside a container it leaves out, however deep", () => {
			// a torch carried by a player the minimap leaves out: it draws
			// nothing there, and cuts no hole in its darkness either
			const { stage, kept } = litStage();
			const player = new Container(0, 0, 50, 50);
			const hand = new Container(0, 0, 10, 10);
			const torch = new Light2d(20, 20, 20, 20);
			player.addChild(hand);
			hand.addChild(torch);
			stage._activeLights.add(torch);
			player.visibilityLayer = 4;
			const minimap = corner();
			minimap.cullMask = ~4;
			expect(stage._lightsFor(minimap)).not.toContain(torch);
			expect(cut(stage, minimap)).not.toContain(torch);
			// the main camera draws it
			const main = corner();
			expect(stage._lightsFor(main)).toContain(torch);
			expect(stage._lightsFor(main)).toContain(kept);
		});

		it("leaves out a light on no layer, even from a camera drawing every layer", () => {
			const { stage, kept, left } = litStage();
			left.visibilityLayer = 0;
			expect(stage._lightsFor(corner())).toEqual([kept]);
		});
	});

	describe("it only decides drawing", () => {
		it("still updates what a camera leaves out", () => {
			app.viewport.cullMask = ~2;
			try {
				const left = counted(2);
				left.updates = 0;
				left.update = () => {
					left.updates++;
					return false;
				};
				left.alwaysUpdate = true;
				const world = drawWith(app.viewport, left);
				world.update(16);
				expect(left.draws).toBe(0);
				expect(left.updates).toBe(1);
			} finally {
				app.viewport.cullMask = -1;
			}
		});
	});

	describe("elsewhere", () => {
		it("puts a pooled renderable back on layer 1", () => {
			const r = new Renderable(0, 0, 1, 1);
			r.visibilityLayer = 8;
			resetRenderableState(r);
			expect(r.visibilityLayer).toBe(1);
		});

		it("is read from an object's custom property in a Tiled map", () => {
			const map = new TMXTileMap("layers", {
				width: 2,
				height: 2,
				tilewidth: 32,
				tileheight: 32,
				orientation: "orthogonal",
				renderorder: "right-down",
				infinite: false,
				version: "1.10",
				tiledversion: "1.12.0",
				tilesets: [],
				layers: [
					{
						type: "objectgroup",
						name: "things",
						opacity: 1,
						visible: true,
						objects: [
							{
								id: 1,
								name: "particles",
								type: "",
								x: 0,
								y: 0,
								width: 32,
								height: 32,
								properties: [
									{ name: "visibilityLayer", type: "int", value: 2 },
								],
							},
							{
								id: 2,
								name: "plain",
								type: "",
								x: 32,
								y: 0,
								width: 32,
								height: 32,
							},
						],
					},
				],
			});
			const objects = map.getObjects(true);
			const byName = (name) => {
				return objects.find((o) => {
					return o.name === name;
				});
			};
			expect(byName("particles").visibilityLayer).toBe(2);
			expect(byName("plain").visibilityLayer).toBe(1);
		});
	});
});
