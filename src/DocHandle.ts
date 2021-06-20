import { Doc } from 'yjs';

export interface DocHandle {
	readonly document: Doc;

	close(): Promise<void>;
}
