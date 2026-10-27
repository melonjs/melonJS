/**
 * melonJS — Isometric Dungeon example.
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 */
import {
	Camera2d,
	CanvasRenderTarget,
	math,
	type Renderer,
	type TMXLayer,
	type TMXRenderer,
	timer,
	Vector2d,
} from "melonjs";
import { PARTICLES, VIEW_W } from "../constants";
import type { Dungeon } from "../entities/dungeon";
import type { Hero } from "../entities/Hero";
import { Chest, Exit, Gate } from "../entities/usables";

// size on screen, top right
const W = 260;
const H = 150;
const MARGIN = 16;
// the map at a tenth of its size
const ZOOM = 0.1;
// how far around the hero the map is revealed, in cells
const SIGHT = 5;
// how far the walls rise above their cell, in pixels
const WALL_UP = 110;
// the colour of the map's background: unexplored parts look like nothing
const FOG = "#0b0a10";
// world pixels per pixel of fog
const FOG_SCALE = 8;

// the fog over the whole dungeon. A render target's texture stays on the GPU
// until the renderer goes (a new stage does not free it, and nothing public
// does), so there is one, cleared for every game
let fogTarget: CanvasRenderTarget | undefined;
function fogCanvas(width: number, height: number) {
	fogTarget ??= new CanvasRenderTarget(width, height, { transparent: true });
	fogTarget.resize(width, height);
	return fogTarget;
}

// A second camera, drawing the dungeon around the hero, small, in a corner
// of the screen. The play stage keeps the darkness off it, so the map is
// lit; a fog hides what the hero has not seen yet.
export class Minimap extends Camera2d {
	private readonly fog: CanvasRenderTarget;
	private readonly context: CanvasRenderingContext2D;
	private fogChanged = true;
	private readonly seen = new Set<number>();
	private heroCell = -1;
	// the floor layer's renderer, which turns cells into world pixels and
	// back, as when it draws the layer
	private readonly grid: TMXRenderer;
	private readonly cols: number;
	private readonly rows: number;
	// the whole map, in world pixels
	private readonly area: {
		left: number;
		top: number;
		width: number;
		height: number;
	};
	private readonly point = new Vector2d();

	constructor(
		private readonly hero: Hero,
		private readonly dungeon: Dungeon,
		floor: TMXLayer,
	) {
		super(0, 0, W, H);
		this.name = "minimap";
		this.screenX = VIEW_W - W - MARGIN;
		this.screenY = MARGIN;
		this.autoResize = false;
		this.zoom = ZOOM;
		// every layer but the particles': at this size they are only noise
		this.cullMask = ~PARTICLES;

		this.grid = floor.getRenderer();
		this.cols = floor.cols;
		this.rows = floor.rows;
		// the map's bounds, as level.load gave the main camera
		const { left, top, width, height } = floor.getBounds();
		this.area = { left, top, width, height };

		this.fog = fogCanvas(
			Math.ceil(width / FOG_SCALE),
			Math.ceil(height / FOG_SCALE),
		);
		this.context = this.fog.context as CanvasRenderingContext2D;
		this.context.globalCompositeOperation = "copy";
		this.context.fillStyle = FOG;
		this.context.fillRect(0, 0, this.fog.width, this.fog.height);

		// last: these update the camera, which reveals around the hero
		this.setBounds(left, top, width, height);
		this.setDeadzone(0, 0);
		this.follow(hero.focus, this.AXIS.BOTH);
	}

	override update(dt: number) {
		// the cell under the hero's feet
		const at = this.grid.pixelToTileCoords(
			this.hero.feetX,
			this.hero.feetY,
			this.point,
		);
		const c = Math.floor(at.x);
		const r = Math.floor(at.y);
		const cell = r * this.cols + c;
		if (cell !== this.heroCell) {
			this.heroCell = cell;
			this.reveal(c, r);
		}
		super.update(dt);
		// redrawn every frame, for the hero and the markers
		return true;
	}

