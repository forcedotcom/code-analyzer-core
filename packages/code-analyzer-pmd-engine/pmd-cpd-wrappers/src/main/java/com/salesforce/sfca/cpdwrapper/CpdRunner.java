package com.salesforce.sfca.cpdwrapper;

import com.salesforce.sfca.shared.CodeLocation;
import com.salesforce.sfca.shared.ProcessingError;
import com.salesforce.sfca.shared.ProgressReporter;
import net.sourceforge.pmd.cpd.CPDConfiguration;
import net.sourceforge.pmd.cpd.CPDListener;
import net.sourceforge.pmd.cpd.CpdAnalysis;
import net.sourceforge.pmd.cpd.Mark;
import net.sourceforge.pmd.cpd.Match;
import net.sourceforge.pmd.lang.Language;
import net.sourceforge.pmd.lang.LanguageVersion;
import net.sourceforge.pmd.lang.ast.FileAnalysisException;
import net.sourceforge.pmd.reporting.Report;
import net.sourceforge.pmd.util.log.PmdReporter;
import org.slf4j.event.Level;

import javax.annotation.Nullable;
import java.io.IOException;
import java.io.PrintWriter;
import java.io.StringWriter;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.text.MessageFormat;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Class to help us invoke CPD - once for each language that should be processed
 */
class CpdRunner {
    private final ProgressReporter progressReporter = new ProgressReporter();

    public Map<String, CpdLanguageRunResults> run(CpdRunInputData runInputData) throws IOException {
        validateRunInputData(runInputData);

        Map<String, Integer> languageFileCounts = runInputData.runDataPerLanguage.entrySet().stream()
                .collect(Collectors.toMap(Map.Entry::getKey, entry -> entry.getValue().filesToScan.size()));
        progressReporter.initialize(languageFileCounts);

        Map<String, CpdLanguageRunResults> results = new HashMap<>();
        for (String language : runInputData.runDataPerLanguage.keySet()) {
            CpdRunInputData.LanguageSpecificRunData languageSpecificRunData = runInputData.runDataPerLanguage.get(language);
            List<Path> pathsToScan = languageSpecificRunData.filesToScan.stream().map(Paths::get).collect(Collectors.toList());
            CpdLanguageRunResults languageRunResults = runLanguage(
                    language, pathsToScan, languageSpecificRunData.minimumTokens, runInputData.skipDuplicateFiles);
            if (!languageRunResults.matches.isEmpty() || !languageRunResults.processingErrors.isEmpty()) {
                results.put(language, languageRunResults);
            }
        }
        return results;
    }

    private CpdLanguageRunResults runLanguage(String language, List<Path> pathsToScan, int minimumTokens, boolean skipDuplicateFiles) throws IOException {
        System.out.println("Running CPD for language '" + language + "' with " + pathsToScan.size() +
                " file(s) to scan using minimumTokens=" + minimumTokens + " and skipDuplicateFiles=" + skipDuplicateFiles + ".");

        CPDConfiguration config = new CPDConfiguration();

        // Force the language so that pmd doesn't look at file extensions. Note: we already associated the files based
        // on their file extensions to the correct languages the typescript side.
        Language cpdLanguageId = config.getLanguageRegistry().getLanguageById(language);
        if (cpdLanguageId == null) {
            throw new RuntimeException("The language \"" + language + "\" is not recognized by CPD.");
        }
        LanguageVersion forcedLangVer = config.getLanguageVersionDiscoverer()
                .getDefaultLanguageVersion(cpdLanguageId);
        config.setForceLanguageVersion(forcedLangVer);

        // Note that the name "minimumTokens" comes from the public facing documentation and the cli but
        // behind the scenes, it maps to MinimumTileSize. To learn more about the mappings to the config, see:
        // https://github.com/pmd/pmd/blob/main/pmd-cli/src/main/java/net/sourceforge/pmd/cli/commands/internal/CpdCommand.java
        config.setMinimumTileSize(minimumTokens);

        config.setInputPathList(pathsToScan);
        config.setSkipDuplicates(skipDuplicateFiles);
        CpdErrorListener errorListener = new CpdErrorListener();

        config.setReporter(errorListener);

        CpdLanguageRunResults languageRunResults = new CpdLanguageRunResults();

        try (CpdAnalysis cpd = CpdAnalysis.create(config)) {

            // Note that we could use cpd.files().getCollectedFiles().size() to get the true totalNumFiles but
            // unfortunately getCollectedFiles doesn't cache and does a sort operation which is expensive.
            // So instead we use pathsToScan.size() since we send in the list of files instead of folders and so
            // these numbers should be the same.
            int totalNumFiles = pathsToScan.size();
            cpd.setCpdListener(new CpdLanguageRunListener(progressReporter, language, totalNumFiles));

            cpd.performAnalysis(report -> {
                for (Report.ProcessingError reportProcessingError : report.getProcessingErrors()) {
                    languageRunResults.processingErrors.add(
                            ProcessingError.fromReportProcessingError(reportProcessingError));
                }

                for (Match match : report.getMatches()) {
                    CpdLanguageRunResults.Match cpdMatch = new CpdLanguageRunResults.Match();
                    cpdMatch.numBlocks = match.getMarkCount();
                    cpdMatch.numTokensInBlock = match.getTokenCount();
                    cpdMatch.numNonemptyLinesInBlock = match.getLineCount();

                    for (Mark mark : match.getMarkSet()) {
                        cpdMatch.blockLocations.add(
                                CodeLocation.fromFileLocation(mark.getLocation()));
                    }

                    languageRunResults.matches.add(cpdMatch);
                }
            });

            // Instead of throwing exceptions and causing the entire run to fail, instead we report exceptions as
            // if they are processing errors so that they can better be handled on the typescript side
            for (Exception ex : errorListener.exceptionsCaught) {
                ProcessingError processingErr = new ProcessingError();
                processingErr.file = "unknown";
                processingErr.message = getStackTraceAsString(ex);
                processingErr.detail = "[TERMINATING_EXCEPTION]"; // Marker to help typescript side know this isn't just a normal processing error
                languageRunResults.processingErrors.add(processingErr);
            }
        }

        return languageRunResults;
    }

