// A LightningElement-class file with a decorator misuse that the
// LWC compiler rejects with an LWC1xxx diagnostic.
import { LightningElement, api } from 'lwc';

export default class Bad extends LightningElement {
    @api @api duplicateApiOnSameField;
}
