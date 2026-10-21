import { CodeLocation } from '@salesforce/code-analyzer-engine-api';
import { CollectedFlowFile, FlowAnalyzerFinding } from '../types';

export type MappedLocation = CodeLocation & {
    usedFileLevelAnchor: boolean;
};

export class FindingLocationMapper {
    map(finding: FlowAnalyzerFinding, collectedFile: CollectedFlowFile): MappedLocation {
        const match = this.findElement(collectedFile.content, finding.elementApiName, finding.affectedField);
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

    private findElement(xml: string, elementApiName: string, affectedField?: string): { line: number; column: number } | undefined {
        if (!elementApiName) {
            return undefined;
        }
        const searchTerm = affectedField
            ? `<${affectedField}>${this.escapeRegExp(elementApiName)}`
            : `>${this.escapeRegExp(elementApiName)}<`;
        const index = this.indexOfInsensitive(xml, searchTerm) ?? this.indexOfInsensitive(xml, elementApiName);
        if (index === undefined || index < 0) {
            return undefined;
        }
        return this.offsetToLineColumn(xml, index);
    }

    private indexOfInsensitive(haystack: string, needle: string): number | undefined {
        const index = haystack.toLowerCase().indexOf(needle.toLowerCase());
        return index >= 0 ? index : undefined;
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
        const parts = [`elementApiName=${finding.elementApiName}`];
        if (finding.elementType) {
            parts.push(`elementType=${finding.elementType}`);
        }
        if (finding.affectedField) {
            parts.push(`affectedField=${finding.affectedField}`);
        }
        return `File-level 1:1 anchor; exact XML location unavailable (${parts.join(', ')})`;
    }

    private escapeRegExp(value: string): string {
        return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
}
