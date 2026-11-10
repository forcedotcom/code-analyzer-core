import { CodeLocation } from '@salesforce/code-analyzer-engine-api';
import { CollectedFlowFile, FlowAnalyzerFinding } from '../types';

export type MappedLocation = CodeLocation & {
    usedFileLevelAnchor: boolean;
};

type FlowElementDefinition = {
    tag: string;
    name?: string;
    nameOffset: number;
    childOffsets: Map<string, number>;
};

export class FindingLocationMapper {
    map(finding: FlowAnalyzerFinding, collectedFile: CollectedFlowFile): MappedLocation {
        const match = this.findElement(collectedFile.content, finding.elementApiName, finding.elementType, finding.affectedField);
        if (!match) {
            return {
                file: collectedFile.absolutePath,
                startLine: 1,
                startColumn: 1,
                comment: this.fileLevelComment(finding),
                usedFileLevelAnchor: true
            };
        }
        return {
            file: collectedFile.absolutePath,
            startLine: match.line,
            startColumn: match.column,
            comment: finding.elementType ? `${finding.elementType} ${finding.elementApiName}` : finding.elementApiName,
            usedFileLevelAnchor: false
        };
    }

    private findElement(xml: string, elementApiName: string, elementType?: string, affectedField?: string): { line: number; column: number } | undefined {
        if (!elementApiName) {
            return undefined;
        }
        const wanted: string = elementApiName.toLowerCase();
        const candidates: FlowElementDefinition[] = this.scanTopLevelElements(xml)
            .filter(element => element.name?.toLowerCase() === wanted);
        // Element names are unique within a Flow, so the type is only a tie-breaker
        const element: FlowElementDefinition | undefined =
            candidates.find(c => elementType && c.tag.toLowerCase() === elementType.toLowerCase()) ?? candidates[0];
        if (!element) {
            return undefined;
        }
        const offset: number = (affectedField ? element.childOffsets.get(affectedField.toLowerCase()) : undefined)
            ?? element.nameOffset;
        return this.offsetToLineColumn(xml, offset);
    }

    /**
     * Finds the definition of each element (direct children of the root, like <recordLookups>) along with the
     * offset of its own <name> child. References to an element (e.g. <targetReference>) are never <name> children
     * of a top-level element, so they can't be mistaken for the definition.
     */
    private scanTopLevelElements(xml: string): FlowElementDefinition[] {
        const elements: FlowElementDefinition[] = [];
        const stack: string[] = [];
        let current: FlowElementDefinition | undefined;
        const tokenRegex = /<!--[\s\S]*?-->|<!\[CDATA\[[\s\S]*?\]\]>|<\?[\s\S]*?\?>|<!(?:[^>]*)>|<(\/?)([A-Za-z_][\w.:-]*)[^>]*?(\/?)>/g;
        for (let match = tokenRegex.exec(xml); match !== null; match = tokenRegex.exec(xml)) {
            const [, closing, tagName, selfClosing] = match;
            if (!tagName) {
                continue; // comment, CDATA, processing instruction or doctype
            }
            if (closing) {
                stack.pop();
                if (stack.length === 1 && current) {
                    elements.push(current);
                    current = undefined;
                }
                continue;
            }
            const depth: number = stack.length; // 0 is the root, 1 is a top-level element, 2 is one of its fields
            if (depth === 1) {
                current = { tag: tagName, nameOffset: match.index, childOffsets: new Map() };
            } else if (depth === 2 && current) {
                const key: string = tagName.toLowerCase();
                if (!current.childOffsets.has(key)) {
                    current.childOffsets.set(key, match.index);
                }
                if (tagName === 'name' && !selfClosing) {
                    const textEnd: number = xml.indexOf('<', tokenRegex.lastIndex);
                    if (textEnd >= 0) {
                        current.name = this.decodeEntities(xml.slice(tokenRegex.lastIndex, textEnd).trim());
                        current.nameOffset = match.index;
                    }
                }
            }
            if (!selfClosing) {
                stack.push(tagName);
            } else if (depth === 1 && current) {
                elements.push(current);
                current = undefined;
            }
        }
        return elements;
    }

    private decodeEntities(text: string): string {
        return text.replace(/&(lt|gt|quot|apos|amp);/g,
            (_m, entity: string) => ({ lt: '<', gt: '>', quot: '"', apos: "'", amp: '&' })[entity] as string);
    }

    private offsetToLineColumn(text: string, offset: number): { line: number; column: number } {
        const prefix = text.slice(0, offset);
        const lines = prefix.split(/\r?\n/);
        return {
            line: lines.length,
            column: lines[lines.length - 1].length + 1
        };
    }

    private fileLevelComment(finding: FlowAnalyzerFinding): string {
        const parts: string[] = finding.elementApiName ? [`elementApiName=${finding.elementApiName}`] : [];
        if (finding.elementType) {
            parts.push(`elementType=${finding.elementType}`);
        }
        if (finding.affectedField) {
            parts.push(`affectedField=${finding.affectedField}`);
        }
        return parts.length > 0
            ? `File-level 1:1 anchor; exact XML location unavailable (${parts.join(', ')})`
            : 'File-level 1:1 anchor; the finding applies to the whole flow';
    }
}
