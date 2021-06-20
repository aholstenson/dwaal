import { Map as YMap } from 'yjs';

import { DMap } from './DMap';
import { DocHandle } from './DocHandle';

export class DMapImpl<V> implements DMap<V> {
	private handle: DocHandle;
	private ymap: YMap<V>;

	public constructor(handle: DocHandle) {
		this.handle = handle;
		this.ymap = handle.document.getMap('_');
	}

	public close(): Promise<void> {
		return this.handle.close();
	}

	public delete(key: string): void {
		this.ymap.delete(key);
	}

	public forEach(callbackfn: (value: V, key: string, map: DMap<V>) => void): void {
		this.ymap.forEach((value, key) => callbackfn(value, key, this));
	}

	public get(key: string): V | undefined {
		return this.ymap.get(key);
	}

	public has(key: string): boolean {
		return this.ymap.has(key);
	}

	public set(key: string, value: V): V {
		return this.ymap.set(key, value);
	}

	public get size(): number {
		return this.ymap.size;
	}

	public [Symbol.iterator](): IterableIterator<[ key: string, value: V ]> {
		return this.ymap.entries();
	}

	public entries(): IterableIterator<[ key: string, value: V ]> {
		return this.ymap.entries();
	}

	public keys(): IterableIterator<string> {
		return this.ymap.keys();
	}

	public values(): IterableIterator<V> {
		return this.ymap.values();
	}
}
