import { ApexGuruService } from '../../src/services/ApexGuruService';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';

const execAsync = promisify(exec);

describe('Curl Command Integration Tests', () => {
    let apexGuruService: ApexGuruService;
    const mockEmitLogEvent = jest.fn();

    beforeEach(() => {
        apexGuruService = new ApexGuruService(
            mockEmitLogEvent,
            120000,
            2000,
            60000,
            2
        );
    });

    // Skip test if no authentication is available
    const skipIfNoAuth = process.env.SF_TARGET_ORG ? test : test.skip;

    skipIfNoAuth('should generate executable curl command for validate endpoint', async () => {
        // Initialize with real authentication
        await apexGuruService.initialize(process.env.SF_TARGET_ORG);

        // Export curl commands
        const exported = apexGuruService.exportCurlCommands();
        const curlCmd = exported.validate;

        // Execute curl command
        const { stdout } = await execAsync(curlCmd);
        const response = JSON.parse(stdout);

        // Verify response has expected status field
        expect(response).toHaveProperty('status');
        expect(typeof response.status).toBe('string');
    }, 30000);

    skipIfNoAuth('should generate executable curl command for submit endpoint', async () => {
        await apexGuruService.initialize(process.env.SF_TARGET_ORG);

        const testContent = 'public class CurlTest { public void test() { System.debug("test"); } }';
        const exported = apexGuruService.exportCurlCommands();
        const curlCmd = exported.submit(testContent);

        // Execute curl command
        const { stdout } = await execAsync(curlCmd);
        const response = JSON.parse(stdout);

        // Verify response has expected fields
        expect(response).toHaveProperty('status');
        expect(['new', 'success', 'failed']).toContain(response.status.toLowerCase());
    }, 30000);

    skipIfNoAuth('should generate executable curl command for query endpoint', async () => {
        await apexGuruService.initialize(process.env.SF_TARGET_ORG);

        // First submit a request to get a requestId
        const testContent = 'public class CurlTest { }';
        const exported = apexGuruService.exportCurlCommands();

        const submitCmd = exported.submit(testContent);
        const { stdout: submitStdout } = await execAsync(submitCmd);
        const submitResponse = JSON.parse(submitStdout);

        // Use the requestId to query (or use 'pending' if no requestId)
        const requestId = submitResponse.requestId || 'pending';
        const queryCmd = exported.query(requestId);

        const { stdout: queryStdout } = await execAsync(queryCmd);
        const queryResponse = JSON.parse(queryStdout);

        // Verify response structure
        expect(queryResponse).toHaveProperty('status');
        expect(typeof queryResponse.status).toBe('string');
    }, 30000);

    test('should generate valid curl commands even without authentication', () => {
        // Don't initialize - test graceful handling
        const exported = apexGuruService.exportCurlCommands();

        expect(exported.validate).toContain('# Connection not initialized');
        expect(exported.submit('test')).toContain('# Connection not initialized');
        expect(exported.query('req-123')).toContain('# Connection not initialized');
    });
});
