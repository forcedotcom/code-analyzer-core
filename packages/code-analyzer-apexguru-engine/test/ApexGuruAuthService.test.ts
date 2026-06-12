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

    describe('curlRequest', () => {
        beforeEach(async () => {
            const mockOrg = {
                getConnection: jest.fn().mockReturnValue(mockConnection)
            };
            (Org.create as jest.Mock).mockResolvedValue(mockOrg);
            await authService.initialize({ targetOrg: 'myorg' });
        });

        it('should perform GET request with correct headers and URL', async () => {
            const mockFetch = jest.fn().mockResolvedValue({
                ok: true,
                json: jest.fn().mockResolvedValue({ status: 'success' })
            });
            global.fetch = mockFetch as any;

            const result = await (authService as any).curlRequest('GET', '/services/data/v64.0/apexguru/validate');

            expect(mockFetch).toHaveBeenCalledWith(
                'https://test.salesforce.com/services/data/v64.0/apexguru/validate',
                {
                    method: 'GET',
                    headers: {
                        'Authorization': 'Bearer mock_access_token',
                        'Content-Type': 'application/json'
                    },
                    body: undefined
                }
            );
            expect(result).toEqual({ status: 'success' });
        });

        it('should perform POST request with body', async () => {
            const mockFetch = jest.fn().mockResolvedValue({
                ok: true,
                json: jest.fn().mockResolvedValue({ requestId: '12345' })
            });
            global.fetch = mockFetch as any;

            const requestBody = { classContent: 'base64string' };
            const result = await (authService as any).curlRequest('POST', '/services/data/v64.0/apexguru/request', requestBody);

            expect(mockFetch).toHaveBeenCalledWith(
                'https://test.salesforce.com/services/data/v64.0/apexguru/request',
                {
                    method: 'POST',
                    headers: {
                        'Authorization': 'Bearer mock_access_token',
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(requestBody)
                }
            );
            expect(result).toEqual({ requestId: '12345' });
        });

        it('should throw error for non-200 response', async () => {
            const mockFetch = jest.fn().mockResolvedValue({
                ok: false,
                status: 401,
                statusText: 'Unauthorized',
                text: jest.fn().mockResolvedValue('Invalid token')
            });
            global.fetch = mockFetch as any;

            await expect((authService as any).curlRequest('GET', '/services/data/v64.0/apexguru/validate'))
                .rejects
                .toThrow('HTTP 401 Unauthorized at /services/data/v64.0/apexguru/validate: Invalid token');
        });

        it('should handle network errors', async () => {
            const mockFetch = jest.fn().mockRejectedValue(new Error('Network failure'));
            global.fetch = mockFetch as any;

            await expect((authService as any).curlRequest('GET', '/services/data/v64.0/apexguru/validate'))
                .rejects
                .toThrow('Request failed for /services/data/v64.0/apexguru/validate: Network failure');
        });
    });
});
