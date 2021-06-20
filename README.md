# Dwaal

Distributed persistent storage service designed to be used with an 
[Ataraxia](https://github.com/aholstenson/ataraxia) network.

* **Distributed**, can run on one or more nodes keeping data in sync
* Propagates changes using **CRDT** via [Yjs](https://github.com/yjs/yjs),
  allowing for:
  * Instant updates to the local data
  * Near-realtime updates to other nodes
  * Continues working even without majority of nodes being unreachable
* Provides a **persistent map** for easy key-value storage
* Ability to open a **Yjs document** to access all of its abilities
* Replicates only open maps and documents

## Usage

Install `dwaal` together with `ataraxia` and at least one transport:

```
$ npm install dwaal ataraxia ataraxia-tcp
```

Setup storage on top of an Ataraxia network:

```javascript
import { Storage } from 'dwaal';

import { Network, AnonymousAuth } from 'ataraxia';
import { TCPTransport, TCPPeerMDNSDiscovery } from 'ataraxia-tcp';

// Setup a network with anonymous TCP access - see Ataraxia for more examples
const net = new Network({
  name: 'dwaal-example',
  transports: [
    new TCPTransport({
      discovery: new TCPPeerMDNSDiscovery(),
      authentication: [ new AnonymousAuth() ]
    })
  ]
});
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

// Close the storage to shutdown gracefully
await storage.close();
```
