// TypeScript component with decorators - for testing ESLint parsing
// @ts-nocheck
function Component(target: any) {
    return target;
}

function Property(target: any, propertyKey: string) {
    // Property decorator
}

@Component
class MyComponent {
    @Property
    public name: string;

    constructor() {
        this.name = "Test Component";
    }

    public greet(): string {
        return `Hello from ${this.name}`;
    }
}

export default MyComponent;
