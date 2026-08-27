/**
 * melonJS — particle reference spaces.
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 */
import {
	Application,
	Container,
	event,
	game,
	ParticleEmitter,
	Renderable,
	Text,
	Vector2d,
	video,
} from "melonjs";
import { createExampleComponent } from "../utils";

const WIDTH = 1100;
const HEIGHT = 640;

// One lane per reference space. Identical emitters, identical motion — the
// only thing that differs is what a particle's position is measured against,
// which is the whole point: any difference you see on screen is the setting.
const LANE_HEIGHT = 168;
const LANE_TOP = 118;
const TRAVEL = WIDTH - 160;

/** the moving object each emitter rides on */
class Ship extends Renderable {
	constructor(
		x: number,
		y: number,
		private readonly tint: string,
	) {
		super(x, y, 34, 20);
		this.anchorPoint.set(0.5, 0.5);
	}

	// biome-ignore lint/suspicious/noExplicitAny: renderer type varies by backend
	override draw(renderer: any) {
		const x = this.pos.x;
		const y = this.pos.y;
		renderer.setColor(this.tint);
		// a blunt arrow, pointing the way it travels
		renderer.fillRect(x, y + 6, 26, 9);
		renderer.fillEllipse(x + 28, y + 10, 8, 10);
		renderer.setColor("rgba(255, 255, 255, 0.75)");
		renderer.fillRect(x + 4, y + 8, 12, 3);
	}
}

