import React from 'react';

// This file intentionally has violations for testing
const ComponentWithViolations = () => {
    const unusedVariable = 'This variable is never used'; // no-unused-vars violation
    const name = 'Test';

    return (
        <div>
            <h1>Hello, {name}!</h1>
        </div>
    );
};

export default ComponentWithViolations;
