import { LightningElement } from 'lwc';

export default class LwcProbe extends LightningElement {
    connectedCallback() {
        var total = 0;
        this.total = total;
        this.node = document.querySelector('.slds-is-selected');
    }
}
