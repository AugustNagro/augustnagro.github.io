import './count-display.js';
import './increment-count-button.js';

const template = document.createElement('template');
template.innerHTML = `
	<style>
		:host {
			width: 100vw;
			height: 100vh;
			display: flex;
			justify-content: space-evenly;
			align-items: center;
		}
	</style>
	<increment-count-button></increment-count-button>
	<count-display></count-display>
	<increment-count-button></increment-count-button>
`;

class CounterApp extends HTMLElement {
	constructor() {
		super();
		const s = this.attachShadow({ mode: 'open' });
		s.appendChild(template.content.cloneNode(true));
	}
}

customElements.define('counter-app', CounterApp);