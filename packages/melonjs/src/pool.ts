import { pointPool } from "./geometries/point";
import { colorPool } from "./math/color";
import { matrix2dPool } from "./math/matrix2d";
import { matrix3dPool } from "./math/matrix3d";
import { vector2dPool } from "./math/vector2d";
import { vector3dPool } from "./math/vector3d";
import { boundsPool } from "./physics/bounds";

const pools = {
	vector2d: vector2dPool,
	vector3d: vector3dPool,
	point: pointPool,
	matrix2d: matrix2dPool,
	matrix3d: matrix3dPool,
	bounds: boundsPool,
	color: colorPool,
} as const;

type PoolKey = keyof typeof pools;

export const getPool = <K extends PoolKey>(key: K): (typeof pools)[K] => {
	return pools[key];
};
