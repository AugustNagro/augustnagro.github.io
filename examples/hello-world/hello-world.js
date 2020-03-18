import { repo } from '../../state-repo.js';

const template = document.createElement('template');
template.innerHTML = `
<div style="display: flex; flex-direction: column; align-items: center">
	<input placeholder="enter some text"/>
	<p>current value: <span id="currentVal"></span></p>
</div>
`;

class HelloWorld extends HTMLElement {
	constructor() {
		super();
		const s = this.attachShadow({ mode: "open"});
		s.appendChild(template.content.cloneNode(true));

		const writer = repo.writer('inputState');
		s.querySelector('input').oninput = e => writer.set(e.target.value);
		repo.reader('inputState', this.updateCurrentVal.bind(this));
	}

	updateCurrentVal(newVal) {
		this.shadowRoot.getElementById('currentVal').innerText = newVal;
	}
}

customElements.define('hello-world', HelloWorld);
