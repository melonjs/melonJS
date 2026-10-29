/**
 * melonJS — Sprite showcase example.
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 *
 * A small scene in space showing what a Sprite can do. The monster in the
 * middle breathes, sways and wears a different shader effect every few
 * seconds (click it for the next one), up to two effects chained. Coins cut
 * from a TexturePacker atlas orbit it, spinning and passing in front of it
 * and behind it; the astronaut drifts by, walking in mid-air; flies buzz
 * around; tinted, fading and additive little monsters float in the dark.
 * The nebula behind them is Earth Defender's sky, drawn once at the size of
 * the screen with the same noise.
 */
import {
	Application,
	DissolveEffect,
	GlowEffect,
	HologramEffect,
	input,
	loader,
	OutlineEffect,
	type ShaderEffect,
	ShineEffect,
	Sprite,
	Stage,
	SwayEffect,
	state,
	Text,
	TextureAtlas,
	video,
} from "melonjs";
import { createExampleComponent } from "../utils";
import monsterImg from "./assets/monster.png";
import nebulaImg from "./assets/nebula.webp";

const platformer = `${import.meta.env.BASE_URL}assets/platformer/img/`;

const resources = [
	{ name: "monster", type: "image", src: monsterImg },
	{ name: "nebula", type: "image", src: nebulaImg },
	{ name: "texture", type: "json", src: `${platformer}texture.json` },
	{ name: "texture", type: "image", src: `${platformer}texture.png` },
];

const WIDTH = 1200;
const HEIGHT = 700;
const CX = WIDTH / 2;
const CY = HEIGHT / 2 - 10;

const WALK = Array.from({ length: 11 }, (_, i) => {
	return `walk${String(i + 1).padStart(4, "0")}.png`;
});
const FLY = ["fly_normal.png", "fly_fly.png"];

/** how long the monster wears each effect, in seconds */
const EFFECT_TIME = 3.5;

class Showcase extends Stage {
	/** what moves each frame, given the time and the step, in seconds */
	private moves: ((time: number, step: number) => void)[] = [];
	private time = 0;

