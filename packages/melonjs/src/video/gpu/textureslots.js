/**
 * Backend-neutral texture slot assignment.
 *
 * Both GPU backends solve the same problem — "many textures, one draw call" —
 * by giving each texture a small integer slot that the fragment shader selects
 * on per-vertex. Only the *resource* differs: a WebGL texture unit, or an entry
 * in a WebGPU material bind group. The assignment policy (who gets a slot, what
 * happens when they run out, what is dropped) is identical, and used to be
 * written twice — `TextureCache.allocateTextureUnit` on one side,
 * `WebGPUQuadBatcher.segmentSlotFor` on the other — which is how the two drifted.
 *
 * This class owns that policy and nothing else. It never touches a GL unit or a
 * bind group; the caller supplies the binding through the callbacks. That keeps
 * it pure, so the same test suite proves both backends behave alike.
 * @ignore
 */
export class TextureSlotTable {
	/**
	 * @param {object} options - table configuration
	 * @param {number} options.capacity - number of slots, `[0, capacity)`
	 * @param {Function} [options.onOverflow] - called when a new key arrives with
	 * no slot free. The caller must turn the pending work into GPU work (flush)
	 * before the table reassigns slots out from under it.
	 * @param {Function} [options.onEvict] - called with each slot index as it is
	 * dropped, so the caller can forget its binding for that slot
	 * @param {Function} [options.isReserved] - optional predicate; a slot it
	 * approves is held out of assignment entirely (WebGL parks `ShaderEffect`
	 * extra samplers on high units this way). Reservations survive a reset.
	 * @ignore
	 */
	constructor({ capacity, onOverflow, onEvict, isReserved } = {}) {
		/** @type {Map<string, number>} key → slot */
		this.slots = new Map();
		/** @type {Set<number>} occupied slot indices */
		this.used = new Set();
		this.capacity = capacity ?? 0;
		this.onOverflow = onOverflow;
		this.onEvict = onEvict;
		this.isReserved = isReserved;
	}

	/**
	 * How many slots are currently taken.
	 *
	 * Occupancy, NOT the key map: slots claimed through {@link claim} carry no
	 * key at all (the WebGL cache allocates that way), so counting keys would
	 * report an empty table while every unit was in use.
	 * @returns {number} the number of occupied slots
	 * @ignore
	 */
	get size() {
		return this.used.size;
	}

	/**
	 * Resize the table. Shrinking evicts every assignment at or above the new
	 * capacity; growing keeps everything. Called on context restore / device
	 * change, where the resolved limit can differ from the previous one.
	 * @param {number} capacity - the new slot count
	 * @ignore
	 */
	setCapacity(capacity) {
		this.capacity = capacity;
		for (const [key, slot] of this.slots) {
			if (slot >= capacity) {
				this.slots.delete(key);
			}
		}
		// occupancy is the authority, not the key map: slots taken through
		// `claim()` have no key at all (the WebGL cache allocates that way), so
		// iterating `slots` alone would leave them marked used above the new
		// capacity and every later allocation would spuriously overflow
		for (const slot of [...this.used]) {
			if (slot >= capacity) {
				this.used.delete(slot);
				this.onEvict?.(slot);
			}
		}
	}

	/**
	 * The slot this key already holds, without assigning one. Use when a miss
	 * should not trigger an overflow (probing, debug, bookkeeping).
	 * @param {string} key - the slot key
	 * @returns {number|undefined} the assigned slot, or `undefined`
	 * @ignore
	 */
	peek(key) {
		return this.slots.get(key);
	}

	/**
	 * The lowest assignable slot, or `-1` when every one is taken or reserved.
	 * Bounded by `capacity` on purpose: a caller that reserves every slot must
	 * get an answer rather than an infinite scan.
	 * @returns {number} a free slot index, or -1
	 * @ignore
	 */
	freeSlot() {
		for (let slot = 0; slot < this.capacity; slot++) {
			if (!this.used.has(slot) && this.isReserved?.(slot) !== true) {
				return slot;
			}
		}
		return -1;
	}

	/**
	 * Resolve a key to its slot, assigning one if needed.
	 *
	 * On exhaustion this calls `onOverflow` (the caller flushes) and then drops
	 * every assignment, so the incoming key starts a fresh set — the behaviour
	 * both backends already had. The eviction step is deliberately the only
	 * policy here: replacing this wipe with something finer (see #1586) changes
	 * both backends at once, which is the point of sharing it.
	 * @param {string} key - identifies the texture *and* the sampling state it
	 * needs, since two draws of one image under different filter/wrap settings
	 * cannot share a slot
	 * @returns {number} the slot to write into the vertex stream
	 * @ignore
	 */
	slotFor(key) {
		const existing = this.slots.get(key);
		if (existing !== undefined) {
			return existing;
		}
		const slot = this.claim();
		this.slots.set(key, slot);
		return slot;
	}

	/**
	 * Take a slot without associating a key with it.
	 *
	 * The WebGL cache resolves textures to units through its own source-keyed
	 * index (a source can hold one unit per wrap mode it was sampled with), so
	 * it needs the *policy* — free-slot search honoring reservations, and the
	 * flush-then-evict behaviour on exhaustion — without the key map. WebGPU's
	 * batcher keys directly and goes through {@link slotFor}, which is this plus
	 * the mapping. Both therefore overflow on the same rule.
	 * @returns {number} the claimed slot
	 * @ignore
	 */
	claim() {
		let slot = this.freeSlot();
		if (slot < 0) {
			// full: let the caller draw what is pending BEFORE anything is
			// reassigned, or those vertices would sample the wrong texture
			this.onOverflow?.();
			this.reset();
			slot = this.freeSlot();
			if (slot < 0) {
				// every slot is reserved (or capacity is 0) — there is no
				// correct answer, and silently returning 0 would alias onto a
				// reserved texture
				throw new Error(
					`TextureSlotTable: no assignable slot (capacity ${this.capacity}, all reserved)`,
				);
			}
		}
		this.used.add(slot);
		return slot;
	}

	/**
	 * Drop a single assignment, freeing its slot. Reservations are untouched —
	 * they are owned by whoever reserved them, not by the table.
	 * @param {string} key - the slot key to release
	 * @returns {boolean} whether the key held a slot
	 * @ignore
	 */
	release(key) {
		const slot = this.slots.get(key);
		if (slot === undefined) {
			return false;
		}
		this.slots.delete(key);
		this.used.delete(slot);
		this.onEvict?.(slot);
		return true;
	}

	/**
	 * Drop every assignment. `onEvict` fires once per slot that was live, so a
	 * caller tracking bindings per slot can forget exactly those.
	 * @ignore
	 */
	reset() {
		if (this.onEvict !== undefined) {
			for (const slot of this.used) {
				this.onEvict(slot);
			}
		}
		this.slots.clear();
		this.used.clear();
	}
}
