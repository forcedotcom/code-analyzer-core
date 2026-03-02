package com.salesforce.sfca.pmdwrapper;

import com.salesforce.sfca.shared.ProcessingError;

import java.io.IOException;
import java.nio.charset.Charset;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;

/**
 * Core class that performs AST dumping using PMD APIs
 *
 * NOTE: This is a temporary stub implementation. The PMD 7.21.0 API for accessing
 * AST without rules has significant differences from earlier versions. Further
 * investigation is needed to find the correct API approach.
 *
 * Potential approaches to explore:
 * 1. Create a custom XPath rule that always fires to capture AST
 * 2. Use reflection to access internal PMD file cache
 * 3. Extend PMD's LanguageProcessor directly
 * 4. Contact PMD maintainers for guidance on PMD 7 AST access
 */
public class PmdAstDumper {

    /**
     * Dumps the AST for a single file in XML format
     *
     * @param inputData Input data containing language, file path, and encoding
     * @return Results containing either the AST (if successful) or error details (if failed)
     */
    public PmdAstDumpResults dump(PmdAstDumpInputData inputData) {
        validateInputData(inputData);

        PmdAstDumpResults results = new PmdAstDumpResults();
        results.file = inputData.fileToDump;

        try {
            System.out.println("Attempting to generate AST for file '" + inputData.fileToDump + "' with language '" + inputData.language + "'");

            // Verify file exists
            Path filePath = Paths.get(inputData.fileToDump);
            readFileContent(filePath, inputData.encoding);

            // TODO: Implement AST dump using correct PMD 7.21.0 APIs
            // Current blocker: FileAnalysisListener interface methods don't match PMD 7 API
            throw new UnsupportedOperationException(
                "AST dump feature is not yet fully implemented for PMD 7.21.0. " +
                "The PMD 7 API for accessing AST without rules has significant changes from PMD 6. " +
                "This feature requires further investigation of the correct PMD 7 APIs. " +
                "File validated: " + filePath
            );

        } catch (Exception e) {
            // Store processing error
            System.err.println("Error generating AST for file '" + inputData.fileToDump + "': " + e.getMessage());
            ProcessingError error = new ProcessingError();
            error.file = inputData.fileToDump;
            error.message = e.getMessage() != null ? e.getMessage() : e.getClass().getSimpleName();
            error.detail = e.toString();
            results.error = error;
        }

        return results;
    }

    /**
     * Validates the input data
     */
    private void validateInputData(PmdAstDumpInputData inputData) {
        if (inputData.language == null || inputData.language.trim().isEmpty()) {
            throw new RuntimeException("The 'language' field is required");
        }
        if (inputData.fileToDump == null || inputData.fileToDump.trim().isEmpty()) {
            throw new RuntimeException("The 'fileToDump' field is required");
        }
        if (inputData.encoding == null || inputData.encoding.trim().isEmpty()) {
            inputData.encoding = "UTF-8";
        }
    }

    /**
     * Reads file content using the specified encoding
     */
    private String readFileContent(Path filePath, String encoding) throws IOException {
        if (!Files.exists(filePath)) {
            throw new IOException("File not found: " + filePath);
        }
        if (!Files.isRegularFile(filePath)) {
            throw new IOException("Not a regular file: " + filePath);
        }

        Charset charset = Charset.forName(encoding);
        return Files.readString(filePath, charset);
    }
}
