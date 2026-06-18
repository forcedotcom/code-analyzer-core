import { LightningElement } from 'lwc';

export default class HelloWorld extends LightningElement {
    connectedCallback() {
        // This code violates SSR rules and should be flagged because the
        // -meta.xml declares lightning__ServerRenderable capability
        console.log(window.location); // ssr-no-restricted-browser-globals
        if (process.env.NODE_ENV === 'development') { // ssr-no-node-env
            console.log('Development mode');
        }
    }
}
