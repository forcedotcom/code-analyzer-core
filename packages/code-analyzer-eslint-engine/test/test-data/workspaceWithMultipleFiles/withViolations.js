import { LightningElement, api, track } from 'lwc';

export default class WithViolations extends LightningElement {
    @api unusedProp;
    @track internalState;

    connectedCallback() {
        debugger; // ESLint violation: no-debugger
        var oldStyleVar = 'test'; // ESLint violation: no-var
        unusedVariable = 123; // ESLint violation: no-unused-vars
    }
}
