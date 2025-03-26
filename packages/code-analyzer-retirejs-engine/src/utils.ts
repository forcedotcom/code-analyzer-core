import fs from "node:fs";
import path from "node:path";
import {isBinaryFileSync} from "isbinaryfile";
import {getMessage} from "./messages";
/**
 * Attempts to create a symlink, and if that fails, attempts to create a link, and if that fails, just copies the file
 * @param srcFile Source file
 * @param destinationFile Destination file
 */
export async function linkOrCopy(srcFile: string, destinationFile: string): Promise<void> {
    const errMsgs: string[] = [];
    /* istanbul ignore next */
    return fs.promises.symlink(srcFile, destinationFile)
        .catch((err: Error) => {
            errMsgs.push(getMessage('FunctionThrewAnError', 'symlink', err.message));
            return fs.promises.link(srcFile, destinationFile);
        }).catch((err: Error) => {
            errMsgs.push(getMessage('FunctionThrewAnError', 'link', err.message));
            return fs.promises.copyFile(srcFile, destinationFile);
        }).catch((err: Error) => {
            errMsgs.push(getMessage('FunctionThrewAnError', 'copyFile', err.message));
            throw new Error(`${getMessage('AllAttemptsToCopyFileHaveFailed', srcFile, destinationFile)}\n${errMsgs.join('\n')}`);
        });
}


/**
 * Determines if the provided file is a compressed zip file based on its contents
 *
 * Note that this code is directly from https://github.com/kevva/is-zip/blob/master/index.js
 * The is-zip module does not come with any typescript type information and thus cannot be used without "require".
 * But since it literally just contains the following code, it is simple enough to just copy the function here.
 */
export function isZipFile(file: string) {
    const buf: Buffer = fs.readFileSync(file);
    /* istanbul ignore next */
    if (!buf || buf.length < 4) {
        return false;
    }
    /* istanbul ignore next */
    return buf[0] === 80 && buf[1] === 75 && (buf[2] === 3 || buf[2] === 5 || buf[2] === 7) && (buf[3] === 4 || buf[3] === 6 || buf[3] === 8);
}

/**
 * Determines if a file is a non-binary text file
 * @param file a file path or the Buffer of its contents
 */
/* TODO: Make this function async */
export function isTextFile(file: string | Buffer): boolean {
    return !isBinaryFileSync(file);
}

/**
 * Finds the command location (symlink) for a command that is pulled in from this package's dependencies.
 * Note that this command is needed since we don't want to use npx because npx might accidentally use
 * use a command located from the users directory instead of the one we want to be used. Also we shouldn't
 * hard code the location of the command, and instead need to look it up since the node_modules or .bin can
 * change locations in various scenarios.
 */
export function findCommand(commandName: string): string {
    for (let dir = __dirname; dir !== path.resolve(dir, '..'); dir = path.resolve(dir, '..')) {
        const commandPath = path.join(dir, 'node_modules', '.bin', commandName);
        if (fs.existsSync(commandPath)) {
            return commandPath;
        }
    }
    /* istanbul ignore next */
    throw new Error(`Could not find file for command: ${commandName}`);
}
