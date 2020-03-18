import { USER_STATE } from './states.js';
import { repo } from '../../state-repo.js';

const template = document.createElement('template');
template.innerHTML = `
	<p>User Name: <span id=userName></span></p>
`;

class ReaderComponent extends HTMLElement {
	constructor() {
		super();
		const s = this.attachShadow({ mode: 'open' });
		s.appendChild(template.content.cloneNode(true));

		repo.reader(USER_STATE, this.updateUserName.bind(this));
	}

	updateUserName(user) {
		this.shadowRoot.getElementById('userName').innerText = user.name;
	}
}

customElements.define('reader-component', ReaderComponent);
