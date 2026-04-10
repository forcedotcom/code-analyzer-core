

import { ViolationMapper } from '../src/mappers/ViolationMapper';
import { ApexGuruViolation } from '../src/types';
import { Violation } from '@salesforce/code-analyzer-engine-api';

describe('ViolationMapper', () => {
    let mapper: ViolationMapper;

    beforeEach(() => {
        mapper = new ViolationMapper();
    });

    describe('mapViolations', () => {
        it('should map ApexGuru violations to Code Analyzer format', () => {
            const apexGuruViolations: ApexGuruViolation[] = [{
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

            const violations: Violation[] = mapper.mapViolations(
                apexGuruViolations,
                '/test/file.cls',
                true
            );

            expect(violations).toHaveLength(1);
            expect(violations[0].ruleName).toBe('SoqlInALoop');
            expect(violations[0].message).toBe("You're calling an expensive SOQL in a loop");
            expect(violations[0].codeLocations[0].file).toBe('/test/file.cls');
            expect(violations[0].codeLocations[0].startLine).toBe(5);
            expect(violations[0].codeLocations[0].startColumn).toBe(1);  // Default
            expect(violations[0].suggestions).toHaveLength(1);
        });

        it('should normalize locations with missing fields', () => {
            const apexGuruViolations: ApexGuruViolation[] = [{
                rule: 'TestRule',
                message: 'Test message',
                locations: [{
                    startLine: 2
                    // No startColumn, endLine, endColumn - API doesn't provide these
                }],
                primaryLocationIndex: 0,
                resources: [],
                severity: 1
            }];

            const violations = mapper.mapViolations(
                apexGuruViolations,
                '/test/file.cls',
                false
            );

            const location = violations[0].codeLocations[0];
            expect(location.startLine).toBe(2);
            expect(location.startColumn).toBe(1);       // Default (required field)
            expect(location.endLine).toBeUndefined();   // Optional - not provided by API
            expect(location.endColumn).toBeUndefined(); // Optional - not provided by API
        });

        it('should not include fixes (ApexGuru API does not return fixes)', () => {
            const apexGuruViolations: ApexGuruViolation[] = [{
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

            const violations = mapper.mapViolations(
                apexGuruViolations,
                '/test/file.cls',
                false
            );

            // Fixes are commented out in ViolationMapper (line 37) because API doesn't support them
            expect(violations[0].fixes).toBeUndefined();
        });

        it('should handle violations without fixes or suggestions', () => {
            const apexGuruViolations: ApexGuruViolation[] = [{
                rule: 'BasicRule',
                message: 'Basic violation',
                locations: [{ startLine: 1 }],
                primaryLocationIndex: 0,
                resources: [],
                severity: 1
            }];

            const violations = mapper.mapViolations(
                apexGuruViolations,
                '/test/file.cls',
                false
            );

            expect(violations[0].fixes).toBeUndefined();
            expect(violations[0].suggestions).toBeUndefined();
        });

        it('should include suggestions when includeSuggestions is true', () => {
            const apexGuruViolations: ApexGuruViolation[] = [{
                rule: 'SoqlInALoop',
                message: 'SOQL in loop',
                locations: [{ startLine: 10 }],
                primaryLocationIndex: 0,
                resources: [],
                severity: 3,
                suggestions: [{
                    location: { startLine: 10 },
                    message: '// Move SOQL outside loop\npublic void fixed() { }'
                }]
            }];

            const violations = mapper.mapViolations(apexGuruViolations, '/test/file.cls', true);

            expect(violations[0].suggestions).toHaveLength(1);
            expect(violations[0].suggestions![0].message).toContain('Move SOQL outside loop');
        });

        it('should exclude suggestions when includeSuggestions is false', () => {
            const apexGuruViolations: ApexGuruViolation[] = [{
                rule: 'SoqlInALoop',
                message: 'SOQL in loop',
                locations: [{ startLine: 10 }],
                primaryLocationIndex: 0,
                resources: [],
                severity: 3,
                suggestions: [{
                    location: { startLine: 10 },
                    message: '// Move SOQL outside loop\npublic void fixed() { }'
                }]
            }];

            const violations = mapper.mapViolations(apexGuruViolations, '/test/file.cls', false);

            expect(violations[0].suggestions).toBeUndefined();
        });

        it('should map unknown rules to apexguru-other', () => {
            const apexGuruViolations: ApexGuruViolation[] = [{
                rule: 'UnknownRule',
                message: 'New rule from API',
                locations: [{ startLine: 5 }],
                primaryLocationIndex: 0,
                resources: [],
                severity: 2
            }];

            const violations = mapper.mapViolations(apexGuruViolations, '/test/file.cls', false);

            expect(violations[0].ruleName).toBe('apexguru-other');
            expect(violations[0].message).toBe('New rule from API');
        });

        it('should map multiple locations correctly', () => {
            const apexGuruViolations: ApexGuruViolation[] = [{
                rule: 'SoqlInALoop',
                message: 'Multiple violations',
                locations: [
                    { startLine: 5, comment: 'First location' },
                    { startLine: 10, comment: 'Second location' },
                    { startLine: 15, comment: 'Third location' }
                ],
                primaryLocationIndex: 1,
                resources: [],
                severity: 3
            }];

            const violations = mapper.mapViolations(apexGuruViolations, '/test/file.cls', false);

            expect(violations[0].codeLocations).toHaveLength(3);
            expect(violations[0].codeLocations[0].startLine).toBe(5);
            expect(violations[0].codeLocations[1].startLine).toBe(10);
            expect(violations[0].codeLocations[2].startLine).toBe(15);
            expect(violations[0].primaryLocationIndex).toBe(1);
        });

        it('should preserve resource URLs', () => {
            const apexGuruViolations: ApexGuruViolation[] = [{
                rule: 'SoqlInALoop',
                message: 'Test',
                locations: [{ startLine: 1 }],
                primaryLocationIndex: 0,
                resources: [
                    'https://developer.salesforce.com/docs/atlas.en-us.apexcode.meta/apexcode/apex_gov_limits.htm',
                    'https://developer.salesforce.com/docs/atlas.en-us.apexcode.meta/apexcode/langCon_apex_SOQL.htm'
                ],
                severity: 3
            }];

            const violations = mapper.mapViolations(apexGuruViolations, '/test/file.cls', false);

            expect(violations[0].resourceUrls).toHaveLength(2);
            expect(violations[0].resourceUrls![0]).toContain('apex_gov_limits');
            expect(violations[0].resourceUrls![1]).toContain('langCon_apex_SOQL');
        });

        it('should handle locations with all optional fields', () => {
            const apexGuruViolations: ApexGuruViolation[] = [{
                rule: 'TestRule',
                message: 'Test',
                locations: [{
                    startLine: 5,
                    startColumn: 10,
                    endLine: 5,
                    endColumn: 20,
                    comment: 'Full location'
                }],
                primaryLocationIndex: 0,
                resources: [],
                severity: 1
            }];

            const violations = mapper.mapViolations(apexGuruViolations, '/test/file.cls', false);

            const loc = violations[0].codeLocations[0];
            expect(loc.startLine).toBe(5);
            expect(loc.startColumn).toBe(10);
            expect(loc.endLine).toBe(5);
            expect(loc.endColumn).toBe(20);
            expect(loc.comment).toBe('Full location');
        });
    });
});
