export function indent(value: string, indentation = '    '): string {
    return indentation + value.replaceAll('\n', `\n${indentation}`);
}