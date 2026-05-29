/**
 * Shared object shapes for the AfterBurner showcase.
 *
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 */
import type { Mesh, Sprite } from "melonjs";

export interface BulletMover {
	sprite: Sprite;
	vx: number; // world units / second
	vy: number;
	vz: number;
}

export interface EnemyMover {
	mesh: Mesh;
	vx: number;
	vy: number;
	vz: number;
}
