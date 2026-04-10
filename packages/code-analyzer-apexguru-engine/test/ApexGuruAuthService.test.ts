import { ApexGuruAuthService } from '../src/services/ApexGuruAuthService';

// Mock @salesforce/core
jest.mock('@salesforce/core');

describe('ApexGuruAuthService', () => {
    let authService: ApexGuruAuthService;
    let mockEmitLogEvent: jest.Mock;

    beforeEach(() => {
        jest.clearAllMocks();
        mockEmitLogEvent = jest.fn();
        authService = new ApexGuruAuthService(mockEmitLogEvent);
    });

    describe('initialize', () => {
        it('should throw error when hardcoded credentials not set', async () => {
            // Hardcoded credentials are set to 'YOUR_ACCESS_TOKEN_HERE' by default
            await expect(authService.initialize({}))
                .rejects.toThrow('Hardcoded credentials not set');
        });

        // TODO: Add tests for proper auth methods when implemented
        // - SF CLI integration
        // - Environment variables
        // - OAuth flow
    });

    describe('getConnection', () => {
        it('should throw error if not initialized', () => {
            expect(() => authService.getConnection())
                .toThrow('Auth service not initialized');
        });
    });

    describe('getAccessToken', () => {
        it('should throw error if not initialized', () => {
            expect(() => authService.getAccessToken())
                .toThrow('Auth service not initialized');
        });
    });

    describe('getInstanceUrl', () => {
        it('should throw error if not initialized', () => {
            expect(() => authService.getInstanceUrl())
                .toThrow('Auth service not initialized');
        });
    });

    describe('getApiVersion', () => {
        it('should throw error if not initialized', () => {
            expect(() => authService.getApiVersion())
                .toThrow('Auth service not initialized');
        });

        // TODO: Add test for getApiVersion with mock connection when proper auth is implemented
    });
});