const createGame = async () => {
	try {
		const app = new Application(WIDTH, HEIGHT, {
			parent: "screen",
			scaleMethod: "fit",
			renderer: video.AUTO,
		});
		await app.init();
	} catch {
		alert("Your browser does not support HTML5 canvas.");
		return;
	}

	const world = game.world;

	// backdrop, dark enough that the particles read at every lane
	const backdrop = new Renderable(0, 0, WIDTH, HEIGHT);
	backdrop.anchorPoint.set(0, 0);
	// biome-ignore lint/suspicious/noExplicitAny: renderer type varies by backend
	(backdrop as any).draw = (renderer: any) => {
		renderer.setColor("#141326");
		renderer.fillRect(0, 0, WIDTH, HEIGHT);
		for (let i = 0; i < 3; i++) {
			renderer.setColor(i % 2 === 0 ? "#191833" : "#15142b");
			renderer.fillRect(0, LANE_TOP + i * LANE_HEIGHT - 24, WIDTH, LANE_HEIGHT);
		}
	};
	world.addChild(backdrop, 0);

	const emitterSettings = {
		width: 6,
		height: 6,
		totalParticles: 220,
		maxParticles: 5,
		frequency: 24,
		angle: Math.PI,
		angleVariation: 0.55,
		minLife: 1400,
		maxLife: 2100,
		speed: 0.4,
		speedVariation: 0.3,
		minStartScale: 1.6,
		maxStartScale: 2.6,
		minEndScale: 0.2,
		maxEndScale: 0.4,
		framesToSkip: 0,
	};

	const label = (text: string, sub: string, y: number) => {
		const heading = new Text(28, y, {
			font: "Arial",
			size: 17,
			bold: true,
			fillStyle: "#ffffff",
			text,
		});
		heading.floating = true;
		world.addChild(heading, 20);

		const caption = new Text(28, y + 22, {
			font: "Arial",
			size: 13,
			fillStyle: "#a9a7c4",
			text: sub,
		});
		caption.floating = true;
		world.addChild(caption, 20);
	};

	// ---- lane 1: local — the cloud is welded to the ship ------------------
	const localY = LANE_TOP;
	const localShip = new Ship(80, localY + 40, "#ff8a5c");
	world.addChild(localShip, 5);
	const localEmitter = new ParticleEmitter(80, localY + 50, {
		...emitterSettings,
		tint: "#ff8a5c",
		// the default — stated explicitly here because the whole example is
		// about this one setting
		referenceSpace: "local",
	});
	world.addChild(localEmitter, 4);
	localEmitter.streamParticles();
	label(
		'referenceSpace: "local"',
		"the default — particles are measured from the emitter, so the cloud travels with it",
		localY - 46,
	);

	// ---- lane 2: world — the trail is left behind -------------------------
	const worldY = LANE_TOP + LANE_HEIGHT;
	const worldShip = new Ship(80, worldY + 40, "#5cd0ff");
	world.addChild(worldShip, 5);
	const worldEmitter = new ParticleEmitter(80, worldY + 50, {
		...emitterSettings,
		tint: "#5cd0ff",
		referenceSpace: "world",
	});
	world.addChild(worldEmitter, 4);
	worldEmitter.streamParticles();
	label(
		'referenceSpace: "world"',
		"measured from the container the emitter sits in — the ship flies away and leaves the smoke behind",
		worldY - 46,
	);

	// ---- lane 3: custom — travel without the bob --------------------------
	// The emitter rides a ship that BOBS vertically, while the reference
	// container only moves horizontally. So the particles inherit the travel
	// and not the bob — the case that is neither "welded on" nor "left behind".
	const customY = LANE_TOP + LANE_HEIGHT * 2;
	const carriage = new Container(0, 0, WIDTH, LANE_HEIGHT);
	carriage.anchorPoint.set(0, 0);
	world.addChild(carriage, 3);

	const customShip = new Ship(80, customY + 40, "#b98cff");
	world.addChild(customShip, 5);
	const customEmitter = new ParticleEmitter(80, customY + 50, {
		...emitterSettings,
		tint: "#b98cff",
		referenceSpace: carriage,
	});
	world.addChild(customEmitter, 4);
	customEmitter.streamParticles();
	label(
		"referenceSpace: <Container>",
		"measured from a container sliding side to side — the whole trail rides along with it, and never inherits the ship's bob",
		customY - 46,
	);

	const heading = new Text(WIDTH / 2, 30, {
		font: "Arial",
		size: 23,
		bold: true,
		fillStyle: "#ffffff",
		textAlign: "center",
		text: "Particle reference spaces",
	});
	heading.floating = true;
	world.addChild(heading, 20);

	const subheading = new Text(WIDTH / 2, 60, {
		font: "Arial",
		size: 13,
		fillStyle: "#a9a7c4",
		textAlign: "center",
		text: "three identical emitters — only what their particles are measured against differs",
	});
	subheading.floating = true;
	world.addChild(subheading, 20);

	// ---- motion -----------------------------------------------------------
	let t = 0;
	const start = new Vector2d(80, 0);

	const onUpdate = () => {
		t += 1 / 60;
		const x = start.x + ((t * 150) % TRAVEL);
		// a rotation on the emitters, so the correction is exercised under a
		// rotated frame rather than only in the unit tests
		const spin = Math.sin(t * 2) * 0.25;

		localShip.pos.x = x;
		localEmitter.pos.x = x;
		localEmitter.currentTransform.identity();
		localEmitter.rotate(spin);

		worldShip.pos.x = x;
		worldEmitter.pos.x = x;
		worldEmitter.currentTransform.identity();
		worldEmitter.rotate(spin);

		// The carriage slides side to side. Nothing else does — so anything
		// that moves with it is moving because the particles are measured
		// against it, which is the only way to see a custom frame at work.
		carriage.pos.x = Math.sin(t * 0.9) * 130;

		// The bob, by contrast, is on the SHIP (and therefore the emitter) and
		// never on the carriage — so the particles do not inherit it. They are
		// emitted at whatever height the ship happened to be, and stay there.
		const bob = Math.sin(t * 4) * 26;
		customShip.pos.x = x;
		customShip.pos.y = customY + 40 + bob;
		customEmitter.pos.x = x;
		customEmitter.pos.y = customY + 50 + bob;
	};

	event.on(event.GAME_UPDATE, onUpdate);

	return () => {
		event.off(event.GAME_UPDATE, onUpdate);
	};
};

export const ExampleParticleReferenceSpace = createExampleComponent(createGame);
