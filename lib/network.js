'use strict';

const { EventEmitter } = require('events');

const debug = require('debug')('dwaal:network');
const leader = require('unix-socket-leader');
const MsgpackSock = require('msgpack-sock');

module.exports = class Network extends EventEmitter {
	constructor(path) {
		super();

		this.path = path;
	}

	open() {
		return new Promise((resolve, reject) => {
			this.leader = leader(this.path);

			this.leader.on('connection', socket => {
				debug('Incoming connection from local process');
				const self = this;
				MsgpackSock.wrap(socket).on('message', function(msg) {
					self.emit('message', {
						returnPath: this,
						seq: msg[0],
						type: msg[1],
						payload: msg[2]
					});
				});
			});

			this.leader.on('client', socket => {
				debug('Connected to storage');
				this.socket = MsgpackSock.wrap(socket);

				const self = this;
				this.socket.on('message', function(msg) {
					self.emit('message', {
						returnPath: this,
						seq: msg[0],
						type: msg[1],
						payload: msg[2]
					});
				});

				resolve();
			});

			// Fallback, reject in a second
			setTimeout(reject, 1000);
		});
	}

	sendToLeader(seq, action, args) {
		this.socket.send([ seq, action, args ]);
	}

	close() {
		this.leader.close();
	}
};