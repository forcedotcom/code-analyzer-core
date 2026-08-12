import { ApexGuruAuthService } from '../src/services/ApexGuruAuthService';
import { Org, Connection } from '@salesforce/core';

// Mock dependencies
jest.mock('@salesforce/core');

// Mock global fetch
const mockFetch = jest.fn();
global.fetch = mockFetch as any;

describe('ApexGuruAuthService', () => {
    let authService: ApexGuruAuthService;
    let mockEmitLogEvent: jest.Mock;
    let mockConnection: jest.Mocked<Connection>;

    beforeEach(() => {
        jest.clearAllMocks();
        mockFetch.mockClear();
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

        it('should initialize with default org when no targetOrg provided', async () => {
            const mockOrg = {
                getConnection: jest.fn().mockReturnValue(mockConnection)
            };
            (Org.create as jest.Mock).mockResolvedValue(mockOrg);

            await authService.initialize({});

            expect(Org.create).toHaveBeenCalledWith({});
            expect(mockOrg.getConnection).toHaveBeenCalled();
        });

        it('should throw error when no default org found', async () => {
            (Org.create as jest.Mock).mockRejectedValue(new Error('No default org'));

            await expect(authService.initialize({}))
                .rejects
                .toThrow('Code Analyzer skipped ApexGuru scan because no default org is set');
        });
    });

    describe('getConnection', () => {
        it('should throw error if not initialized', () => {
            expect(() => authService.getConnection())
                .toThrow('Auth service not initialized');
        });

        it('should return connection after initialization', async () => {
            const mockOrg = {
                getConnection: jest.fn().mockReturnValue(mockConnection)
            };
            (Org.create as jest.Mock).mockResolvedValue(mockOrg);

            await authService.initialize({});

            expect(authService.getConnection()).toBe(mockConnection);
        });
    });

    describe('getAccessToken', () => {
        it('should throw error if not initialized', () => {
            expect(() => authService.getAccessToken())
                .toThrow('Auth service not initialized');
        });

        it('should return access token after initialization', async () => {
            const mockOrg = {
                getConnection: jest.fn().mockReturnValue(mockConnection)
            };
            (Org.create as jest.Mock).mockResolvedValue(mockOrg);

            await authService.initialize({});

            expect(authService.getAccessToken()).toBe('mock_access_token');
        });
    });

    describe('getInstanceUrl', () => {
        it('should throw error if not initialized', () => {
            expect(() => authService.getInstanceUrl())
                .toThrow('Auth service not initialized');
        });

        it('should return instance URL after initialization', async () => {
            const mockOrg = {
                getConnection: jest.fn().mockReturnValue(mockConnection)
            };
            (Org.create as jest.Mock).mockResolvedValue(mockOrg);

            await authService.initialize({});

            expect(authService.getInstanceUrl()).toBe('https://test.salesforce.com');
        });
    });

    describe('getApiVersion', () => {
        it('should throw error if not initialized', () => {
            expect(() => authService.getApiVersion())
                .toThrow('Auth service not initialized');
        });

        it('should return API version after initialization', async () => {
            const mockOrg = {
                getConnection: jest.fn().mockReturnValue(mockConnection)
            };
            (Org.create as jest.Mock).mockResolvedValue(mockOrg);

            await authService.initialize({});

            expect(authService.getApiVersion()).toBe('64.0');
        });

        it('should return default version 64.0 if connection version is undefined', async () => {
            const mockOrgNoVersion = {
                getConnection: jest.fn().mockReturnValue({
                    instanceUrl: 'https://test.salesforce.com',
                    accessToken: 'mock_access_token',
                    version: undefined
                })
            };
            (Org.create as jest.Mock).mockResolvedValue(mockOrgNoVersion);

            await authService.initialize({});

            expect(authService.getApiVersion()).toBe('64.0');
        });
    });

    describe('mintOrgJwt', () => {
        beforeEach(async () => {
            const mockOrg = {
                getConnection: jest.fn().mockReturnValue(mockConnection)
            };
            (Org.create as jest.Mock).mockResolvedValue(mockOrg);
            await authService.initialize({});
        });

        it('should mint JWT successfully', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    jwt: 'mock-jwt-token-12345'
                })
            } as any);

            const jwt = await authService.mintOrgJwt();

            expect(jwt).toBe('mock-jwt-token-12345');
            expect(mockFetch).toHaveBeenCalledWith(
                'https://test.salesforce.com/ide/auth',
                expect.objectContaining({
                    method: 'POST',
                    headers: expect.objectContaining({
                        'Accept': 'application/json',
                        'Authorization': 'Bearer mock_access_token',
                        'X-Feature-Id': 'CodeAnalyzer',
                        'Content-Type': 'application/json'
                    })
                })
            );
        });

        it('should throw error if not initialized', async () => {
            const uninitializedService = new ApexGuruAuthService(mockEmitLogEvent);

            await expect(uninitializedService.mintOrgJwt())
                .rejects.toThrow('Auth service not initialized');
        });

        it('should throw error when JWT API returns non-ok response', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: false,
                status: 401,
                statusText: 'Unauthorized',
                text: async () => 'Invalid credentials'
            } as any);

            await expect(authService.mintOrgJwt())
                .rejects.toThrow('Failed to mint Org JWT: 401 Unauthorized');
        });

        it('should throw error when JWT is missing in response', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    // Missing jwt field
                    message: 'Some message'
                })
            } as any);

            await expect(authService.mintOrgJwt())
                .rejects.toThrow('Org JWT response missing jwt field');
        });

        it('should cache JWT after minting', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    jwt: 'cached-jwt-token'
                })
            } as any);

            await authService.mintOrgJwt();

            expect(authService.getOrgJwt()).toBe('cached-jwt-token');
        });

        it('should handle network errors gracefully', async () => {
            mockFetch.mockRejectedValueOnce(new Error('Network timeout'));

            await expect(authService.mintOrgJwt())
                .rejects.toThrow('Org JWT minting failed: Network timeout');
        });
    });

    describe('getOrgJwt', () => {
        it('should return undefined when JWT not minted', () => {
            expect(authService.getOrgJwt()).toBeUndefined();
        });

        it('should return cached JWT after minting', async () => {
            const mockOrg = {
                getConnection: jest.fn().mockReturnValue(mockConnection)
            };
            (Org.create as jest.Mock).mockResolvedValue(mockOrg);
            await authService.initialize({});

            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    jwt: 'test-jwt-123'
                })
            } as any);

            await authService.mintOrgJwt();

            expect(authService.getOrgJwt()).toBe('test-jwt-123');
        });
    });
});
