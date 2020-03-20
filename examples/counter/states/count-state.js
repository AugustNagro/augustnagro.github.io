import { repo } from '../../../state-repo.js';

export const COUNT_STATE = 'COUNT_STATE';

const writer = repo.writer(COUNT_STATE, 0);

export const countIncrement = () => writer.set(count => count + 1);