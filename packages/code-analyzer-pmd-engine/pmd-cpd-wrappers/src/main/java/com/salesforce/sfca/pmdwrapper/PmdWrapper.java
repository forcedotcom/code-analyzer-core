package com.salesforce.sfca.pmdwrapper;

import com.google.gson.Gson;

import java.io.FileReader;
import java.io.FileWriter;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.Arrays;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Provides following commands:
 *   DESCRIBE:
 *     - Describes the available PMD rules by writing a list of PmdRuleInfo objects to a JSON file
 *     - Invocation: java -cp {classPath} com.salesforce.sfca.pmdwrapper.PmdWrapper describe {outputFile} {languages}
 *         - {classPath} is the list of entries to add to the class path
 *         - {outputFile} is a file to write the array of PmdRuleInfo objects to in JSON format
 *         - {languages} is a comma separated list of languages associated with the rules to describe
 *   RUN:
 *     - Runs the rules provided by the input ruleset file on a set of files and writes results to a JSON file
 *     - Invocation: java -cp {classPath} com.salesforce.sfca.pmdwrapper.PmdWrapper run {argsInputFile} {resultsOutputFile}
 *         - {classPath} is the list of entries to add to the class path
 *         - {argsInputFile} is a JSON file containing the input arguments for the run command.
 *             Example:
 *                  {
 *                      "ruleSetInputFile": "/some/rulesetFileForRulesToRun.xml",
 *                      "runDataPerLanguage": {
 *                          "apex": {
 *                              "filesToScan": ["/full/path/to/apex_file1.cls", "/full/path/to/apex_file2.trigger", ...]
 *                          },
 *                          ...,
 *                          "xml": {
 *                              "filesToScan": ["/full/path/to/xml_file1.xml", "/full/path/to/xml_file2.xml", ...]
 *                          }
 *                      }
 *                  }
 *         - {resultsOutputFile} is a file to write the JSON formatted PMD results to
 *             Example:
 *                 {
 *                     "files": [
 *                         {
 *                             "filename": "/full/path/to/apex_file1.cls",
 *                             "violations": [
 *                                 {
 *                                     "beginline": 16,
 *                                     "begincolumn": 14,
 *                                     "endline": 79,
 *                                     "endcolumn": 1,
 *                                     "description": "Some Violation Message",
 *                                     "rule": "ClassNamingConventions"
 *                                 },
 *                                 ...
 *                             ]
 *                         },
 *                         ...
 *                     ],
 *                     "processingErrors": [
 *                         {
 *                             "filename": "/full/path/to/apex_file2.cls",
 *                             "message": "SomeMessage",
 *                             "details": "SomeDetails"
 *                         }
 *                     ]
 *                 }
 *   AST-DUMP:
 *     - Generates Abstract Syntax Tree representation of a source file in XML format
 *     - Invocation: java -cp {classPath} com.salesforce.sfca.pmdwrapper.PmdWrapper ast-dump {argsInputFile} {resultsOutputFile}
 *         - {classPath} is the list of entries to add to the class path
 *         - {argsInputFile} is a JSON file containing the input arguments for the ast-dump command.
 *             Example:
 *                  {
 *                      "language": "apex",
 *                      "fileToDump": "/full/path/to/MyClass.cls",
 *                      "encoding": "UTF-8"
 *                  }
 *         - {resultsOutputFile} is a file to write the JSON formatted AST dump results to
 *             Example (success):
 *                 {
 *                     "file": "/full/path/to/MyClass.cls",
 *                     "ast": "<?xml version='1.0'?>\n<ApexClass>...",
 *                     "error": null
 *                 }
 *             Example (error):
 *                 {
 *                     "file": "/full/path/to/MyClass.cls",
 *                     "ast": null,
 *                     "error": {
 *                         "file": "/full/path/to/MyClass.cls",
 *                         "message": "ParseException: Unexpected token",
 *                         "detail": "..."
 *                     }
 *                 }
 */

public class PmdWrapper {
    private PmdWrapper() {}

