import { LightningElement, api, track, wire } from 'lwc';
import { getRecord } from 'lightning/uiRecordApi';

export default class LwcComponent extends LightningElement {
    @api recordId;
    @track internalState = 'initial';

    @wire(getRecord, { recordId: '$recordId', fields: ['Account.Name'] })
    wiredRecord;

    @api
    publicMethod() {
        return this.internalState;
    }

    handleClick() {
        this.internalState = 'clicked';
    }
}
