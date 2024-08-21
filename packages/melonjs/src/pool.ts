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
import { particlePool } from "./particles/particle";
import { boundsPool } from "./physics/bounds";
import { tweenPool } from "./tweens/tween";
import { bitmapTextDataPool } from "./renderable/text/bitmaptextdata";

const pools = {
	vector2d: vector2dPool,
	vector3d: vector3dPool,
	point: pointPool,
	matrix2d: matrix2dPool,
	matrix3d: matrix3dPool,
	bounds: boundsPool,
	color: colorPool,
	polygon: polygonPool,
	line: linePool,
	rectangle: rectPool,
	roundedRectangle: roundedRectanglePool,
	ellipse: ellipsePool,
	tween: tweenPool,
	particle: particlePool,
	bitmapTextData: bitmapTextDataPool,
} as const;

type PoolKey = keyof typeof pools;

export const getPool = <K extends PoolKey>(key: K): (typeof pools)[K] => {
	return pools[key];
};

export const getTotalPoolSize = (): number => {
	let totalSize = 0;
	for (const key in pools) {
		totalSize += pools[key as PoolKey].size();
	}
	return totalSize;
};

export { createPool } from "./system/pool";
