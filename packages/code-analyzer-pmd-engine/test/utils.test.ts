import {SemVer} from "semver";
import {_extractJavaVersionFrom} from "../src/JavaVersionIdentifier";

describe('Test for _extractJavaVersionFrom helper', () => {
    type VERSION_CASE = {description: string, input: string, expected: SemVer};
    const versionCases: VERSION_CASE[] = [
        {
            description: 'v11_linux',
            input: 'openjdk version "11.0.6" 2020-01-14 LTS\nOpenJDK Runtime Environment Zulu11.37+17-CA (build 11.0.6+10-LTS)\nOpenJDK 64-Bit Server VM Zulu11.37+17-CA (build 11.0.6+10-LTS, mixed mode)\n',
            expected: new SemVer('11.0.6')
        },
        {
            description: 'v8_mac',
            input: 'openjdk version "1.8.0_172"\nOpenJDK Runtime Environment (Zulu 8.30.0.2-macosx) (build 1.8.0_172-b01)\nOpenJDK 64-Bit Server VM (Zulu 8.30.0.2-macosx) (build 25.172-b01, mixed mode)\n',
            expected: new SemVer('1.8.0')
        },
        {
            description: 'v12_linux',
            input: 'java version "12.0.1" 2019-04-16\nJava(TM) SE Runtime Environment (build 12.0.1+12)\nJava HotSpot(TM) 64-Bit Server VM (build 12.0.1+12, mixed mode, sharing)',
            expected: new SemVer('12.0.1')
        },
        { // This comes from https://github.com/forcedotcom/sfdx-scanner/issues/1453
            description: 'v17_with_java_options',
            input: 'Picked up _JAVA_OPTIONS: -Xmx5g\njava version "17.0.11" 2024-04-16 LTS\nJava(TM) SE Runtime Environment (build 17.0.11+7-LTS-207)',
            expected: new SemVer('17.0.11')
        },
        { // This type of output typically comes from "java --version" instead of "java -version" but we will try to support it as well
            description: 'v14_windows',
            input: 'openjdk 14 2020-03-17\r\nOpenJDK Runtime Environment (build 14+36-1461)\r\nOpenJDK 64-Bit Server VM (build 14+36-1461, mixed mode, sharing)\r\n',
            expected: new SemVer('14.0.0')
        }
    ];
    it.each(versionCases)('For version $description, make sure _extractJavaVersionFrom returns expected version', async (caseObj: VERSION_CASE) => {
        const version: SemVer = _extractJavaVersionFrom(caseObj.input)!;
        expect(version.toString()).toEqual(caseObj.expected.toString());
    });

    it('Check that _extractJavaVersionFrom returns null if given garbage without version info', async () => {
        expect(_extractJavaVersionFrom('this is garbage')).toEqual(null);
    });
});