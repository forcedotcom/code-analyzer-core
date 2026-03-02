package com.salesforce.sfca.pmdwrapper;

import com.salesforce.sfca.shared.ProcessingError;

/**
 * Results structure for AST dump command.
 * Contains either the AST (if successful) or an error (if failed), but never both.
 */
public class PmdAstDumpResults {
    /**
     * Full path to the file that was processed
     */
    public String file;

    /**
     * The AST representation in XML format
     * This is populated if the AST generation was successful, null otherwise
     */
    public String ast;

    /**
     * Error details if AST generation failed
     * This is populated if the AST generation failed, null otherwise
     */
    public ProcessingError error;
}
