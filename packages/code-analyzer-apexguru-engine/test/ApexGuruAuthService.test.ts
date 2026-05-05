import { ApexGuruAuthService } from '../src/services/ApexGuruAuthService';
import { Org, Connection } from '@salesforce/core';

// Mock @salesforce/core
jest.mock('@salesforce/core');

describe('ApexGuruAuthService', () => {
    let authService: ApexGuruAuthService;
    let mockEmitLogEvent: jest.Mock;
    let mockConnection: jest.Mocked<Connection>;

    beforeEach(() => {
        jest.clearAllMocks();
        mockEmitLogEvent = jest.fn();
        authService = new ApexGuruAuthService(mockEmitLogEvent);

        // Mock connection
        mockConnection = {
            instanceUrl: 'https://test.salesforce.com',
            accessToken: 'mock_access_token',
            version: '64.0'
        } as any;
    });

    describe('initialize', () => {
        it('should initialize with targetOrg using SF CLI', async () => {
            const mockOrg = {
                getConnection: jest.fn().mockReturnValue(mockConnection)
            };
            (Org.create as jest.Mock).mockResolvedValue(mockOrg);

            await authService.initialize({ targetOrg: 'myorg' });

            expect(Org.create).toHaveBeenCalledWith({ aliasOrUsername: 'myorg' });
            expect(mockOrg.getConnection).toHaveBeenCalled();
            expect(authService.getInstanceUrl()).toBe('https://test.salesforce.com');
        });

        it('should throw error when targetOrg authentication fails', async () => {
            (Org.create as jest.Mock).mockRejectedValue(new Error('Org not found'));

            await expect(authService.initialize({ targetOrg: 'invalid-org' }))
                .rejects
                .toThrow("Failed to authenticate with org 'invalid-org'");
        });

        it('should initialize with default org when no config provided', async () => {
            const mockOrg = {
                getConnection: jest.fn().mockReturnValue(mockConnection)
            };
            (Org.create as jest.Mock).mockResolvedValue(mockOrg);

            await authService.initialize({});

            expect(Org.create).toHaveBeenCalledWith({});
            expect(mockOrg.getConnection).toHaveBeenCalled();
        });
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

    describe('mintOrgJwt', () => {
        it('should throw error if not initialized', async () => {
            await expect(authService.mintOrgJwt())
                .rejects.toThrow('Auth service not initialized');
        });

        // TODO: Add tests for successful JWT minting when proper auth is implemented
        // - Should call /dataseed/auth with correct headers
        // - Should return JWT from response
        // - Should cache JWT in orgJwt property
        // - Should handle API errors properly
    });

    describe('getOrgJwt', () => {
        it('should return undefined when JWT not minted', () => {
            expect(authService.getOrgJwt()).toBeUndefined();
        });

        // TODO: Add test for returning cached JWT after minting
    });

    describe('getOrMintOrgJwt', () => {
        it('should throw error if not initialized', async () => {
            await expect(authService.getOrMintOrgJwt())
                .rejects.toThrow('Auth service not initialized');
        });

        // TODO: Add tests for getOrMintOrgJwt when proper auth is implemented
        // - Should mint new JWT if not cached
        // - Should return cached JWT if available
    });
});
