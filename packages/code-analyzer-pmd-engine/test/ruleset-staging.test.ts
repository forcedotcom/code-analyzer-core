import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {stageReferencedRulesets} from "../src/ruleset-staging";

describe('Tests for stageReferencedRulesets', () => {
    let baseFolder: string;
    let stagingFolder: string;

    beforeEach(() => {
        const tempRoot: string = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'staging-test-')));
        baseFolder = path.join(tempRoot, 'repo');
        stagingFolder = path.join(tempRoot, 'staged');
        fs.mkdirSync(path.join(baseFolder, 'scanner'), {recursive: true});
    });

    afterEach(() => {
        fs.rmSync(path.dirname(baseFolder), {recursive: true, force: true});
    });

    const rulesetWithRefs = (...refs: string[]): string =>
        `<?xml version="1.0"?><ruleset name="x">${refs.map(r => `<rule ref="${r}"/>`).join('')}</ruleset>`;

    it('When a ruleset references a sibling xml file, then only that xml file is staged', async () => {
        fs.writeFileSync(path.join(baseFolder, 'scanner', 'full.xml'), rulesetWithRefs());
        fs.writeFileSync(path.join(baseFolder, 'scanner', 'unrelated.xml'), rulesetWithRefs());
        fs.writeFileSync(path.join(baseFolder, 'Evil.class'), 'not really a class');
        const wrapper: string = path.join(baseFolder, 'wrapper.xml');
        fs.writeFileSync(wrapper, rulesetWithRefs('scanner/full.xml/MyRule'));

        const result: string | undefined = await stageReferencedRulesets([wrapper], baseFolder, stagingFolder);

        expect(result).toEqual(stagingFolder);
        expect(fs.readdirSync(stagingFolder, {recursive: true}).sort()).toEqual(['scanner', path.join('scanner', 'full.xml')]);
    });

    it('When referenced rulesets reference other rulesets, then they are staged transitively (and cycles are tolerated)', async () => {
        fs.writeFileSync(path.join(baseFolder, 'a.xml'), rulesetWithRefs('b.xml/R'));
        fs.writeFileSync(path.join(baseFolder, 'b.xml'), rulesetWithRefs('a.xml/R', 'scanner/c.xml'));
        fs.writeFileSync(path.join(baseFolder, 'scanner', 'c.xml'), rulesetWithRefs());
        const wrapper: string = path.join(baseFolder, 'wrapper.xml');
        fs.writeFileSync(wrapper, rulesetWithRefs('a.xml/R'));

        await stageReferencedRulesets([wrapper], baseFolder, stagingFolder);

        expect(fs.existsSync(path.join(stagingFolder, 'a.xml'))).toBe(true);
        expect(fs.existsSync(path.join(stagingFolder, 'b.xml'))).toBe(true);
        expect(fs.existsSync(path.join(stagingFolder, 'scanner', 'c.xml'))).toBe(true);
    });

    it('When a relative ruleset is given directly, then it is resolved against the base folder and staged', async () => {
        fs.writeFileSync(path.join(baseFolder, 'scanner', 'full.xml'), rulesetWithRefs());

        const result: string | undefined = await stageReferencedRulesets(['scanner/full.xml'], baseFolder, stagingFolder);

        expect(result).toEqual(stagingFolder);
        expect(fs.existsSync(path.join(stagingFolder, 'scanner', 'full.xml'))).toBe(true);
    });

    it('When refs try to escape the base folder, are absolute, or are not xml, then nothing is staged', async () => {
        const outsideFile: string = path.join(path.dirname(baseFolder), 'outside.xml');
        fs.writeFileSync(outsideFile, rulesetWithRefs());
        fs.writeFileSync(path.join(baseFolder, 'Evil.class'), 'x');
        const wrapper: string = path.join(baseFolder, 'wrapper.xml');
        fs.writeFileSync(wrapper, rulesetWithRefs('../outside.xml/R', outsideFile + '/R', 'Evil.class', 'does/not/exist.xml/R'));

        const result: string | undefined = await stageReferencedRulesets([wrapper], baseFolder, stagingFolder);

        expect(result).toBeUndefined();
        expect(fs.existsSync(stagingFolder)).toBe(false);
    });

    it('When a ref is a symlink pointing outside of the base folder, then it is not staged', async () => {
        const outsideFile: string = path.join(path.dirname(baseFolder), 'secret.xml');
        fs.writeFileSync(outsideFile, rulesetWithRefs());
        try {
            fs.symlinkSync(outsideFile, path.join(baseFolder, 'link.xml'));
        } catch (_err) {
            return; // Symlink creation isn't permitted in this environment (e.g. Windows without privileges)
        }
        const wrapper: string = path.join(baseFolder, 'wrapper.xml');
        fs.writeFileSync(wrapper, rulesetWithRefs('link.xml/R'));

        expect(await stageReferencedRulesets([wrapper], baseFolder, stagingFolder)).toBeUndefined();
    });

    it('When rulesets are not readable files on disk (like jar based rulesets), then they are ignored', async () => {
        const result: string | undefined = await stageReferencedRulesets(
            [path.join(baseFolder, 'missing.xml'), 'category/apex/design.xml'], baseFolder, stagingFolder);
        expect(result).toBeUndefined();
    });
});
