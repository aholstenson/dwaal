import { Network } from 'ataraxia';
import { debug } from 'debug';
import { LeveldbPersistence } from 'y-leveldb';
import * as Y from 'yjs';

import { MessageTypes } from './messages/MessageTypes';
import { DocHandle } from './DocHandle';
import { DMap } from './DMap';

export interface StorageOptions {
	network: Network;

	path: string;
}

export class Storage {
	private readonly debug: debug.Debugger;

	private readonly net: Network;
	private readonly persistence: LeveldbPersistence;

	private readonly docs: Set<DocHandle>;

	public constructor(options: StorageOptions) {
		this.debug = debug('dwaal:' + options.network.networkName);

		this.persistence = new LeveldbPersistence(options.path);

		this.net = options.network;

		this.docs = new Set();
	}

	private logAndEmitError(name: string, err: Error) {
		this.debug(name, err);
	}

	public async openMap<V>(name: string): Promise<DMap<V>> {
		const handle = await this.openDoc(name);
		return new DMap(handle);
	}

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
					}).catch(err => this.logAndEmitError(
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
			}).catch(err => this.logAndEmitError(
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
			})().catch(err => this.logAndEmitError(
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
