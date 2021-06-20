import { TestNetwork } from 'ataraxia/test';
import { dir } from 'tmp-promise';

import { Storage } from '../src/Storage';

const sleep = (len: number = 100) => {
	return new Promise(resolve => setTimeout(resolve, len));
};

const directory = async (): Promise<string> => {
	const { path, cleanup } = await dir({
		unsafeCleanup: true
	});
	cleanups.push(cleanup);
	return path;
};

const storage = async (name: string) => {
	const net = testNetwork.network(name);
	const instance = new Storage({
		network: net,
		path: await directory()
	});

	cleanups.push(() => instance.close());
	return instance;
};

let testNetwork: TestNetwork;
let cleanups: (() => Promise<any>)[];

describe('Storage', () => {
	beforeEach(() => {
		testNetwork = new TestNetwork();
		cleanups = [
			() => testNetwork.shutdown()
		];
	});

	afterEach(async () => {
		for(let i = cleanups.length - 1; i >= 0; i--) {
			await cleanups[i]();
		}
	});

	it('Re-open retains data', async () => {
		const f = await directory();
		const net = testNetwork.network('a');

		const a = new Storage({
			network: net,
			path: f
		});
		cleanups.push(() => a.close());

		const aDoc = await a.openDoc('test');
		const aMap = aDoc.document.getMap('root');

		aMap.set('value', 100);

		await sleep();

		await a.close();

		const b = new Storage({
			network: net,
			path: f
		});
		cleanups.push(() => b.close());

		const bDoc = await b.openDoc('test');
		const bMap = bDoc.document.getMap('root');

		expect(bMap.get('value')).toBe(100);
	});

	it('Update from A to B', async () => {
		testNetwork.bidirectional('a', 'b');

		const aStorage = await storage('a');
		const bStorage = await storage('b');

		const aDoc = await aStorage.openDoc('test');
		const bDoc = await bStorage.openDoc('test');

		const aMap = aDoc.document.getMap('root');
		const bMap = bDoc.document.getMap('root');

		await sleep();

		aMap.set('value', 100);

		await sleep();

		expect(bMap.get('value')).toBe(100);
	});

	it('Sync from A to B', async () => {
		testNetwork.bidirectional('a', 'b');

		const aStorage = await storage('a');
		const bStorage = await storage('b');

		await testNetwork.consolidate();

		const aDoc = await aStorage.openDoc('test');

		const aMap = aDoc.document.getMap('root');

		aMap.set('value', 200);

		await sleep();

		const bDoc = await bStorage.openDoc('test');

		await sleep();

		const bMap = bDoc.document.getMap('root');
		expect(bMap.get('value')).toBe(200);
	});

	it('Update from A to B, C', async () => {
		testNetwork
			.bidirectional('a', 'b')
			.bidirectional('a', 'c')
			.bidirectional('b', 'c');

		const aStorage = await storage('a');
		const bStorage = await storage('b');
		const cStorage = await storage('c');

		const aDoc = await aStorage.openDoc('test');
		const bDoc = await bStorage.openDoc('test');
		const cDoc = await cStorage.openDoc('test');

		const aMap = aDoc.document.getMap('root');
		const bMap = bDoc.document.getMap('root');
		const cMap = cDoc.document.getMap('root');

		await sleep();

		aMap.set('value', 100);

		await sleep();

		expect(bMap.get('value')).toBe(100);
		expect(cMap.get('value')).toBe(100);
	});

	it('A and B making own changes, sync after', async () => {
		const aStorage = await storage('a');
		const bStorage = await storage('b');

		await testNetwork.consolidate();

		const aDoc = await aStorage.openDoc('test');
		const aMap = aDoc.document.getMap('root');
		const bDoc = await bStorage.openDoc('test');
		const bMap = bDoc.document.getMap('root');

		aMap.set('a', 200);
		bMap.set('b', 'value');

		// Connect the peers
		testNetwork.bidirectional('a', 'b');

		await testNetwork.consolidate();

		await sleep();

		expect(aMap.get('a')).toBe(200);
		expect(aMap.get('b')).toBe('value');
		expect(bMap.get('a')).toBe(200);
		expect(bMap.get('b')).toBe('value');
	});

	it('5 peer mesh, 5000 random updates', async () => {
		testNetwork
			.bidirectional('a', 'b')
			.bidirectional('a', 'c')
			.bidirectional('b', 'd')
			.bidirectional('b', 'e');

		const storages = [
			await storage('a'),
			await storage('b'),
			await storage('c'),
			await storage('d'),
			await storage('e')
		];

		const docs = await Promise.all(storages.map(s => s.openDoc('test')));
		const maps = docs.map(doc => doc.document.getMap('root'));

		for(let i = 0; i < 5000; i++) {
			const map = maps[
				Math.floor(Math.random() * maps.length)
			];

			const key = Math.floor(Math.random() * 50);
			map.set('v' + key, Math.random());
		}

		await sleep(200);

		// Check that the keys match
		const keys = maps.map(map => [ ...map.keys() ].sort());
		for(let i = 1; i < keys.length; i++) {
			expect(keys[i]).toStrictEqual(keys[i - 1]);
		}

		// Check the values
		for(const key of keys[0]) {
			const value = maps[0].get(key);
			for(let i = 1; i < maps.length; i++) {
				expect(maps[i].get(key)).toBe(value);
			}
		}
	});

	it('4 peer mesh, 100 random updates, 5th peer joins post updates', async () => {
		testNetwork
			.bidirectional('a', 'b')
			.bidirectional('a', 'c')
			.bidirectional('b', 'd');

		const storages = [
			await storage('a'),
			await storage('b'),
			await storage('c'),
			await storage('d')
		];

		const docs = await Promise.all(storages.map(s => s.openDoc('test')));
		const maps = docs.map(doc => doc.document.getMap('root'));

		for(let i = 0; i < 100; i++) {
			const map = maps[
				Math.floor(Math.random() * maps.length)
			];

			const key = Math.floor(Math.random() * 10);
			map.set('v' + key, Math.random());
		}

		await sleep(200);

		testNetwork.bidirectional('b', 'e');

		const eStorage = await storage('e');
		const eDoc = await eStorage.openDoc('test');
		maps.push(eDoc.document.getMap('root'));

		await sleep(100);

		// Check that the keys match
		const keys = maps.map(map => [ ...map.keys() ].sort());
		for(let i = 1; i < keys.length; i++) {
			expect(keys[i]).toStrictEqual(keys[i - 1]);
		}

		// Check the values
		for(const key of keys[0]) {
			const value = maps[0].get(key);
			for(let i = 1; i < maps.length; i++) {
				expect(maps[i].get(key)).toBe(value);
			}
		}
	});

	it('4 peer mesh, 500 random updates, 5th peer joins during updates', async () => {
		testNetwork
			.bidirectional('a', 'b')
			.bidirectional('a', 'c')
			.bidirectional('b', 'd');

		const storages = [
			await storage('a'),
			await storage('b'),
			await storage('c'),
			await storage('d')
		];

		const docs = await Promise.all(storages.map(s => s.openDoc('test')));
		const maps = docs.map(doc => doc.document.getMap('root'));

		for(let i = 0; i < 500; i++) {
			const map = maps[
				Math.floor(Math.random() * maps.length)
			];

			const key = Math.floor(Math.random() * 10);
			map.set('v' + key, Math.random());

			if(i === 430) {
				testNetwork.bidirectional('b', 'e');

				const eStorage = await storage('e');
				const eDoc = await eStorage.openDoc('test');
				maps.push(eDoc.document.getMap('root'));
			}
		}

		await sleep(200);

		// Check that the keys match
		const keys = maps.map(map => [ ...map.keys() ].sort());
		for(let i = 1; i < keys.length; i++) {
			expect(keys[i]).toStrictEqual(keys[i - 1]);
		}

		// Check the values
		for(const key of keys[0]) {
			const value = maps[0].get(key);
			for(let i = 1; i < maps.length; i++) {
				expect(maps[i].get(key)).toBe(value);
			}
		}
	});
});
