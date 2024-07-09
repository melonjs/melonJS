class Counters {
	constructor() {
		this.stats = [];
	}
	reset() {
		for (const key of Object.keys(this.stats)) {
			this.stats[key] = 0;
		}
	}
	inc(stat, value) {
		this.stats[stat] += value || 1;
	}
	get(stat) {
		return this.stats[stat] || 0;
	}
}

export default Counters;
