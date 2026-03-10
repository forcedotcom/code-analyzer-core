import { LightningElement, api } from 'lwc';

export default class MixedLwc extends LightningElement {
    @api title;

    connectedCallback() {
        console.log('LWC component connected');
    }
}
