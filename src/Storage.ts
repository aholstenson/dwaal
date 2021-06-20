import { Network } from 'ataraxia';
import { debug } from 'debug';
import { LeveldbPersistence } from 'y-leveldb';
import * as Y from 'yjs';

import { MessageTypes } from './messages/MessageTypes';
import { DocHandle } from './DocHandle';
import { DMapImpl } from './DMapImpl';
import { DMap } from './DMap';

/**
 * Options available for {@link Storage}.
 */
export interface StorageOptions {
	/**
	 * The network to use for finding and communicating with other nodes.
	 */
	network: Network;

	/**
	 * Path to directory where data will be stored.
	 */
	path: string;
}

/**
 * Distributed persistent storage on top of an Ataraxia network.
 *
 * ```javascript
 * import { Storage } from 'dwaal';
 *
 * // Create a storage layer on the network
 * const storage = new Storage({
 *   network: net,
 *   path: 'data/directory/'
 * });
 *
 * // Open a map
 * const map = await storage.openMap('name-of-map');
 *
 * // Similar use as a normal map
 * map.set('key', 100);
 * const value = map.get('key');
 * ```
 */
export class Storage {
	private readonly debug: debug.Debugger;

	private readonly net: Network;
	private readonly persistence: LeveldbPersistence;

	private readonly docs: Set<DocHandle>;

	/**
	 * Create a new instance on top of an existing network.
	 *
	 * @param options -
	 *   options for the storage
	 */
	public constructor(options: StorageOptions) {
		this.debug = debug('dwaal:' + options.network.networkName);

		this.persistence = new LeveldbPersistence(options.path);

		this.net = options.network;

		this.docs = new Set();
	}

	/**
	 * Log information about an error that has occurred.
	 *
	 * @param name -
	 *   message
	 * @param err -
	 *   error
	 */
	private logError(name: string, err: Error) {
		this.debug(name, err);
	}

	/**
	 * Open up a distributed map.
	 *
	 * @param name -
	 *   name of the map to open
	 * @returns
	 *   promise that resolves to the map
	 */
	public async openMap<V>(name: string): Promise<DMap<V>> {
		const handle = await this.openDoc(name);
		return new DMapImpl(handle);
	}

	/**
	 * Open up a Yjs document.
	 *
	 * @param name -
	 *   name of the document to open
	 * @returns
	 *   promise that resolves to the document, including support for closing
	 *   it
	 */
	public async openDoc(name: string): Promise<DocHandle> {
		const doc = await this.persistence.getYDoc(name);
		const exchange = this.net.createExchange<MessageTypes>('dwaal:' + name);

		exchange.onMessage(msg => {
			switch(msg.type) {
				case 'dwaal:stateVector':
				{
					if(msg.data.doc !== name) break;

					// State vector has been received, reply with update
					const update = Y.encodeStateAsUpdate(doc, new Uint8Array(msg.data.data));
					msg.source.send('dwaal:update', {
						doc: name,
						data: update.buffer
					}).catch(err => this.logError(
						'Could not send update for ' + name,
						err
					));

					break;
				}
				case 'dwaal:update':
					if(msg.data.doc !== name) break;

					this.debug('Received remote update from', msg.source);
					Y.applyUpdate(doc, new Uint8Array(msg.data.data), 'network');
					break;
			}
		});

		/*
		 * When a new node becomes available we send our state vector to it to
		 * allow it to send back updates to us.
		 */
		exchange.onNodeAvailable(node => {
			// When nodes join calculate a state vector and reply with it
			const stateVector = Y.encodeStateVector(doc);
			node.send('dwaal:stateVector', {
				doc: name,
				data: stateVector.buffer
			}).catch(err => this.logError(
				'Could not send state vector for ' + name,
				err
			));
		});

		/*
		 * Listen to update events so that they can be broadcast to other nodes
		 * letting them stay in sync in near-realtime.
		 */
		doc.on('update', (update: Uint8Array, origin: any) => {
			if(origin !== 'network') {
				this.debug('Performing local update');
			}

			(async () => {
				await this.persistence.storeUpdate(name, update);

				if(origin !== 'network') {
					// Broadcast to other nodes
					await exchange.broadcast('dwaal:update', {
						doc: name,
						data: update.buffer
					})
				}
			})().catch(err => this.logError(
				'Could not handle update for ' + name,
				err
			));
		});

		await exchange.join();

		const docs = this.docs;
		const handle = {
			document: doc,

			async close() {
				await exchange.leave();

				doc.destroy();

				docs.delete(handle);
			}
		};

		return handle;
	}

	/**
	 * Close the storage.
	 */
	public async close() {
		for(const doc of this.docs) {
			await doc.close();
		}

		await this.persistence.destroy();
	}
}
