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
        it('should initialize with hardcoded credentials', async () => {
            // Currently using hardcoded credentials for testing
            await expect(authService.initialize({})).resolves.toBeUndefined();
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
