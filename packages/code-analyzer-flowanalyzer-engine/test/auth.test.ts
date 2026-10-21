import { Org } from '@salesforce/core';
import { FlowAnalyzerAuthService } from '../src/services/FlowAnalyzerAuthService';
import { getMessage } from '../src/messages';

jest.mock('@salesforce/core');

describe('FlowAnalyzerAuthService', () => {
    const mockConnection = {
        instanceUrl: 'https://test.salesforce.com',
        accessToken: 'mock_access_token',
        version: '64.0'
    };
    let authService: FlowAnalyzerAuthService;

    beforeEach(() => {
        jest.clearAllMocks();
        authService = new FlowAnalyzerAuthService(jest.fn());
    });

    it('initializes with an explicit target org', async () => {
        const mockOrg = { getConnection: jest.fn().mockReturnValue(mockConnection) };
        (Org.create as jest.Mock).mockResolvedValue(mockOrg);

        await authService.initialize({ targetOrg: 'myorg' });

        expect(Org.create).toHaveBeenCalledWith({ aliasOrUsername: 'myorg' });
        expect(authService.getInstanceUrl()).toEqual('https://test.salesforce.com');
        expect(authService.getAccessToken()).toEqual('mock_access_token');
        expect(authService.getApiVersion()).toEqual('64.0');
    });

    it('does not fall back to the default org', async () => {
        (Org.create as jest.Mock).mockRejectedValue(new Error('Org not found'));
        await expect(authService.initialize({ targetOrg: 'missing' }))
            .rejects.toThrow(getMessage('OrgNotFound', 'missing', 'missing'));
        expect(Org.create).toHaveBeenCalledWith({ aliasOrUsername: 'missing' });
        expect(Org.create).not.toHaveBeenCalledWith({});
    });

    it('throws when getters are used before initialize', () => {
        expect(() => authService.getConnection()).toThrow(getMessage('AuthNotInitialized'));
    });

    it('throws when the access token is missing', async () => {
        const mockOrg = { getConnection: jest.fn().mockReturnValue({ ...mockConnection, accessToken: undefined }) };
        (Org.create as jest.Mock).mockResolvedValue(mockOrg);
        await authService.initialize({ targetOrg: 'myorg' });
        expect(() => authService.getAccessToken()).toThrow(getMessage('AccessTokenUnavailable'));
    });

    it('defaults api version when the connection has none', async () => {
        const mockOrg = { getConnection: jest.fn().mockReturnValue({ ...mockConnection, version: undefined }) };
        (Org.create as jest.Mock).mockResolvedValue(mockOrg);
        await authService.initialize({ targetOrg: 'myorg' });
        expect(authService.getApiVersion()).toEqual('64.0');
    });
});
