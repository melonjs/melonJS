/*
 * Tween.js - Licensed under the MIT license
 * https://github.com/tweenjs/tween.js
 */

const linear = (p0: number, p1: number, t: number) => {
	return (p1 - p0) * t + p0;
};

const factorialCache = [1];

const factorial = (n: number) => {
	if (factorialCache[n]) {
		return factorialCache[n];
	}
	let s = 1;
	for (let i = n; i > 1; i--) {
		s *= i;
	}
	factorialCache[n] = s;
	return s;
};

const bernstein = (n: number, i: number) => {
	return factorial(n) / factorial(i) / factorial(n - i);
};

const catmullRom = (
	p0: number,
	p1: number,
	p2: number,
	p3: number,
	t: number,
) => {
	const v0 = (p2 - p0) * 0.5;
	const v1 = (p3 - p1) * 0.5;
	const t2 = t * t;
	const t3 = t * t2;
	return (
		(2 * p1 - 2 * p2 + v0 + v1) * t3 +
		(-3 * p1 + 3 * p2 - 2 * v0 - v1) * t2 +
		v0 * t +
		p1
	);
};

export type InterpolationFunction = (v: number[], k: number) => number;

export const Interpolation = {
	Linear: (v: number[], k: number) => {
		const m = v.length - 1;
		const f = m * k;
		const i = Math.floor(f);

		if (k < 0) {
			return linear(v[0], v[1], f);
		}
		if (k > 1) {
			return linear(v[m], v[m - 1], m - f);
		}

		return linear(v[i], v[i + 1 > m ? m : i + 1], f - i);
	},
	Bezier: (v: number[], k: number) => {
		let b = 0;
		const n = v.length - 1;

		for (let i = 0; i <= n; i++) {
			b += Math.pow(1 - k, n - i) * Math.pow(k, i) * v[i] * bernstein(n, i);
		}

		return b;
	},
	CatmullRom: (v: number[], k: number) => {
		const m = v.length - 1;
		let f = m * k;
		let i = Math.floor(f);

		if (v[0] === v[m]) {
			if (k < 0) {
				i = Math.floor((f = m * (1 + k)));
			}

			return catmullRom(
				v[(i - 1 + m) % m],
				v[i],
				v[(i + 1) % m],
				v[(i + 2) % m],
				f - i,
			);
		} else {
			if (k < 0) {
				return v[0] - (catmullRom(v[0], v[0], v[1], v[1], -f) - v[0]);
			}
			if (k > 1) {
				return (
					v[m] - (catmullRom(v[m], v[m], v[m - 1], v[m - 1], f - m) - v[m])
				);
			}

			return catmullRom(
				v[i ? i - 1 : 0],
				v[i],
				v[m < i + 1 ? m : i + 1],
				v[m < i + 2 ? m : i + 2],
				f - i,
			);
		}
	},
};
