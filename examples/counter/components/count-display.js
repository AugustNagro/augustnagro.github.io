import { repo } from '../../../state-repo.js';
import { COUNT_STATE } from '../states/count-state.js';

const template = document.createElement('template');
template.innerHTML = `
<p>Current Count is: <span></span></p>
`;

class CountDisplay extends HTMLElement {
	constructor() {
		super();
		const s = this.attachShadow({ mode: 'open' });
		s.appendChild(template.content.cloneNode(true));

		const span = s.querySelector('span');
		repo.reader(COUNT_STATE, count => span.innerText = count);
	}
}

customElements.define('count-display', CountDisplay);