// Plain JavaScript utility file (no React)
export function formatDate(date) {
    return date.toISOString();
}

export function capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
}

