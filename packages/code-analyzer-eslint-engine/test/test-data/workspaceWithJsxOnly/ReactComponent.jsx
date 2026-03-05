import React, { useState } from 'react';

export default function ReactComponent({ name }) {
    const [count, setCount] = useState(0);

    return (
        <div>
            <h1>Hello {name}</h1>
            <p>Count: {count}</p>
            <button onClick={() => setCount(count + 1)}>
                Increment
            </button>
        </div>
    );
}