    private void validateRunInputData(CpdRunInputData runInputData) {
        if (runInputData.runDataPerLanguage == null) {
            throw new RuntimeException("The \"runDataPerLanguage\" field was not set.");
        }

        Set<Map.Entry<String, CpdRunInputData.LanguageSpecificRunData>> entries = runInputData.runDataPerLanguage.entrySet();
        if (entries.isEmpty()) {
            throw new RuntimeException("The \"runDataPerLanguage\" field didn't have any languages listed.");
        }

        for (Map.Entry<String, CpdRunInputData.LanguageSpecificRunData> entry: entries) {
            String language = entry.getKey();
            CpdRunInputData.LanguageSpecificRunData languageSpecificRunData = entry.getValue();

            if (languageSpecificRunData.filesToScan == null || languageSpecificRunData.filesToScan.isEmpty()) {
                throw new RuntimeException(("The \"filesToScan\" field was missing or empty for language: " + language));
            } else if (languageSpecificRunData.minimumTokens <= 0) {
                throw new RuntimeException("The \"minimumTokens\" field was not set to a positive number for language: " + language);
            }
        }
    }

    private static String getStackTraceAsString(Throwable e) {
        StringWriter sw = new StringWriter();
        try (PrintWriter pw = new PrintWriter(sw)) {
            e.printStackTrace(pw);
        }
        return sw.toString();
    }
}

// This class simply helps us process any errors that may be thrown by CPD. By default, CPD suppresses errors so that
// they are not thrown. So here, we look out for the errors that we care about and process it to throw a better
// error messages. We override the logEx method in particular because all other error methods call through to logEx.
class CpdErrorListener implements PmdReporter {
    List<Exception> exceptionsCaught = new ArrayList<>();
    @Override
    public void logEx(Level level, @javax.annotation.Nullable String s, Object[] objects, @Nullable Throwable throwable) {
        if (throwable != null) {
            if (throwable instanceof FileAnalysisException) {
                // Note that if a single file can't be processed (like if it has syntax error) then a
                // FileAnalysisException exception is thrown, but this is already reported in the processingErrors.
                // Thus, we ignore FileAnalysisException so that we don't terminate CPD entirely just because of the
                // issue with the one file, so we can continue processing the other files.
                return;
            }
            exceptionsCaught.add(new RuntimeException("CPD threw an unexpected exception:\n" + throwable.getMessage(), throwable));
        } else if (s != null) {
            String message = MessageFormat.format(s, objects);
            exceptionsCaught.add(new RuntimeException("CPD threw an unexpected exception:\n" + message));
        }
    }

    // These methods aren't needed or used, but they are required to be implemented (since the interface does not give them default implementations)
    @Override
    public boolean isLoggable(Level level) {
        return false;
    }
    @Override
    public int numErrors() {
        return 0;
    }
}

// This class is a specific listener for a run of cpd for a single language.
class CpdLanguageRunListener implements CPDListener {
    private final ProgressReporter progressReporter;
    private final String language;
    private final int totalNumFiles;
    private int numFilesAdded = 0;
    private int currentPhase = CPDListener.INIT;

    public CpdLanguageRunListener(ProgressReporter progressReporter, String language, int totalNumFiles) {
        this.progressReporter = progressReporter;
        this.language = language;
        this.totalNumFiles = totalNumFiles;
    }

    @Override
    public void addedFile(int i) {
        // All files are added while we still are on phase 0 - INIT, i.e. before the phase is updated to phase 1 - HASH.
        this.numFilesAdded += i;
        updateAndReportCompletePercentage();
    }

    @Override
    public void phaseUpdate(int i) {
        this.currentPhase = i;
        updateAndReportCompletePercentage();
    }

    private void updateAndReportCompletePercentage() {
        this.progressReporter.updateProgressForLanguage(this.language, calculateCompletePercentage());
        this.progressReporter.reportOverallProgress();
    }

    private float calculateCompletePercentage() {
        if (this.currentPhase == CPDListener.INIT) {
            // Using Math.min just in case the totalNumFiles is inaccurate - although it shouldn't be.
            return 25*(Math.min((float) this.numFilesAdded / this.totalNumFiles, 1.0f));
        }
        return 100 * ((float) this.currentPhase / CPDListener.DONE);
    }
}
