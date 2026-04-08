"use strict";

Object.defineProperty(exports, "__esModule", { value: true });
const ViolationMapper_1 = require("../src/mappers/ViolationMapper");
describe('ViolationMapper', () => {
    let mapper;
    beforeEach(() => {
        mapper = new ViolationMapper_1.ViolationMapper();
    });
    describe('mapViolations', () => {
        it('should map ApexGuru violations to Code Analyzer format', () => {
            const apexGuruViolations = [{
                    rule: 'SoqlInALoop',
                    message: "You're calling an expensive SOQL in a loop",
                    locations: [{
                            startLine: 5,
                            comment: 'api_class.processAccounts'
                        }],
                    primaryLocationIndex: 0,
                    resources: ['https://help.salesforce.com/...'],
                    severity: 3,
                    suggestions: [{
                            location: { startLine: 5 },
                            message: '// Fix explanation\npublic void fixedMethod() { }'
                        }]
                }];
            const fileContent = 'line1\nline2\nline3\nline4\nline5\nline6';
            const violations = mapper.mapViolations(apexGuruViolations, '/test/file.cls', fileContent);
            expect(violations).toHaveLength(1);
            expect(violations[0].ruleName).toBe('SoqlInALoop');
            expect(violations[0].message).toBe("You're calling an expensive SOQL in a loop");
            expect(violations[0].codeLocations[0].file).toBe('/test/file.cls');
            expect(violations[0].codeLocations[0].startLine).toBe(5);
            expect(violations[0].suggestions).toHaveLength(1);
        });
        it('should normalize locations with missing fields', () => {
            const apexGuruViolations = [{
                    rule: 'TestRule',
                    message: 'Test message',
                    locations: [{
                            startLine: 2
                            // No startColumn, endLine, endColumn
                        }],
                    primaryLocationIndex: 0,
                    resources: [],
                    severity: 1
                }];
            const fileContent = 'line1\nline2 has content\nline3';
            const violations = mapper.mapViolations(apexGuruViolations, '/test/file.cls', fileContent);
            const location = violations[0].codeLocations[0];
            expect(location.startLine).toBe(2);
            expect(location.startColumn).toBe(1); // Default
            expect(location.endLine).toBe(2); // Same as startLine
            expect(location.endColumn).toBe(18); // Length of "line2 has content" + 1
        });
        it('should map fixes with exact positions', () => {
            const apexGuruViolations = [{
                    rule: 'SchemaGetGlobalDescribe',
                    message: 'Avoid using Schema.getGlobalDescribe()',
                    locations: [{ startLine: 4 }],
                    primaryLocationIndex: 0,
                    resources: [],
                    severity: 2,
                    fixes: [{
                            location: {
                                startLine: 4,
                                startColumn: 8
                            },
                            fixedCode: 'Schema.DescribeSObjectResult result = Opportunity.sObjectType.getDescribe();'
                        }]
                }];
            const fileContent = 'line1\nline2\nline3\nline4\nline5';
            const violations = mapper.mapViolations(apexGuruViolations, '/test/file.cls', fileContent);
            expect(violations[0].fixes).toHaveLength(1);
            expect(violations[0].fixes[0].location.startLine).toBe(4);
            expect(violations[0].fixes[0].location.startColumn).toBe(8);
            expect(violations[0].fixes[0].fixedCode).toContain('Opportunity.sObjectType');
        });
        it('should handle violations without fixes or suggestions', () => {
            const apexGuruViolations = [{
                    rule: 'BasicRule',
                    message: 'Basic violation',
                    locations: [{ startLine: 1 }],
                    primaryLocationIndex: 0,
                    resources: [],
                    severity: 1
                }];
            const violations = mapper.mapViolations(apexGuruViolations, '/test/file.cls', 'test content');
            expect(violations[0].fixes).toBeUndefined();
            expect(violations[0].suggestions).toBeUndefined();
        });
    });
});
//# sourceMappingURL=ViolationMapper.test.js.map