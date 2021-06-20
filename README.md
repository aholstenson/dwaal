# Dwaal

> **dwaal**. A dreamy, dazed, absent-minded, or befuddled state. [Wiktionary](https://en.wiktionary.org/wiki/dwaal)

Distributed persistent storage service designed to be used with an 
[Ataraxia](https://github.com/aholstenson/ataraxia) mesh network.

* **Distributed**, can run on one or more Ataraxia nodes
* Propagates changes using **CRDT** via [Yjs](https://github.com/yjs/yjs)
  * Instant updates to the local data
  * Near-realtime updates to other nodes
* Provides a **persistent map** for easy key-value storage
* Ability to open a **Yjs document** to access all of its abilities

## Usage

Install `dwaal` together with `ataraxia` and at least one transport:

```
$ npm install dwaal
```

Setup storage on top of an Ataraxia network:

```javascript
import { Storage } from 'dwaal';

// Setup and join a network
const net = ...
await net.join();

// Create a storage layer on the network
const storage = new Storage({
  network: net,
  path: 'data/directory/'
});

// Open a map
const map = await storage.openMap('name-of-map');

// Similar use as a normal map
map.set('key', 100);
const value = map.get('key');
```
