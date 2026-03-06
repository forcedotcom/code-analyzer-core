import { LightningElement } from 'lwc';

export default class InvalidDecorator extends LightningElement {
    // This will cause a parsing error if Espree is used (doesn't support decorators)
    @invalidDecorator
    someProperty;
}
