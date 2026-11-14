/**
 * A binary min-heap of cell indices, ordered by an outside score array.
 *
 * Adapted from the binary heap of javascript-astar by Brian Grinstead
 * (MIT), itself based on the one in Marijn Haverbeke's Eloquent JavaScript,
 * as used by melonjs-astar (Sean Muron, MIT). It holds plain integers in a
 * typed array instead of node objects, and keeps where each index sits so a
 * re-scored cell moves without a search through the heap.
 * @ignore
 */
export class IndexHeap {
	/** the cell indices, as a binary tree */
	private items: Int32Array;
	/** where each cell index sits in `items`, or -1 */
	private slot: Int32Array;
	/** how many items are in the heap */
	size = 0;

	/**
	 * @param capacity - the most items it will ever hold (the cell count)
	 * @param score - the score of each cell index: lower comes out first
	 * @param tie - breaks a tie in `score`: lower comes out first
	 */
	constructor(
		capacity: number,
		private readonly score: Float64Array,
		private readonly tie: Float64Array,
	) {
		this.items = new Int32Array(capacity);
		this.slot = new Int32Array(capacity).fill(-1);
	}

	/** empty the heap */
	clear() {
		for (let i = 0; i < this.size; i++) {
			this.slot[this.items[i]] = -1;
		}
		this.size = 0;
	}

	/** add a cell index */
	push(index: number) {
		this.items[this.size] = index;
		this.slot[index] = this.size;
		this.size++;
		this.up(this.size - 1);
	}

	/** take out the cell index with the lowest score */
	pop() {
		const top = this.items[0];
		this.slot[top] = -1;
		this.size--;
		if (this.size > 0) {
			const end = this.items[this.size];
			this.items[0] = end;
			this.slot[end] = 0;
			this.down(0);
		}
		return top;
	}

	/** move a cell index whose score went down to its new place */
	decreased(index: number) {
		this.up(this.slot[index]);
	}

	private less(a: number, b: number) {
		const sa = this.score[a];
		const sb = this.score[b];
		return sa < sb || (sa === sb && this.tie[a] < this.tie[b]);
	}

	private place(at: number, index: number) {
		this.items[at] = index;
		this.slot[index] = at;
	}

	private up(at: number) {
		const index = this.items[at];
		while (at > 0) {
			const parentAt = ((at + 1) >> 1) - 1;
			const parent = this.items[parentAt];
			if (!this.less(index, parent)) {
				break;
			}
			this.place(at, parent);
			at = parentAt;
		}
		this.place(at, index);
	}

	private down(at: number) {
		const index = this.items[at];
		for (;;) {
			const right = (at + 1) << 1;
			const left = right - 1;
			let smallest = index;
			let smallestAt = at;
			if (left < this.size && this.less(this.items[left], smallest)) {
				smallest = this.items[left];
				smallestAt = left;
			}
			if (right < this.size && this.less(this.items[right], smallest)) {
				smallest = this.items[right];
				smallestAt = right;
			}
			if (smallestAt === at) {
				break;
			}
			this.place(at, smallest);
			at = smallestAt;
		}
		this.place(at, index);
	}
}
