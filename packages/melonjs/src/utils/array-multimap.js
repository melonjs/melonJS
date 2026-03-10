/**
 * A simple multimap that stores multiple values per key using arrays.
 * @ignore
 */
class ArrayMultimap {
	constructor() {
		this._map = new Map();
	}
	put(key, value) {
		const arr = this._map.get(key);
		if (arr) {
			arr.push(value);
		} else {
			this._map.set(key, [value]);
		}
	}
	get(key) {
		return this._map.get(key) || [];
	}
	has(key) {
		return this._map.has(key);
	}
	delete(key) {
		this._map.delete(key);
	}
	forEach(callback) {
		this._map.forEach((values, key) => {
			for (const value of values) {
				callback(value, key);
			}
		});
	}
	clear() {
		this._map.clear();
	}
}

export { ArrayMultimap };
