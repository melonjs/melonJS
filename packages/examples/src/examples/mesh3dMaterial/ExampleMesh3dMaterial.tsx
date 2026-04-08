import { DebugPanelPlugin } from "@melonjs/debug-plugin";
import {
	Application,
	type CanvasRenderer,
	loader,
	Mesh,
	plugin,
	Renderable,
	Sprite,
	Text,
	Vector3d,
	video,
	type WebGLRenderer,
} from "melonjs";
import { createExampleComponent } from "../utils";

const kenneyBase = `${import.meta.env.BASE_URL}assets/mesh3d/kenney/`;

// Kenney cube pet models
const animals = [
	"animal-fox",
	"animal-cat",
	"animal-dog",
	"animal-bunny",
	"animal-penguin",
	"animal-panda",
	"animal-lion",
	"animal-tiger",
	"animal-cow",
	"animal-pig",
	"animal-monkey",
	"animal-elephant",
	"animal-deer",
	"animal-giraffe",
	"animal-koala",
	"animal-polar",
	"animal-beaver",
	"animal-bee",
	"animal-chick",
	"animal-hog",
	"animal-crab",
	"animal-fish",
	"animal-parrot",
	"animal-caterpillar",
];

const createGame = () => {
	const app = new Application(1024, 768, {
		parent: "screen",
		renderer: video.AUTO,
		scale: "auto",
	});

	app.world.backgroundColor.parseCSS("#87CEEB");
	plugin.register(DebugPanelPlugin, "debugPanel");

	// build preload list
	const resources: { name: string; type: string; src: string }[] = [
		{ name: "jungle_bg", type: "image", src: `${kenneyBase}jungle_bg.png` },
		{ name: "kenney_logo", type: "image", src: `${kenneyBase}kenney_logo.png` },
		{
			name: "colormap",
			type: "image",
			src: `${kenneyBase}Textures/colormap.png`,
		},
	];

	for (const name of animals) {
		resources.push(
			{ name, type: "obj", src: `${kenneyBase}${name}.obj` },
			{ name, type: "mtl", src: `${kenneyBase}${name}.mtl` },
		);
	}

	loader.preload(resources, () => {
		// 2D jungle background
		const bg = new Sprite(512, 384, {
			image: "jungle_bg",
			anchorPoint: { x: 0.5, y: 0.5 },
		});
		app.world.addChild(bg, 0);

		const axisY = new Vector3d(0, 1, 0);

		class PetGallery extends Renderable {
			meshes: Mesh[];
			currentIndex: number;

			constructor() {
				super(0, 0, 1024, 768);
				this.anchorPoint.set(0, 0);
				this.currentIndex = 0;

				this.meshes = animals.map((name) => {
					return new Mesh(512, 384, {
						model: name,
						material: name,
						texture: "colormap",
						width: 400,
						height: 400,
						cullBackFaces: true,
					});
				});
			}

			override update(dt: number) {
				this.meshes[this.currentIndex].rotate(dt * 0.001, axisY);
				return true;
			}

			override draw(renderer: WebGLRenderer | CanvasRenderer) {
				const mesh = this.meshes[this.currentIndex];
				mesh.preDraw(renderer);
				mesh.draw(renderer);
				mesh.postDraw(renderer);
			}
		}

		const gallery = new PetGallery();
		app.world.addChild(gallery, 1);

		// dropdown to switch animals
		const select = document.createElement("select");
		select.style.cssText =
			"position:absolute;top:110px;left:16px;padding:6px 12px;" +
			"font-size:14px;background:#1a1a1a;color:#e0e0e0;border:1px solid #444;" +
			"border-radius:4px;z-index:1000;cursor:pointer;";

		for (let i = 0; i < animals.length; i++) {
			const opt = document.createElement("option");
			opt.value = String(i);
			const label = animals[i].replace("animal-", "");
			opt.textContent = label.charAt(0).toUpperCase() + label.slice(1);
			select.appendChild(opt);
		}

		select.addEventListener("change", () => {
			gallery.currentIndex = parseInt(select.value, 10);
		});

		// Kenney attribution text (bottom-left)
		const credit = new Text(10, 700, {
			font: "Arial",
			size: 12,
			fillStyle: "#FFFFFF",
			textAlign: "left",
			textBaseline: "bottom",
			text: "Cube Pets (2.0) by Kenney (kenney.nl) \u2022 CC0 1.0",
		});
		credit.setOpacity(0.7);
		app.world.addChild(credit, 2);

		// Kenney logo (bottom-right)
		const logo = new Sprite(1024 - 75, 700, {
			image: "kenney_logo",
			anchorPoint: { x: 0.5, y: 0.5 },
		});
		logo.scale(0.35);
		logo.setOpacity(0.7);
		app.world.addChild(logo, 2);

		const parent = app.renderer.getCanvas().parentElement;
		if (parent) {
			parent.style.position = "relative";
			parent.appendChild(select);
		}
	});
};

export const ExampleMesh3dMaterial = createExampleComponent(createGame);
