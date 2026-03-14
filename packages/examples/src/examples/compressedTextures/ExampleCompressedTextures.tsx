import {
	type CanvasRenderer,
	ColorLayer,
	game,
	loader,
	Renderable,
	Sprite,
	state,
	Text,
	video,
	type WebGLRenderer,
} from "melonjs";
import { createExampleComponent } from "../utils";

// Compressed texture assets grouped by required extension
// Source: sevmeyer/ktxtest (CC0), toji/texture-tester, generated
const textureAssets = [
	{
		name: "dds-dxt1",
		label: "DDS (DXT1)",
		ext: "s3tc",
		src: "assets/compressedTextures/shannon-dxt1.dds",
	},
	{
		name: "dds-dxt5",
		label: "DDS (DXT5)",
		ext: "s3tc",
		src: "assets/compressedTextures/shannon-dxt5.dds",
	},
	{
		name: "ktx-bc1",
		label: "KTX (BC1)",
		ext: "s3tc",
		src: "assets/compressedTextures/format_bc1_rgb_unorm.ktx",
	},
	{
		name: "ktx-bc7",
		label: "KTX (BC7)",
		ext: "bptc",
		src: "assets/compressedTextures/format_bc7_unorm.ktx",
	},
	{
		name: "ktx-astc",
		label: "KTX (ASTC)",
		ext: "astc",
		src: "assets/compressedTextures/format_astc_4x4_srgb.ktx",
	},
	{
		name: "ktx-etc2",
		label: "KTX (ETC2)",
		ext: "etc2",
		src: "assets/compressedTextures/format_etc2_r8g8b8_srgb.ktx",
	},
	{
		name: "ktx2-bc1",
		label: "KTX2 (BC1)",
		ext: "s3tc",
		src: "assets/compressedTextures/synthetic_bc1.ktx2",
	},
	{
		name: "pkm-etc1",
		label: "PKM (ETC1)",
		ext: "etc1",
		src: "assets/compressedTextures/synthetic_etc1.pkm",
	},
	{
		name: "pkm-etc2",
		label: "PKM (ETC2)",
		ext: "etc2",
		src: "assets/compressedTextures/synthetic_etc2.pkm",
	},
	{
		name: "pvr-4bpp",
		label: "PVR (PVRTC)",
		ext: "pvrtc",
		src: "assets/compressedTextures/shannon-pvrtc-4bpp-rgba.pvr",
	},
];

class CompressedTextureDisplay extends Renderable {
	titleFont: Text;
	font: Text;
	smallFont: Text;
	formats: Record<string, unknown>;
	loadedAssets: typeof textureAssets;
	sprites: { sprite: Sprite; label: string; x: number; y: number }[] = [];

	constructor(
		formats: Record<string, unknown>,
		loadedAssets: typeof textureAssets,
	) {
		super(0, 0, game.viewport.width, game.viewport.height);
		this.formats = formats;
		this.loadedAssets = loadedAssets;
		this.anchorPoint.set(0, 0);

		this.titleFont = new Text(0, 0, {
			font: "Arial",
			size: "20px",
			fillStyle: "#FFFFFF",
		});
		this.font = new Text(0, 0, {
			font: "Arial",
			size: "14px",
			fillStyle: "#FFFFFF",
		});
		this.smallFont = new Text(0, 0, {
			font: "Arial",
			size: "12px",
			fillStyle: "#94a3b8",
			textAlign: "center",
		});

		// create sprites for each loaded compressed texture
		const cols = Math.min(Math.max(loadedAssets.length, 1), 4);
		const spacing = 160;
		const startX = game.viewport.width / 2 - ((cols - 1) * spacing) / 2;
		const startY = 200;

		for (let i = 0; i < loadedAssets.length; i++) {
			const asset = loadedAssets[i];
			const col = i % cols;
			const row = Math.floor(i / cols);
			const x = startX + col * spacing;
			const y = startY + row * 140;

			const img = loader.getImage(asset.name);
			if (img) {
				const sprite = new Sprite(x, y, { image: asset.name });
				const maxSize = 100;
				if (sprite.width > maxSize || sprite.height > maxSize) {
					const s = maxSize / Math.max(sprite.width, sprite.height);
					sprite.scale(s);
				}
				this.sprites.push({ sprite, label: asset.label, x, y });
			}
		}
	}

	override update() {
		return true;
	}

	override draw(renderer: WebGLRenderer | CanvasRenderer) {
		let y = 10;
		const x = 10;

		// Title
		this.titleFont.draw(renderer, "Compressed Texture Format Support", x, y);
		y += 32;

		// Format support table
		const extensions: [string, string][] = [
			["s3tc", "S3TC (DXT1/DXT3/DXT5)"],
			["bptc", "BPTC (BC7)"],
			["astc", "ASTC"],
			["etc2", "ETC2"],
			["etc1", "ETC1"],
			["pvrtc", "PVRTC"],
		];

		for (const [key, label] of extensions) {
			const supported =
				this.formats[key] !== null && this.formats[key] !== undefined;
			this.font.fillStyle.parseCSS(supported ? "#4ade80" : "#f87171");
			this.font.draw(
				renderer,
				`${label}: ${supported ? "supported" : "not available"}`,
				x,
				y,
			);
			y += 20;
		}

		// Draw each compressed texture sprite + label
		for (const entry of this.sprites) {
			entry.sprite.preDraw(renderer);
			entry.sprite.draw(renderer);
			entry.sprite.postDraw(renderer);

			this.smallFont.fillStyle.parseCSS("#94a3b8");
			this.smallFont.draw(renderer, entry.label, entry.x, entry.y + 60);
		}

		// Footer info
		const footerY = game.viewport.height - 40;
		this.font.fillStyle.parseCSS("#64748b");
		this.font.draw(
			renderer,
			`${this.sprites.length} compressed texture(s) loaded. Assets: sevmeyer/ktxtest (CC0).`,
			x,
			footerY,
		);
	}
}

const createGame = () => {
	if (
		!video.init(800, 600, {
			parent: "screen",
			scaleMethod: "flex",
			renderer: video.WEBGL,
		})
	) {
		alert("Your browser does not support WebGL.");
		return;
	}

	const renderer = video.renderer as WebGLRenderer;
	const formats = renderer.getSupportedCompressedTextureFormats();

	// Filter texture assets to only those whose extension is supported
	const supportedAssets = textureAssets.filter((asset) => {
		const ext = formats[asset.ext as keyof typeof formats];
		return ext !== null && ext !== undefined;
	});

	// Build resource list for the loader
	const resources = supportedAssets.map((asset) => ({
		name: asset.name,
		type: "image" as const,
		src: asset.src,
	}));

	const showScene = () => {
		state.change(state.DEFAULT, true);
		game.world.reset();
		game.world.addChild(new ColorLayer("background", "#0f172a"), 0);
		game.world.addChild(
			new CompressedTextureDisplay(formats, supportedAssets),
			1,
		);
	};

	if (resources.length > 0) {
		loader.preload(resources, showScene);
	} else {
		showScene();
	}
};

export const ExampleCompressedTextures = createExampleComponent(createGame);
