import { Doc } from 'yjs';

/**
 * Handle to a Yjs document.
 */
export interface DocHandle {
	/**
	 * Yjs document.
	 */
	readonly document: Doc;

	/**
	 * Close the document, will stop receiving and sending of updates.
	 */
	close(): Promise<void>;
}
