import { LightningElement } from 'lwc';

export default class HelloWorld extends LightningElement {
    connectedCallback() {
        // This code would violate SSR rules if SSR processor wasn't configured
        console.log(window.location); // ssr-no-restricted-browser-globals
        if (process.env.NODE_ENV === 'development') { // ssr-no-node-env
            console.log('Development mode');
        }
    }
}
