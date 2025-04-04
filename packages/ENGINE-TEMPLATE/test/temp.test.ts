import {changeWorkingDirectoryToPackageRoot} from "./test-helpers";
import {getMessage} from "../src/messages";

changeWorkingDirectoryToPackageRoot();

describe('Temporary test', () => {
    it('Temporary test', () => {
        // This is just a temporary assertion to get code coverage
        expect(getMessage('TemplateMessage2', 'hello', 3)).toEqual(
            `This message has two variables, 'hello' and 3, in its message.`);
    });
});
