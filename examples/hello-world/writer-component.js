import { USER_STATE } from './states.js';
import { repo } from '../../state-repo.js';

const template = document.createElement('template');
template.innerHTML = `
	<input placeholder="change user name"/>
`;

class WriterComponent extends HTMLElement {
	constructor() {
		super();
		const s = this.attachShadow({ mode: "open"});
		s.appendChild(template.content.cloneNode(true));

		const writer = repo.writer(USER_STATE, { name: 'John' });

		s.querySelector('input').oninput = e => writer.set(user => {
			user.name = e.target.value;
			return user;
		});
	}
}

customElements.define('writer-component', WriterComponent);