    public static void main(String[] args) {
        long startTime = System.currentTimeMillis();
        System.out.println("START OF CALL TO \"PmdWrapper\" WITH ARGUMENTS: " + String.join(" ", args));

        if (args.length == 0) {
            throw new RuntimeException("Missing arguments to PmdWrapper.");
        } else if(args[0].equalsIgnoreCase("describe")) {
            invokeDescribeCommand(Arrays.copyOfRange(args, 1, args.length));
        } else if(args[0].equalsIgnoreCase("run")) {
            invokeRunCommand(Arrays.copyOfRange(args, 1, args.length));
        } else if(args[0].equalsIgnoreCase("ast-dump")) {
            invokeAstDumpCommand(Arrays.copyOfRange(args, 1, args.length));
        } else {
            throw new RuntimeException("Bad first argument to PmdWrapper. Expected \"describe\", \"run\", or \"ast-dump\". Received: \"" + args[0] + "\"");
        }

        long endTime = System.currentTimeMillis();
        System.out.println("END OF CALL TO \"PmdWrapper\": " + (endTime - startTime) + " milliseconds");
    }

    private static void invokeDescribeCommand(String[] args) {
        if (args.length != 3) {
            throw new RuntimeException("Invalid number of arguments following the \"describe\" command. Expected 3 but received: " + args.length);
        }

        String outFile = args[0];
        List<String> customRulesets = getCustomRulesetsFromFile(args[1]);
        Set<String> languages = Arrays.stream(args[2].toLowerCase().split(",")).collect(Collectors.toSet());

        PmdRuleDescriber ruleDescriber = new PmdRuleDescriber();
        List<PmdRuleInfo> pmdRuleInfoList = ruleDescriber.describeRulesFor(customRulesets, languages);

        Gson gson = new Gson();
        try (FileWriter fileWriter = new FileWriter(outFile)) {
            gson.toJson(pmdRuleInfoList, fileWriter);
        } catch (IOException e) {
            throw new RuntimeException(e);
        }
    }

    private static List<String> getCustomRulesetsFromFile(String file) {
        Path path = Paths.get(file);
        try {
            return Files.readAllLines(path).stream()
                    .map(String::trim)
                    .filter(line -> !line.isEmpty())
                    .collect(Collectors.toList());
        } catch (IOException e) {
            throw new RuntimeException("Could not read contents of " + file, e);
        }
    }

    private static void invokeRunCommand(String[] args) {
        if (args.length != 2) {
            throw new RuntimeException("Invalid number of arguments following the \"run\" command. Expected 2 but received: " + args.length);
        }
        String argsInputFile = args[0];
        String resultsOutputFile = args[1];

        Gson gson = new Gson();

        PmdRunInputData inputData;
        try (FileReader reader = new FileReader(argsInputFile)) {
            inputData = gson.fromJson(reader, PmdRunInputData.class);
        } catch (Exception e) {
            throw new RuntimeException("Could not read contents from \"" + argsInputFile + "\"", e);
        }

        PmdRunner pmdRunner = new PmdRunner();
        PmdRunResults results;
        try {
            results = pmdRunner.run(inputData);
        } catch (Exception e) {
            throw new RuntimeException("Error while attempting to invoke PmdRunner.run: " + e.getMessage(), e);
        }

        try (FileWriter fileWriter = new FileWriter(resultsOutputFile)) {
            gson.toJson(results, fileWriter);
        } catch (IOException e) {
            throw new RuntimeException(e);
        }
    }

    private static void invokeAstDumpCommand(String[] args) {
        if (args.length != 2) {
            throw new RuntimeException("Invalid number of arguments following the \"ast-dump\" command. Expected 2 but received: " + args.length);
        }
        String argsInputFile = args[0];
        String resultsOutputFile = args[1];

        Gson gson = new Gson();

        // Read input data
        PmdAstDumpInputData inputData;
        try (FileReader reader = new FileReader(argsInputFile)) {
            inputData = gson.fromJson(reader, PmdAstDumpInputData.class);
        } catch (Exception e) {
            throw new RuntimeException("Could not read contents from \"" + argsInputFile + "\"", e);
        }

        // Execute AST dump
        PmdAstDumper astDumper = new PmdAstDumper();
        PmdAstDumpResults results;
        try {
            results = astDumper.dump(inputData);
        } catch (Exception e) {
            throw new RuntimeException("Error while attempting to invoke PmdAstDumper.dump: " + e.getMessage(), e);
        }

        // Write results
        try (FileWriter fileWriter = new FileWriter(resultsOutputFile)) {
            gson.toJson(results, fileWriter);
        } catch (IOException e) {
            throw new RuntimeException(e);
        }
    }
}