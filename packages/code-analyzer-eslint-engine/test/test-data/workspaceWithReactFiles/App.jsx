import React from 'react';
import Button from './Button';

function App() {
    const handleClick = () => {
        console.log('Button clicked!');
    };

    return (
        <div className="app">
            <h1>React App</h1>
            <Button label="Click me" onClick={handleClick} />
        </div>
    );
}

export default App;

