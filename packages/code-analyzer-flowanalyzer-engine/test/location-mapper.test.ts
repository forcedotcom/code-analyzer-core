import path from 'node:path';
import { FindingLocationMapper } from '../src/services/FindingLocationMapper';
import { CollectedFlowFile } from '../src/types';

describe('FindingLocationMapper', () => {
    const mapper = new FindingLocationMapper();
    const xml = [
        '<?xml version="1.0"?>',
        '<Flow>',
        '  <variables>',
        '    <name>unusedVar</name>',
        '  </variables>',
        '</Flow>'
    ].join('\n');
    const file: CollectedFlowFile = {
        absolutePath: path.join('tmp', 'Sample.flow-meta.xml'),
        relativeFilePath: 'Sample.flow-meta.xml',
        content: xml
    };

    it('maps an element name to line and column', () => {
        const location = mapper.map({
            ruleName: 'R',
            message: 'm',
            relativeFilePath: file.relativeFilePath,
            elementApiName: 'unusedVar'
        }, file);
        expect(location.startLine).toEqual(4);
        expect(location.usedFileLevelAnchor).toBe(false);
    });

    it('maps using an affectedField hint when provided', () => {
        const location = mapper.map({
            ruleName: 'R',
            message: 'm',
            relativeFilePath: file.relativeFilePath,
            elementApiName: 'unusedVar',
            affectedField: 'name'
        }, file);
        expect(location.startLine).toEqual(4);
        expect(location.usedFileLevelAnchor).toBe(false);
    });

    it('falls back to a documented 1:1 file-level anchor', () => {
        const location = mapper.map({
            ruleName: 'R',
            message: 'm',
            relativeFilePath: file.relativeFilePath,
            elementApiName: 'missing',
            elementType: 'variables',
            affectedField: 'name'
        }, file);
        expect(location.startLine).toEqual(1);
        expect(location.startColumn).toEqual(1);
        expect(location.usedFileLevelAnchor).toBe(true);
        expect(location.comment).toContain('File-level 1:1 anchor');
    });
});
