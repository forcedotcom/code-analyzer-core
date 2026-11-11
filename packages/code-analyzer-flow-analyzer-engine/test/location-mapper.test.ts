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

    it('describes flow-level findings without an element as applying to the whole flow', () => {
        const location = mapper.map({ ruleName: 'R', message: 'm', relativeFilePath: file.relativeFilePath } as never, file);
        expect(location.usedFileLevelAnchor).toBe(true);
        expect(location.comment).toEqual('File-level 1:1 anchor; the finding applies to the whole flow');
    });

    describe('when the element is referenced before it is defined', () => {
        const referencingXml = [
            '<?xml version="1.0"?>',
            '<Flow xmlns="http://soap.sforce.com/2006/04/metadata">',
            '  <!-- <name>get_Account</name> -->',
            '  <start>',
            '    <connector>',
            '      <targetReference>get_Account</targetReference>',
            '    </connector>',
            '  </start>',
            '  <decisions>',
            '    <name>check</name>',
            '    <defaultConnector>',
            '      <targetReference>get_Account</targetReference>',
            '    </defaultConnector>',
            '  </decisions>',
            '  <recordLookups>',
            '    <name>get_Account</name>',
            '    <object>Account</object>',
            '    <filters>',
            '      <field>get_Account</field>',
            '    </filters>',
            '  </recordLookups>',
            '</Flow>'
        ].join('\n');
        const referencingFile: CollectedFlowFile = { ...file, content: referencingXml };
        const finding = { ruleName: 'R', message: 'm', relativeFilePath: file.relativeFilePath, elementApiName: 'get_Account' };

        it('points at the element definition, not the earlier references', () => {
            const location = mapper.map({ ...finding, elementType: 'recordLookups' }, referencingFile);
            expect(location.startLine).toEqual(16);
            expect(location.startColumn).toEqual(5);
            expect(location.usedFileLevelAnchor).toBe(false);
        });

        it('points at the definition when elementType is absent or uses a different vocabulary', () => {
            expect(mapper.map(finding, referencingFile).startLine).toEqual(16);
            expect(mapper.map({ ...finding, elementType: 'Get Records' }, referencingFile).startLine).toEqual(16);
        });

        it('points at the affected field inside the element when it exists there', () => {
            const location = mapper.map({ ...finding, elementType: 'recordLookups', affectedField: 'object' }, referencingFile);
            expect(location.startLine).toEqual(17);
        });

        it('falls back to the element name when the affected field is not a direct child of the element', () => {
            const location = mapper.map({ ...finding, affectedField: 'noSuchField' }, referencingFile);
            expect(location.startLine).toEqual(16);
        });

        it('uses the file-level anchor when the name is only referenced, never defined', () => {
            const location = mapper.map({ ...finding, elementApiName: 'check_Missing' }, {
                ...file,
                content: '<Flow>\n  <start>\n    <connector>\n      <targetReference>check_Missing</targetReference>\n    </connector>\n  </start>\n</Flow>'
            });
            expect(location.usedFileLevelAnchor).toBe(true);
        });

        it('decodes XML entities in element names', () => {
            const location = mapper.map({ ...finding, elementApiName: 'a&b' }, {
                ...file,
                content: '<Flow>\n  <assignments>\n    <name>a&amp;b</name>\n  </assignments>\n</Flow>'
            });
            expect(location.startLine).toEqual(3);
        });

        it('uses the file-level anchor for malformed XML with no definitions', () => {
            const location = mapper.map(finding, { ...file, content: 'not xml at all' });
            expect(location.usedFileLevelAnchor).toBe(true);
        });
    });
});
