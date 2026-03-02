package com.salesforce.sfca.pmdwrapper;

import com.salesforce.sfca.shared.ProcessingError;
import net.sourceforge.pmd.lang.Language;
import net.sourceforge.pmd.lang.LanguageRegistry;
import net.sourceforge.pmd.util.treeexport.TreeExportConfiguration;
import net.sourceforge.pmd.util.treeexport.TreeExporter;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.PrintStream;
import java.nio.charset.Charset;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;

/**
 * Core class that performs AST dumping using PMD's TreeExporter API
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
            System.out.println("Generating AST for file '" + inputData.fileToDump + "' with language '" + inputData.language + "'");

            // Verify file exists
            Path filePath = Paths.get(inputData.fileToDump);
            readFileContent(filePath, inputData.encoding);

            // Get language
            Language language = LanguageRegistry.PMD.getLanguageById(inputData.language);
            if (language == null) {
                throw new RuntimeException("Language not supported: " + inputData.language);
            }

            // Create TreeExportConfiguration
            TreeExportConfiguration config = new TreeExportConfiguration();
            config.setLanguage(language);
            config.setFormat("xml"); // Always XML format for v1
            config.setFile(filePath);

            // Capture output to string
            ByteArrayOutputStream baos = new ByteArrayOutputStream();
            PrintStream ps = new PrintStream(baos, true, StandardCharsets.UTF_8);
            PrintStream originalOut = System.out;

            try {
                // Redirect System.out to capture XML output
                System.setOut(ps);

                // Create and export AST (TreeExporter writes to System.out)
                TreeExporter exporter = new TreeExporter(config);
                exporter.export();

                // Get the XML output
                results.ast = baos.toString(StandardCharsets.UTF_8);

            } finally {
                // Restore original System.out
                System.setOut(originalOut);
                ps.close();
            }

            System.out.println("Successfully generated AST for file '" + inputData.fileToDump + "'");

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
