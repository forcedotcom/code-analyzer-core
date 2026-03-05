// Simple TypeScript file without decorators for testing
// TypeScript parser doesn't need special decorator handling like Babel

class TypeScriptComponent {
    name: string = "TypeScript";

    constructor() {
        console.log("TypeScript component created");
    }

    getName(): string {
        return this.name;
    }
}

export default TypeScriptComponent;
