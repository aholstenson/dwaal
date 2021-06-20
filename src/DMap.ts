
/**
 * Map that is distributed between nodes.
 */
export interface DMap<V> {
	/**
	 * Close this map. The map will stop receiving and propagating updates.
	 */
	close(): Promise<void>;

	/**
	 * Delete a key from the map.
	 *
	 * @param key -
	 *   key to delete
	 */
	delete(key: string): void;

	/**
	 * Iterate over all entries in this map.
	 *
	 * @param callbackfn -
	 *   callback
	 */
	forEach(callbackfn: (value: V, key: string, map: DMap<V>) => void): void;

	/**
	 * Get the value associated with the given key.
	 *
	 * @param key -
	 *   key to get value for
	 * @returns
	 *   value if key is available, or `undefined` if key does not have a value
	 */
	get(key: string): V | undefined;

	/**
	 * Get if a certain key has a value available in the map.
	 *
	 * @param key -
	 *   key to check
	 */
	has(key: string): boolean;

	/**
	 * Set the value associated with a key.
	 *
	 * @param key -
	 *   key to set
	 * @param value -
	 *   value to associate with the key
	 * @returns
	 *   previous value associated with key
	 */
	set(key: string, value: V): V;

	/**
	 * Get the number of entries in this map.
	 */
	readonly size: number;

	/**
	 * Get an iterator that iterates over all entries in the map.
	 */
	[Symbol.iterator](): IterableIterator<[ key: string, value: V ]>;

	/**
	 * Get an iterator that iterates over all entries in the map.
	 */
	entries(): IterableIterator<[ key: string, value: V ]>;

	/**
	 * Get an iterator that iterates over all keys in the map.
	 */
	keys(): IterableIterator<string>;

	/**
	 * Get an iterator that iterates over all values in the map.
	 */
	values(): IterableIterator<V>;
}
