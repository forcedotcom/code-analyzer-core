import path from "node:path";
import {Workspace} from "@salesforce/code-analyzer-engine-api";
import {Language} from "./constants";

// noinspection JSMismatchedCollectionQueryUpdate (IntelliJ is confused about how I am setting the private values, suppressing warnings)
export class WorkspaceLiaison {
    private readonly workspace?: Workspace;
    private readonly selectedLanguages: Set<Language>;
    private readonly extensionToLanguageMap: Map<string, Language>;

    private relevantLanguageToFilesMap?: Map<Language, string[]>;

    constructor(workspace: Workspace | undefined, selectedLanguages: Language[], extensionToLanguageMap: Map<string, Language>) {
        this.workspace = workspace;
        this.selectedLanguages = new Set(selectedLanguages);
        this.extensionToLanguageMap = extensionToLanguageMap;
    }

    getWorkspace(): Workspace | undefined {
        return this.workspace;
    }

    async getRelevantLanguages(): Promise<Language[]> {
        return [...(await this.getRelevantLanguageToFilesMap()).keys()].sort();
    }

    async getRelevantLanguageToFilesMap(): Promise<Map<Language, string[]>> {
        if (this.relevantLanguageToFilesMap) {
            return this.relevantLanguageToFilesMap;
        }
        if (!this.workspace) {
            this.relevantLanguageToFilesMap = new Map([...this.selectedLanguages].map(lang => [lang, []]));
            return this.relevantLanguageToFilesMap;
        }

        const files: string[] = await this.workspace.getTargetedFiles();
        this.relevantLanguageToFilesMap = new Map<Language, string[]>();

        for (const file of files) {
            const fileExt: string = path.extname(file).toLowerCase();
            const lang: Language | undefined = this.extensionToLanguageMap.get(fileExt);
            if (!lang || !this.selectedLanguages.has(lang)) {
                continue;
            }
            if(!this.relevantLanguageToFilesMap.has(lang)) {
                this.relevantLanguageToFilesMap.set(lang,[]);
            }
            this.relevantLanguageToFilesMap.get(lang)!.push(file);
        }
        return this.relevantLanguageToFilesMap;
    }
}

// Converts our file_extensions map which associates languages to file extensions to a map that associates
// file extensions to languages. This will speed up processing later, which is why we do this conversion.
export function toExtensionsToLanguageMap(langToFileExtsMap:  Record<Language, string[]>): Map<string, Language> {
    const extensionsToLanguageMap: Map<string, Language> = new Map();
    for (const language of Object.keys(langToFileExtsMap)) {
        for (const fileExt of langToFileExtsMap[language as Language]) {
            extensionsToLanguageMap.set(fileExt, language as Language);
        }
    }
    return extensionsToLanguageMap;
}