	// clear the fog off every cell around (c, r)
	private reveal(c: number, r: number) {
		const context = this.context;
		context.globalCompositeOperation = "destination-out";
		context.fillStyle = "#000";
		for (let dr = -SIGHT; dr <= SIGHT; dr++) {
			for (let dc = -SIGHT; dc <= SIGHT; dc++) {
				const cc = c + dc;
				const rr = r + dr;
				const key = rr * this.cols + cc;
				if (
					dc * dc + dr * dr > SIGHT * SIGHT ||
					cc < 0 ||
					rr < 0 ||
					cc >= this.cols ||
					rr >= this.rows ||
					this.seen.has(key)
				) {
					continue;
				}
				this.seen.add(key);
				// the cell's diamond, and the walls standing on it
				context.beginPath();
				this.fogPoint(cc, rr + 1, 0, true);
				this.fogPoint(cc + 1, rr + 1);
				this.fogPoint(cc + 1, rr);
				this.fogPoint(cc + 1, rr, WALL_UP);
				this.fogPoint(cc, rr, WALL_UP);
				this.fogPoint(cc, rr + 1, WALL_UP);
				context.closePath();
				context.fill();
				this.fogChanged = true;
			}
		}
	}

	// a cell corner, `up` pixels above the floor, on the fog canvas
	private fogPoint(c: number, r: number, up = 0, first = false) {
		const p = this.grid.tileToPixelCoords(c, r, this.point);
		const fx = (p.x - this.area.left) / FOG_SCALE;
		const fy = (p.y - up - this.area.top) / FOG_SCALE;
		if (first) {
			this.context.moveTo(fx, fy);
		} else {
			this.context.lineTo(fx, fy);
		}
	}

	override postDraw(renderer: Renderer) {
		// still in the minimap's projection: one unit is one world pixel, from
		// its top left corner
		const px = 1 / ZOOM;
		const ox = this.pos.x;
		const oy = this.pos.y;
		if (this.fogChanged) {
			this.fog.invalidate(renderer);
			this.fogChanged = false;
		}
		renderer.drawImage(
			this.fog.canvas,
			0,
			0,
			this.fog.width,
			this.fog.height,
			this.area.left - ox,
			this.area.top - oy,
			this.area.width,
			this.area.height,
		);

		// the chests still closed, seen or not: they are what the hero is
		// after. Those out of view sit on the edge, in their direction
		const pulse = 1 + 0.25 * Math.sin(timer.getTime() / 180);
		renderer.setColor("#ffcf4a");
		for (const usable of this.dungeon.usables) {
			if (usable instanceof Chest && !usable.used) {
				this.marker(
					renderer,
					usable.spot.x - ox,
					usable.spot.y - oy,
					3 * px * pulse,
				);
			}
		}
		// and the way out, once the gate is open
		if (this.dungeon.usables.some((u) => u instanceof Gate && u.used)) {
			const exit = this.dungeon.usables.find((u) => u instanceof Exit);
			if (exit) {
				renderer.setColor("#7dff9a");
				this.marker(renderer, exit.spot.x - ox, exit.spot.y - oy, 4 * px);
			}
		}
		// the hero
		const hx = this.hero.feetX - ox;
		const hy = this.hero.feetY - oy;
		renderer.setColor("#1a120a");
		renderer.fillEllipse(hx, hy, 4 * px, 4 * px);
		renderer.setColor("#ffffff");
		renderer.fillEllipse(hx, hy, 2.5 * px, 2.5 * px);

		// frame
		renderer.setColor("#c9a86a");
		renderer.lineWidth = 2 * px;
		renderer.strokeRect(0, 0, W * px, H * px);
		renderer.lineWidth = 1;

		super.postDraw(renderer);
	}

	// a dot at (x, y), or on the edge of the minimap when it is out of view
	private marker(renderer: Renderer, x: number, y: number, radius: number) {
		const inset = 5 / ZOOM;
		const cx = math.clamp(x, inset, W / ZOOM - inset);
		const cy = math.clamp(y, inset, H / ZOOM - inset);
		const r = cx === x && cy === y ? radius : radius * 0.7;
		renderer.fillEllipse(cx, cy, r, r);
	}
}
