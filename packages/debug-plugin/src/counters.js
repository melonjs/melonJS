export default class Counters extends Map {
	constructor(keys) {
		super(
			keys?.map((key) => {
				return [key, 0];
			}),
		);
	}

	reset() {
		for (const key of this.keys()) {
			this.set(key, 0);
		}
	}

	inc(stat, value = 1) {
		this.set(stat, (this.get(stat) ?? 0) + value);
	}
}
