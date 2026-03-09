import { LightningElement, api } from 'lwc';

// This file intentionally has LWC violations for testing
export default class LwcComponentWithViolations extends LightningElement {
    @api recordId;

    connectedCallback() {
        // Violation: Reassigning @api property (no-api-reassignments)
        this.recordId = 'newValue';
    }
}
