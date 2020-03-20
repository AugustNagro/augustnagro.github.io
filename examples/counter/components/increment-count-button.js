import { repo } from '../../../state-repo.js';
import { countIncrement } from '../states/count-state.js';

const template = document.createElement('template');
template.innerHTML = `
<button>Increment Count</button>
`;

class IncrementCountButton extends HTMLElement {
	constructor() {
		super();
		const s = this.attachShadow({ mode: 'open' });
		s.appendChild(template.content.cloneNode(true));

		s.querySelector('button').onclick = e => countIncrement();
	}
}

customElements.define('increment-count-button', IncrementCountButton);