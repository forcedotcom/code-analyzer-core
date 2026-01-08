import React, { useState, useEffect, useCallback, useMemo } from 'react';

// ============================================================================
// VIOLATIONS OF: react-hooks/rules-of-hooks
// Rule: Hooks must be called at the top level, not inside conditions/loops
// ============================================================================

function ComponentWithConditionalHook({ showCounter }) {
    // VIOLATION: Hook called inside a condition
    if (showCounter) {
        const [count, setCount] = useState(0);
    }

    return <div>Component</div>;
}

function ComponentWithLoopHook({ items }) {
    // VIOLATION: Hook called inside a loop
    for (let i = 0; i < items.length; i++) {
        const [itemState, setItemState] = useState(items[i]);
    }

    return <div>Component with loop</div>;
}

// VIOLATION: Hook called in a regular function (not a component or custom hook)
function regularFunction() {
    const [value, setValue] = useState('test');
    return value;
}

// ============================================================================
// VIOLATIONS OF: react-hooks/exhaustive-deps
// Rule: Dependencies array must include all values used inside the effect
// ============================================================================

function ComponentWithMissingDeps({ userId, config }) {
    const [userData, setUserData] = useState(null);
    const [count, setCount] = useState(0);

    // VIOLATION: 'userId' is used but not in dependencies
    useEffect(() => {
        fetch(`/api/users/${userId}`)
            .then(res => res.json())
            .then(data => setUserData(data));
    }, []); // Missing 'userId' in dependency array

    // VIOLATION: 'config' is used but not in dependencies
    useEffect(() => {
        console.log('Config changed:', config.theme);
        document.body.className = config.theme;
    }, []); // Missing 'config' or 'config.theme' in dependency array

    // VIOLATION: 'count' is used but not in dependencies
    const handleClick = useCallback(() => {
        console.log('Current count:', count);
        setCount(count + 1);
    }, []); // Missing 'count' in dependency array

    // VIOLATION: 'userData' is used but not in dependencies
    const processedData = useMemo(() => {
        if (!userData) return null;
        return {
            ...userData,
            displayName: userData.firstName + ' ' + userData.lastName
        };
    }, []); // Missing 'userData' in dependency array

    return (
        <div>
            <p>User: {processedData?.displayName}</p>
            <button onClick={handleClick}>Count: {count}</button>
        </div>
    );
}

export {
    ComponentWithConditionalHook,
    ComponentWithLoopHook,
    regularFunction,
    ComponentWithMissingDeps
};

