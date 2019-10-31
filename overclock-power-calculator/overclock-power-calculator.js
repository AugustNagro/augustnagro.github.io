const template = document.createElement('template');
template.innerHTML = `
<h2>test 342</h2>
`;

class OverclockPowerCalculator extends HTMLElement {
	constructor() {
		super();
		const s = this.attachShadow({mode: 'open'});
		s.appendChild(template.content.cloneNode(true));
	}
}

customElements.define('overclock-power-calculator', OverclockPowerCalculator);
