package com.salesforce.sfca.pmdwrapper;

/**
 * Input data structure for AST dump command
 */
public class PmdAstDumpInputData {
    /**
     * The language of the file to dump AST for (e.g., "apex", "xml", "visualforce")
     */
    public String language;

    /**
     * Single file to generate AST for
     */
    public String fileToDump;

    /**
     * Character encoding for reading the file
     * Defaults to "UTF-8" if not specified
     */
    public String encoding = "UTF-8";
}
