function containsBadType() {
    const s: String = "string should be used instead of String";
}

function containsBadRegExp() {
    const r: RegExp = new RegExp("[");
}