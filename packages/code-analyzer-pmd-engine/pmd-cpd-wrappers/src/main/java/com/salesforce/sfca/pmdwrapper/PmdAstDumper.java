package com.salesforce.sfca.pmdwrapper;

import com.salesforce.sfca.shared.ProcessingError;
import net.sourceforge.pmd.PMDConfiguration;
import net.sourceforge.pmd.PmdAnalysis;
import net.sourceforge.pmd.lang.Language;
import net.sourceforge.pmd.lang.LanguageVersion;
import net.sourceforge.pmd.lang.ast.Node;
import net.sourceforge.pmd.lang.document.FileId;
import net.sourceforge.pmd.lang.document.TextFile;
import net.sourceforge.pmd.reporting.FileAnalysisListener;
import net.sourceforge.pmd.reporting.GlobalAnalysisListener;
import net.sourceforge.pmd.reporting.ListenerInitializer;
import net.sourceforge.pmd.util.treeexport.XmlTreeRenderer;

import java.io.IOException;
import java.io.StringWriter;
import java.nio.charset.Charset;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.Collections;

/**
 * Core class that performs AST dumping using PMD APIs
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

            // Create PMD configuration
            PMDConfiguration config = new PMDConfiguration();

            // Get language and validate it's supported
            Language language = config.getLanguageRegistry().getLanguageById(inputData.language);
            if (language == null) {
                throw new RuntimeException("Language not supported: " + inputData.language);
            }

            // Get language version
            LanguageVersion languageVersion = config.getLanguageVersionDiscoverer()
                    .getDefaultLanguageVersion(language);
            config.setForceLanguageVersion(languageVersion);

            // Read file content
            Path filePath = Paths.get(inputData.fileToDump);
            String content = readFileContent(filePath, inputData.encoding);

            // Create text file
            FileId fileId = FileId.fromPathLikeString(inputData.fileToDump);
            TextFile textFile = TextFile.forCharSeq(content, fileId, languageVersion);

            // Use PmdAnalysis to parse the file and capture AST
            final StringBuilder astXml = new StringBuilder();
            final Exception[] capturedException = new Exception[1];

            try (PmdAnalysis pmd = PmdAnalysis.create(config)) {
                // Add our file
                pmd.files().addFile(textFile);

                // Add listener to capture AST
                pmd.addListener(new GlobalAnalysisListener() {
                    @Override
                    public ListenerInitializer initializer() {
                        return new ListenerInitializer() {
                            @Override
                            public void setNumberOfFilesToAnalyze(int numFiles) {
                                // Not needed
                            }
                        };
                    }

                    @Override
                    public FileAnalysisListener startFileAnalysis(TextFile file) {
                        return new FileAnalysisListener() {
                            @Override
                            public void onRuleViolation(net.sourceforge.pmd.reporting.RuleViolation violation) {
                                // Not needed
                            }

                            @Override
                            public void onSuppressedRuleViolation(net.sourceforge.pmd.reporting.RuleViolation violation) {
                                // Not needed
                            }

                            @Override
                            public void onError(net.sourceforge.pmd.reporting.Report.ProcessingError error) {
                                // Not needed
                            }

                            @Override
                            public void onParsingError(net.sourceforge.pmd.reporting.Report.ProcessingError error) {
                                capturedException[0] = new Exception(error.getDetail());
                            }

                            @Override
                            public void close(net.sourceforge.pmd.reporting.Report.FileAnalysisStatistics stats, Node rootNode) {
                                try {
                                    // Render AST as XML
                                    StringWriter writer = new StringWriter();
                                    XmlTreeRenderer renderer = new XmlTreeRenderer();
                                    renderer.renderSubtree(rootNode, writer);
                                    astXml.append(writer.toString());
                                } catch (Exception e) {
                                    capturedException[0] = e;
                                }
                            }
                        };
                    }

                    @Override
                    public void close() {
                        // Not needed
                    }
                });

                // Perform analysis
                pmd.performAnalysis();
            }

            // Check if we captured an exception
            if (capturedException[0] != null) {
                throw capturedException[0];
            }

            // Check if we captured AST
            if (astXml.length() == 0) {
                throw new RuntimeException("Failed to generate AST - no output captured");
            }

            results.ast = astXml.toString();
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
