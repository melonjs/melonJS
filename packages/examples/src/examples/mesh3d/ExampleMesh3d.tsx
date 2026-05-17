/**
 * melonJS — 3D mesh + Matrix3d rendering example.
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 */
import { DebugPanelPlugin } from "@melonjs/debug-plugin";
import {
	Application,
	type CanvasRenderer,
	loader,
	Mesh,
	plugin,
	Renderable,
	Sprite,
	Vector3d,
	video,
	type WebGLRenderer,
} from "melonjs";
import galaxyImg from "../sprite/assets/galaxy.png";
import { createExampleComponent } from "../utils";

const base = `${import.meta.env.BASE_URL}assets/mesh3d/`;

const createGame = () => {
	const app = new Application(1024, 768, {
		parent: "screen",
		renderer: video.AUTO,
		scale: "auto",
	});

	app.world.backgroundColor.parseCSS("#1a1a2e");
	plugin.register(DebugPanelPlugin, "debugPanel");

	loader.preload(
		[
			{ name: "galaxy", type: "image", src: galaxyImg },
			{
				name: "checkerboard",
				type: "image",
				src: `${base}checkerboard.png`,
			},
			{ name: "cube", type: "obj", src: `${base}cube.obj` },
			{ name: "sphere", type: "obj", src: `${base}sphere.obj` },
			{ name: "teapot", type: "obj", src: `${base}teapot.obj` },
		],
		() => {
			// 2D background sprite
			const bg = new Sprite(512, 384, {
				image: "galaxy",
				anchorPoint: { x: 0.5, y: 0.5 },
			});
			bg.setOpacity(0.6);
			app.world.addChild(bg, 0);

			const shapes = ["cube", "sphere", "teapot"];
			const axisX = new Vector3d(1, 0, 0);
			const axisY = new Vector3d(0, 1, 0);

			class RotatingMesh extends Renderable {
				mesh: Mesh;

				constructor(shape: string) {
					super(0, 0, 1024, 768);
					this.anchorPoint.set(0, 0);
					this.mesh = this.createMesh(shape);
				}

				createMesh(shape: string) {
					return new Mesh(512, 384, {
						model: shape,
						texture: "checkerboard",
						width: 350,
						height: 350,
						cullBackFaces: true,
					});
				}

				switchShape(shape: string) {
					this.mesh = this.createMesh(shape);
				}

				override update(dt: number) {
					this.mesh.rotate(dt * 0.001, axisY);
					this.mesh.rotate(dt * 0.0005, axisX);
					return true;
				}

				override draw(renderer: WebGLRenderer | CanvasRenderer) {
					this.mesh.preDraw(renderer);
					this.mesh.draw(renderer);
					this.mesh.postDraw(renderer);
				}
			}

			const rotatingMesh = new RotatingMesh("cube");
			app.world.addChild(rotatingMesh, 1);

			// dropdown to switch shapes
			const select = document.createElement("select");
			select.style.cssText =
				"position:absolute;top:110px;left:16px;padding:6px 12px;" +
				"font-size:14px;background:#1a1a1a;color:#e0e0e0;border:1px solid #444;" +
				"border-radius:4px;z-index:1000;cursor:pointer;";

			for (const name of shapes) {
				const opt = document.createElement("option");
				opt.value = name;
				opt.textContent = name.charAt(0).toUpperCase() + name.slice(1);
				select.appendChild(opt);
			}

			select.addEventListener("change", () => {
				rotatingMesh.switchShape(select.value);
			});

			const parent = app.renderer.getCanvas().parentElement;
			if (parent) {
				parent.style.position = "relative";
				parent.appendChild(select);
			}
		},
	);
};

export const ExampleMesh3d = createExampleComponent(createGame);
