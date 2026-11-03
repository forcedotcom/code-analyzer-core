import fs from "node:fs";
import path from "node:path";

// Matches the "ref" attribute of <rule ... ref="..."/> and <rule-set ... ref="..."/> style elements.
const RULE_REF_REGEX: RegExp = /<rule\b[^>]*?\bref\s*=\s*["']([^"']+)["']/gi;

/**
 * PMD resolves refs inside of a ruleset (like <rule ref="path/in/repo.xml/MyRule"/>) relative to the folder it was run
 * from or from the Java classpath. Since we pin the Java process away from the (untrusted) folder being scanned, those
 * refs would no longer resolve. Instead of putting the whole folder on the Java classpath (which would let a scanned
 * repository supply arbitrary classes and resources to the JVM), we copy only the xml ruleset files that the custom
 * rulesets actually reference (transitively) into a dedicated staging folder, and put just that folder on the classpath.
 *
 * Only regular ".xml" files that live underneath the base folder are ever staged.
 *
 * @param rulesetFiles the rulesets to inspect (absolute paths on disk, or paths relative to the base folder). Entries that are not xml files on disk are ignored.
 * @param baseFolder the folder that relative refs are resolved against
 * @param stagingFolder the folder to copy the referenced rulesets into
 * @returns the staging folder if at least one file was staged, otherwise undefined
 */
export async function stageReferencedRulesets(rulesetFiles: string[], baseFolder: string, stagingFolder: string): Promise<string | undefined> {
    const realBase: string = await realpathOrUndefined(baseFolder) ?? baseFolder;
    const visited: Set<string> = new Set();
    const queue: string[] = [];
    let stagedSomething: boolean = false;

    // Stages the file given by a (relative) ref and queues it up so that its own refs get processed too
    const stageRef = async (ref: string): Promise<void> => {
        const relativeRulesetPath: string | undefined = extractRelativeXmlPath(ref);
        if (relativeRulesetPath === undefined) {
            return;
        }
        const source: string | undefined = await resolveStageableFile(relativeRulesetPath, realBase);
        if (source === undefined) {
            return;
        }
        const destination: string = path.join(stagingFolder, relativeRulesetPath);
        await fs.promises.mkdir(path.dirname(destination), {recursive: true});
        await fs.promises.copyFile(source, destination);
        stagedSomething = true;
        queue.push(source);
    };

    for (const rulesetFile of rulesetFiles) {
        if (path.isAbsolute(rulesetFile)) {
            queue.push(rulesetFile);
        } else {
            await stageRef(rulesetFile);
        }
    }

    while (queue.length > 0) {
        const currentFile: string = queue.shift()!;
        if (visited.has(currentFile)) {
            continue;
        }
        visited.add(currentFile);

        let contents: string;
        try {
            contents = await fs.promises.readFile(currentFile, 'utf-8');
        } catch (_err) {
            continue; // Not a readable file on disk (for example, a ruleset inside of a jar file)
        }

        for (const match of contents.matchAll(RULE_REF_REGEX)) {
            await stageRef(match[1]);
        }
    }
    return stagedSomething ? stagingFolder : undefined;
}

/**
 * Returns the relative path to the xml file portion of a rule ref (stripping off any trailing "/RuleName"), or
 * undefined if the ref is not a relative path to an xml file (for example, "category/apex/design.xml" is fine to stage
 * if it exists in the base folder, but absolute paths and non-xml refs are ignored).
 */
function extractRelativeXmlPath(ref: string): string | undefined {
    const xmlMatch: RegExpMatchArray | null = ref.match(/^(.*?\.xml)(\/.*)?$/i);
    if (!xmlMatch) {
        return undefined;
    }
    const candidate: string = xmlMatch[1];
    if (path.isAbsolute(candidate) || path.win32.isAbsolute(candidate)) {
        return undefined;
    }
    return path.normalize(candidate);
}

async function resolveStageableFile(relativePath: string, realBase: string): Promise<string | undefined> {
    const real: string | undefined = await realpathOrUndefined(path.join(realBase, relativePath));
    if (real === undefined) {
        return undefined;
    }
    const relativeToBase: string = path.relative(realBase, real);
    if (relativeToBase === '' || relativeToBase.startsWith('..') || path.isAbsolute(relativeToBase)) {
        return undefined; // Never stage anything that resolves (even through symlinks) outside of the base folder
    }
    try {
        return (await fs.promises.stat(real)).isFile() ? real : undefined;
    } catch (_err) /* istanbul ignore next */ {
        return undefined;
    }
}

async function realpathOrUndefined(p: string): Promise<string | undefined> {
    try {
        return await fs.promises.realpath(p);
    } catch (_err) {
        return undefined;
    }
}
