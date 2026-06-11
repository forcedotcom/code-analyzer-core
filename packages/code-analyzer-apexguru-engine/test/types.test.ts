import { ApexGuruScanMetadata } from '../src/types';

describe('Tests for ApexGuruScanMetadata type', () => {
    it('When ApexGuruScanMetadata is created with valid SFAP contract fields, then TypeScript compilation succeeds', () => {
        // Create sample metadata object matching SFAP contract
        const metadata: ApexGuruScanMetadata = {
            analysis_mode: 'full',
            files_scanned: 5,
            violation_breakdown: {
                'ApexFlsViolationRule': 3,
                'ApexSharingViolationsRule': 2
            },
            violation_count: 5,
            report_generated_ms: 1234567890
        };

        // Assert structure matches expected SFAP contract
        expect(metadata.analysis_mode).toBe('full');
        expect(metadata.files_scanned).toBe(5);
        expect(metadata.violation_breakdown).toEqual({
            'ApexFlsViolationRule': 3,
            'ApexSharingViolationsRule': 2
        });
        expect(metadata.violation_count).toBe(5);
        expect(metadata.report_generated_ms).toBe(1234567890);
    });

    it('When ApexGuruScanMetadata has analysis_mode as static, then it should be valid', () => {
        const metadata: ApexGuruScanMetadata = {
            analysis_mode: 'static',
            files_scanned: 1,
            violation_breakdown: { 'TestRule': 1 },
            violation_count: 1,
            report_generated_ms: 9876543210
        };

        expect(metadata.analysis_mode).toBe('static');
    });
});
