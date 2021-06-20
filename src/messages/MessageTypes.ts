import { StateVectorMessage } from './StateVectorMessage';
import { UpdateMessage } from './UpdateMessage';

export interface MessageTypes {
	'dwaal:stateVector': StateVectorMessage;
	'dwaal:update': UpdateMessage;
}
