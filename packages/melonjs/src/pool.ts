import { ellipsePool } from "./geometries/ellipse";
import { linePool } from "./geometries/line";
import { pointPool } from "./geometries/point";
import { polygonPool } from "./geometries/polygon";
import { rectPool } from "./geometries/rectangle";
import { roundedRectanglePool } from "./geometries/roundrect";
import { colorPool } from "./math/color";
import { matrix2dPool } from "./math/matrix2d";
import { matrix3dPool } from "./math/matrix3d";
import { vector2dPool } from "./math/vector2d";
import { vector3dPool } from "./math/vector3d";
import type ParticleEmitter from "./particles/emitter";
import type Particle from "./particles/particle";
import { boundsPool } from "./physics/bounds";
import { bitmapTextDataPool } from "./renderable/text/bitmaptextdata";
import type { Pool } from "./system/pool";
import { getRegisteredPools, registerPool } from "./system/pool";
import { tweenPool } from "./tweens/tween";

// Register all pools that don't have circular dependency issues
registerPool("vector2d", vector2dPool);
registerPool("vector3d", vector3dPool);
registerPool("point", pointPool);
registerPool("matrix2d", matrix2dPool);
registerPool("matrix3d", matrix3dPool);
registerPool("bounds", boundsPool);
registerPool("color", colorPool);
registerPool("polygon", polygonPool);
registerPool("line", linePool);
registerPool("rectangle", rectPool);
registerPool("roundedRectangle", roundedRectanglePool);
registerPool("ellipse", ellipsePool);
registerPool("tween", tweenPool);
registerPool("bitmapTextData", bitmapTextDataPool);
// Note: particlePool registers itself in particles/particle.ts to avoid circular dependencies

// Type map derived from actual pool instances for type-safe getPool()
// particlePool uses import() type to avoid circular runtime dependency
interface PoolMap {
	vector2d: typeof vector2dPool;
	vector3d: typeof vector3dPool;
	point: typeof pointPool;
	matrix2d: typeof matrix2dPool;
	matrix3d: typeof matrix3dPool;
	bounds: typeof boundsPool;
	color: typeof colorPool;
	polygon: typeof polygonPool;
	line: typeof linePool;
	rectangle: typeof rectPool;
	roundedRectangle: typeof roundedRectanglePool;
	ellipse: typeof ellipsePool;
	tween: typeof tweenPool;
	particle: Pool<Particle, [emitter: ParticleEmitter]>;
	bitmapTextData: typeof bitmapTextDataPool;
}

type PoolKey = keyof PoolMap;

export const getPool = <K extends PoolKey>(key: K): PoolMap[K] => {
	return getRegisteredPools()[key] as PoolMap[K];
};

export const getTotalPoolSize = (): number => {
	const pools = getRegisteredPools();
	let totalSize = 0;
	for (const key in pools) {
		totalSize += pools[key].size();
	}
	return totalSize;
};

export { createPool, registerPool } from "./system/pool";