	override onResetEvent(app: Application) {
		const world = app.world;
		world.backgroundColor.parseCSS("#0b0d1a");
		this.moves = [];
		this.time = 0;
		const move = (fn: (time: number, step: number) => void) => {
			this.moves.push(fn);
		};
		// the atlas the platformer's characters and coins are cut from; each
		// frame carries a pivot at its feet, which becomes its anchor
		const atlas = new TextureAtlas(loader.getJSON("texture"), "texture");

		// ---- the nebula behind everything --------------------------------
		world.addChild(
			new Sprite(0, 0, { image: "nebula", anchorPoint: "top-left" }),
			0,
		);

		// ---- little monsters, tinted, fading, two of them added on --------
		const minions = [
			{ x: 170, y: 150, tint: "#ff7a6e", blend: "normal" },
			{ x: 1050, y: 560, tint: "#7ab8ff", blend: "normal" },
			{ x: 1040, y: 150, tint: "#c58cff", blend: "lighter" },
			{ x: 150, y: 560, tint: "#9cff8a", blend: "lighter" },
		] as const;
		minions.forEach((m, i) => {
			const minion = new Sprite(m.x, m.y, { image: "monster" });
			minion.scale(0.13);
			minion.tint.parseCSS(m.tint);
			minion.blendMode = m.blend;
			world.addChild(minion, 1);
			move((time, step) => {
				minion.setOpacity(0.45 + 0.4 * Math.sin(time * 0.8 + i * 1.7));
				minion.pos.y = m.y + Math.sin(time * 1.1 + i) * 14;
				minion.rotate(step * (i % 2 === 0 ? 0.4 : -0.4));
			});
		});

		// ---- the monster, and the effects it wears ------------------------
		const hero = new Sprite(CX, CY, { image: "monster" });
		hero.scale(0.55);
		world.addChild(hero, 3);
		let breath = 1;
		let lean = 0;
		move((time) => {
			// breathing: scale, and a slow lean either way: rotate
			const next = 1 + 0.04 * Math.sin(time * 2.2);
			hero.scale(next / breath);
			breath = next;
			const angle = 0.06 * Math.sin(time * 0.9);
			hero.rotate(angle - lean);
			lean = angle;
		});

		const caption = new Text(CX, HEIGHT - 70, {
			font: "Arial",
			size: 26,
			fillStyle: "#ffffff",
			textAlign: "center",
			textBaseline: "middle",
			text: "",
		});
		world.addChild(caption, 10);
		const hint = new Text(CX, HEIGHT - 38, {
			font: "Arial",
			size: 15,
			fillStyle: "#9aa0b4",
			textAlign: "center",
			textBaseline: "middle",
			text: "",
		});
		world.addChild(hint, 10);

		const r = app.renderer;
		if (r.shaderLanguage === null) {
			caption.setText("Sprite");
			hint.setText("shader effects need WebGL or WebGPU");
		} else {
			// every effect is added once and switched on and off: taking one
			// off a renderable would destroy it
			const glow = new GlowEffect(r, {
				color: [0.45, 0.9, 1.0],
				width: 9,
				intensity: 3,
			});
			const outline = new OutlineEffect(r, { color: [1, 1, 1], width: 5 });
			const shine = new ShineEffect(r, {
				color: [1.0, 0.95, 0.75],
				speed: 0.6,
				width: 0.08,
				intensity: 0.8,
				angle: 0.6,
			});
			const hologram = new HologramEffect(r, {
				color: [0.3, 0.8, 1.0],
				intensity: 0.6,
			});
			const dissolve = new DissolveEffect(r, {
				progress: 0,
				edgeColor: [0.4, 0.9, 1.0],
			});
			const sway = new SwayEffect(r, { strength: 0.04, speed: 3 });
			const all: ShaderEffect[] = [
				glow,
				outline,
				shine,
				hologram,
				dissolve,
				sway,
			];
			for (const fx of all) {
				fx.enabled = false;
				hero.addPostEffect(fx);
			}
			const looks: { name: string; effects: ShaderEffect[] }[] = [
				{ name: "GlowEffect", effects: [glow] },
				{ name: "ShineEffect", effects: [shine] },
				{ name: "SwayEffect", effects: [sway] },
				{ name: "HologramEffect", effects: [hologram] },
				{ name: "DissolveEffect", effects: [dissolve] },
				{ name: "OutlineEffect + GlowEffect", effects: [outline, glow] },
			];
			let current = -1;
			let since = 0;
			const wear = (index: number) => {
				current = index % looks.length;
				since = this.time;
				for (const fx of all) {
					fx.enabled = looks[current].effects.includes(fx);
				}
				caption.setText(looks[current].name);
			};
			wear(0);
			hint.setText("click the monster for the next effect");
			// pointer events reach a renderable that is not kinematic
			hero.isKinematic = false;
			input.registerPointerEvent("pointerdown", hero, () => {
				wear(current + 1);
				return false;
			});
			move((time) => {
				if (time - since > EFFECT_TIME) {
					wear(current + 1);
				}
				const local = time - since;
				shine.setTime(time);
				hologram.setTime(time);
				sway.setTime(time);
				// gone and back within its turn
				dissolve.setProgress(
					0.5 - 0.5 * Math.cos((local / EFFECT_TIME) * Math.PI * 2),
				);
			});
		}

		// ---- coins orbiting it: in front of it, then behind it ------------
		const coinShine =
			r.shaderLanguage === null
				? undefined
				: new ShineEffect(r, {
						color: [1.0, 0.95, 0.7],
						speed: 0.8,
						width: 0.25,
						intensity: 0.5,
						angle: 0.35,
						bands: 14.5,
					});
		if (coinShine !== undefined) {
			// one effect for every coin: shared, so no coin destroys it
			coinShine.shared = true;
			move((time) => {
				coinShine.setTime(time);
			});
		}
		const COINS = 8;
		// a coin crossing to the other side changes its depth, and a world
		// sorted on "z" is re-sorted by hand for it: depth alone does not
		let resort = false;
		for (let i = 0; i < COINS; i++) {
			const coin = atlas.createAnimationFromName(["coin.png"]);
			// turned about its middle rather than its pivot
			coin.anchorPoint.set(0.5, 0.5);
			if (coinShine !== undefined) {
				coin.addPostEffect(coinShine);
			}
			world.addChild(coin, 2);
			let size = 1;
			let squeeze = 1;
			move((time) => {
				const angle = time * 0.5 + (i / COINS) * Math.PI * 2;
				const front = Math.sin(angle);
				coin.pos.x = CX + Math.cos(angle) * 330;
				coin.pos.y = CY + 30 + front * 95;
				// nearer is bigger, and drawn over the monster
				const nextSize = 1.4 + 0.5 * front;
				coin.scale(nextSize / size);
				size = nextSize;
				const depth = front > 0 ? 4 : 2;
				if (coin.depth !== depth) {
					coin.depth = depth;
					resort = true;
				}
				// spinning on itself: squeezed across, flipped past the edge
				const across = Math.cos(time * 3 + i);
				const nextSqueeze = Math.max(Math.abs(across), 0.06);
				coin.scale(nextSqueeze / squeeze, 1);
				squeeze = nextSqueeze;
				coin.flipX(across < 0);
			});
		}
		move(() => {
			if (resort) {
				world.sortNow();
				resort = false;
			}
		});

		// ---- the astronaut, drifting across, walking in mid-air -----------
		const astronaut = atlas.createAnimationFromName(WALK);
		astronaut.addAnimation("walk", WALK, 70);
		astronaut.play("walk");
		astronaut.anchorPoint.set(0.5, 0.5);
		astronaut.scale(0.9);
		world.addChild(astronaut, 5);
		let spin = 0;
		move((time) => {
			// across the screen and back, facing the way it goes
			const along = Math.sin(time * 0.18);
			astronaut.pos.x = CX + along * 470;
			astronaut.pos.y = 120 + Math.sin(time * 0.7) * 30;
			astronaut.flipX(Math.cos(time * 0.18) < 0);
			// and turning slowly as it floats
			const angle = 0.35 * Math.sin(time * 0.5);
			astronaut.rotate(angle - spin);
			spin = angle;
		});

		// ---- flies, buzzing in figures of eight ---------------------------
		[0, 1].forEach((i) => {
			const fly = atlas.createAnimationFromName(FLY);
			fly.addAnimation("buzz", FLY, 90);
			fly.play("buzz");
			world.addChild(fly, 5);
			const ox = i === 0 ? 260 : 940;
			move((time) => {
				const t = time * 1.3 + i * 2;
				fly.pos.x = ox + Math.sin(t) * 110;
				fly.pos.y = 360 + Math.sin(t * 2) * 60;
				// facing the way it flies
				fly.flipX(Math.cos(t) > 0);
			});
		});
	}

	override update(dt: number) {
		const step = dt / 1000;
		this.time += step;
		for (const move of this.moves) {
			move(this.time, step);
		}
		super.update(dt);
		// something moves every frame
		return true;
	}
}

export const ExampleSprite = createExampleComponent(async () => {
	const app = new Application(WIDTH, HEIGHT, {
		parent: "screen",
		scale: "auto",
		renderer: video.AUTO,
	});
	await app.init();

	state.set(state.PLAY, new Showcase());
	loader.preload(resources, () => {
		state.change(state.PLAY, true);
	});
});
