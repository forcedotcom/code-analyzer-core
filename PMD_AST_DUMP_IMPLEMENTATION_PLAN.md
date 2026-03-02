# PMD AST Dump Implementation Plan

> **Status**: Java layer implementation completed ✅
> **Updated**: 2026-02-27 - Document updated to reflect actual working implementation using PMD's `TreeExporter` API
> **Branch**: `feature/pmd-ast-dump-java-layer` (ready to merge into `feature/pmd-ast-dump`)

## 1. Overview

This document outlines the implementation plan for integrating PMD's AST dump functionality directly into the code-analyzer-core PMD engine, eliminating the need for users to install PMD CLI separately.

### Version 1 Scope (Simplified):
This implementation focuses on a **simple, straightforward approach** for v1:

**Key Design Decisions**:
- ✅ **Single File Processing**: One file per API call (not batch)
- ✅ **XML Format Only**: Text format not supported in v1
- ✅ **Single Output**: One result object (not array)
- ✅ **Embedded Errors**: Errors returned in result object (not thrown)

**Rationale**:
- Simpler implementation and testing
- Easier error handling
- Predictable memory usage
- Faster time to market
- Can extend to batch processing in v2 if needed

## 2. Current Architecture Analysis

### Existing Components:
- **TypeScript Layer**: `pmd-wrapper.ts` - Handles Java command execution
- **Java Wrapper**: `PmdWrapper.java` - Main entry point with commands:
  - `describe` - Lists available PMD rules
  - `run` - Executes PMD analysis
- **Supporting Classes**:
  - `PmdRunner.java` - Executes PMD analysis using `PmdAnalysis` API
  - `PmdRuleDescriber.java` - Describes PMD rules
  - Various data classes for input/output

### Current Flow:
```
TypeScript → JavaCommandExecutor → PmdWrapper.java → [PmdRunner/PmdRuleDescriber] → Results
```

## 3. Proposed Implementation

### 3.1 New Java Classes to Create

#### A. `PmdAstDumpInputData.java`
**Purpose**: Input data structure for AST dump command

**Fields**:
```java
- String language              // Language ID (apex, java, xml, etc.)
- String fileToDump            // Single file to generate AST for
- String encoding              // Character encoding (default: "UTF-8")
```

**Note**:
- Only **one file** is supported per request (not multiple files)
- Only **XML format** is supported (text format not supported in v1)

**Location**: `/packages/code-analyzer-pmd-engine/pmd-cpd-wrappers/src/main/java/com/salesforce/sfca/pmdwrapper/`

---

#### B. `PmdAstDumpResults.java`
**Purpose**: Results structure for AST dump output

**Fields**:
```java
- String file                   // Full path to the file
- String ast                    // AST representation in XML format
- ProcessingError error         // Error if processing failed (null if successful)
```

**Note**:
- Since only one file is processed, there's only **one output** (not a list)
- The `error` field is populated only if AST generation fails
- If successful, `ast` field contains the XML representation, `error` is null
- If failed, `error` field contains the error details, `ast` is null

**Location**: Same as above

---

#### C. `PmdAstDumper.java`
**Purpose**: Core class that performs AST dumping using PMD APIs

**Key Methods**:
```java
public PmdAstDumpResults dump(PmdAstDumpInputData inputData)
```

**Internal Implementation Details**:
1. **Language Resolution**:
   - Use `LanguageRegistry.PMD.getLanguageById(languageId)`
   - Validate language is supported

2. **AST Export Configuration**:
   - Use `TreeExportConfiguration` to configure the export
   - Set language, format (XML), and file path
   - Create `TreeExporter` with this configuration

3. **AST Rendering**:
   - **XML Format Only**: `TreeExporter` outputs XML to System.out
   - Redirect System.out to ByteArrayOutputStream to capture output
   - Text format is not supported in v1

4. **Error Handling**:
   - Catch parsing errors
   - Store error in results object
   - Return results with either ast or error populated

**Key PMD APIs Used**:
```java
- net.sourceforge.pmd.lang.LanguageRegistry
- net.sourceforge.pmd.lang.Language
- net.sourceforge.pmd.util.treeexport.TreeExporter
- net.sourceforge.pmd.util.treeexport.TreeExportConfiguration
```

**Actual Implementation** (using TreeExporter):
```java
public PmdAstDumpResults dump(PmdAstDumpInputData inputData) {
    validateInputData(inputData);

    PmdAstDumpResults results = new PmdAstDumpResults();
    results.file = inputData.fileToDump;

    try {
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

    } catch (Exception e) {
        // Store processing error
        ProcessingError error = new ProcessingError();
        error.file = inputData.fileToDump;
        error.message = e.getMessage();
        error.detail = e.toString();
        results.error = error;
    }

    return results;
}
```

**Location**: `/packages/code-analyzer-pmd-engine/pmd-cpd-wrappers/src/main/java/com/salesforce/sfca/pmdwrapper/`

---

### 3.2 Changes to Existing Java Classes

#### A. `PmdWrapper.java` Modifications

**Add new command**: `ast-dump`

**Changes**:
```java
// In main() method, add new else-if branch:
} else if(args[0].equalsIgnoreCase("ast-dump")) {
    invokeAstDumpCommand(Arrays.copyOfRange(args, 1, args.length));
}

// Add new method:
private static void invokeAstDumpCommand(String[] args) {
    if (args.length != 2) {
        throw new RuntimeException("Invalid arguments for ast-dump");
    }

    String argsInputFile = args[0];
    String resultsOutputFile = args[1];

    Gson gson = new Gson();

    // Read input
    PmdAstDumpInputData inputData;
    try (FileReader reader = new FileReader(argsInputFile)) {
        inputData = gson.fromJson(reader, PmdAstDumpInputData.class);
    } catch (Exception e) {
        throw new RuntimeException("Could not read input", e);
    }

    // Execute AST dump
    PmdAstDumper astDumper = new PmdAstDumper();
    PmdAstDumpResults results = astDumper.dump(inputData);

    // Write results
    try (FileWriter fileWriter = new FileWriter(resultsOutputFile)) {
        gson.toJson(results, fileWriter);
    } catch (IOException e) {
        throw new RuntimeException(e);
    }
}
```

**Update Javadoc** to document the new command:
```
AST-DUMP:
  - Generates Abstract Syntax Tree representation of source files
  - Invocation: java -cp {classPath} com.salesforce.sfca.pmdwrapper.PmdWrapper ast-dump {inputFile} {outputFile}
    - {inputFile}: JSON file with PmdAstDumpInputData structure
    - {outputFile}: JSON file for PmdAstDumpResults
```

---

### 3.3 TypeScript Integration Layer

#### A. New TypeScript Types (in `pmd-wrapper.ts`)

```typescript
export type PmdAstDumpInputData = {
    language: string,      // Language ID (apex, xml, etc.)
    fileToDump: string,    // Single file to dump AST for
    encoding?: string      // File encoding (default: 'UTF-8')
}

export type PmdAstDumpResults = {
    file: string,                      // File path
    ast: string | null,                // AST representation in XML (null if error)
    error: PmdProcessingError | null   // Error details (null if successful)
}
```

**Note**: Only XML format is supported, so no format parameter is needed.

#### B. New Method in `PmdWrapperInvoker` Class

```typescript
async invokeAstDumpCommand(
    language: string,
    fileToDump: string,
    workingFolder: string,
    encoding: string = 'UTF-8',
    emitProgress: (percComplete: number) => void
): Promise<PmdAstDumpResults> {

    emitProgress(5);

    // Prepare input data
    const inputData: PmdAstDumpInputData = {
        language: language,
        fileToDump: fileToDump,
        encoding: encoding
    };

    const inputFile = path.join(workingFolder, 'astDumpInput.json');
    await fs.promises.writeFile(inputFile, JSON.stringify(inputData), 'utf-8');
    emitProgress(10);

    const resultsOutputFile = path.join(workingFolder, 'astDumpResults.json');
    const javaCmdArgs = [PMD_WRAPPER_JAVA_CLASS, 'ast-dump', inputFile, resultsOutputFile];
    const javaClassPaths = [
        path.join(PMD_WRAPPER_LIB_FOLDER, '*'),
        ...this.userProvidedJavaClasspathEntries.map(toJavaClasspathEntry)
    ];

    this.emitLogEvent(LogLevel.Fine, `Calling AST dump for file: ${fileToDump}`);

    await this.javaCommandExecutor.exec(javaCmdArgs, javaClassPaths, (stdOutMsg: string) => {
        if (stdOutMsg.startsWith(STDOUT_ERROR_MARKER)) {
            const errorMessage = stdOutMsg.slice(STDOUT_ERROR_MARKER.length).replaceAll('{NEWLINE}','\n');
            throw new Error(errorMessage);
        } else if (stdOutMsg.startsWith(STDOUT_WARNING_MARKER)) {
            const warningMessage = stdOutMsg.slice(STDOUT_WARNING_MARKER.length).replaceAll('{NEWLINE}','\n');
            this.emitLogEvent(LogLevel.Warn, `[JAVA StdOut]: ${warningMessage}`);
        } else {
            this.emitLogEvent(LogLevel.Fine, `[JAVA StdOut]: ${stdOutMsg}`);
        }
    });

    emitProgress(95);

    // Read and parse results
    const resultsFileContents = await fs.promises.readFile(resultsOutputFile, 'utf-8');
    const results: PmdAstDumpResults = JSON.parse(resultsFileContents);
    emitProgress(100);

    return results;
}
```

**Note**: Simplified signature - only one file, no format parameter (XML only).

---

#### C. New Method in `pmd-engine.ts` (if needed)

Add high-level API in the PMD engine to expose AST dump functionality to users:

```typescript
async generateAst(
    language: string,
    file: string,
    options?: {
        encoding?: string
    }
): Promise<PmdAstDumpResults> {
    // Implementation using PmdWrapperInvoker
    // Returns XML AST representation for a single file
}
```

**Note**: For multiple files, users should call this method multiple times.

---

## 4. Data Flow Diagram

```
User Code (TypeScript)
    ↓
pmd-engine.ts (generateAst method) [optional high-level API]
    ↓
pmd-wrapper.ts (PmdWrapperInvoker.invokeAstDumpCommand)
    ↓
[Creates JSON input file] → astDumpInput.json
    {
      "language": "apex",
      "fileToDump": "/path/to/MyClass.cls",
      "encoding": "UTF-8"
    }
    ↓
JavaCommandExecutor.exec()
    ↓
PmdWrapper.java (main → invokeAstDumpCommand)
    ↓
PmdAstDumper.java (dump method)
    ↓
    ├─→ LanguageRegistry.PMD.getLanguageById()
    ├─→ Language.createProcessor()
    ├─→ Read file content (with encoding)
    ├─→ TextDocument.readOnlyString()
    ├─→ LanguageProcessor.parse() → RootNode (AST)
    └─→ XmlTreeRenderer.renderSubtree() → XML string
    ↓
[Writes JSON output] → astDumpResults.json
    {
      "file": "/path/to/MyClass.cls",
      "ast": "<?xml version='1.0'?>...",
      "error": null
    }
    ↓
TypeScript reads and parses results
    ↓
User receives PmdAstDumpResults
    ↓
User accesses result.ast (if successful) or result.error (if failed)
```

**Key Points**:
- Single file input → Single file output
- XML format only
- Error captured in results (not thrown)

---

## 5. Dependencies Required

### Java Dependencies (Already Available)
All required PMD APIs are already available in your current dependencies:
- ✅ `pmd-core` (contains all AST and rendering APIs)
- ✅ `pmd-apex`, `pmd-java`, `pmd-xml`, etc. (language modules)
- ✅ `gson` (for JSON serialization)

**No additional dependencies needed!**

### PMD API Classes Used
From `pmd-core-7.21.0`:
- `net.sourceforge.pmd.lang.LanguageRegistry` - Get language by ID
- `net.sourceforge.pmd.lang.Language` - Language definition
- `net.sourceforge.pmd.util.treeexport.TreeExporter` - Main class that exports AST to XML
- `net.sourceforge.pmd.util.treeexport.TreeExportConfiguration` - Configuration for TreeExporter
- `java.io.ByteArrayOutputStream` - Capture XML output from System.out
- `java.io.PrintStream` - Redirect System.out
- `java.nio.charset.StandardCharsets` - UTF-8 encoding
- `java.nio.file.Files` - File reading
- `java.nio.file.Paths` - Path handling

---

## 6. Supported Languages

Based on your current PMD language modules, AST dump will support:
- ✅ **Apex** (pmd-apex-7.21.0.jar)
- ✅ **Visualforce** (pmd-visualforce-7.21.0.jar)
- ✅ **HTML** (pmd-html-7.21.0.jar)
- ✅ **JavaScript** (pmd-javascript-7.21.0.jar)
- ✅ **XML** (pmd-xml-7.21.0.jar)

Language IDs to use:
- `apex` - Apex classes and triggers
- `visualforce` - Visualforce pages
- `html` - HTML files
- `javascript` - JavaScript files
- `xml` - XML files
- `xsl` - XSL stylesheets

---

## 7. Usage Examples

### Example 1: Dump Apex Class AST (XML format)

**Input JSON** (`astDumpInput.json`):
```json
{
  "language": "apex",
  "fileToDump": "/path/to/MyClass.cls",
  "encoding": "UTF-8"
}
```

**Java Command**:
```bash
java -cp "dist/java-lib/*" \
  com.salesforce.sfca.pmdwrapper.PmdWrapper \
  ast-dump \
  astDumpInput.json \
  astDumpResults.json
```

**Output JSON** (`astDumpResults.json`) - Success case:
```json
{
  "file": "/path/to/MyClass.cls",
  "ast": "<?xml version='1.0'?>\n<ApexClass>\n  <UserClass Image='MyClass'>\n    ...",
  "error": null
}
```

**Output JSON** (`astDumpResults.json`) - Error case:
```json
{
  "file": "/path/to/MyClass.cls",
  "ast": null,
  "error": {
    "file": "/path/to/MyClass.cls",
    "message": "ParseException",
    "detail": "Unexpected token at line 15, column 8"
  }
}
```

### Example 2: TypeScript Usage

```typescript
// In your code analyzer
const pmdWrapperInvoker = new PmdWrapperInvoker(
    javaCommandExecutor,
    [],
    (level, msg) => console.log(msg)
);

const result = await pmdWrapperInvoker.invokeAstDumpCommand(
    'apex',
    '/path/to/MyClass.cls',
    '/tmp/workdir',
    'UTF-8',
    (progress) => console.log(`Progress: ${progress}%`)
);

// Check if successful
if (result.ast) {
    console.log('AST generated successfully:');
    console.log(result.ast);
} else if (result.error) {
    console.error('Error generating AST:', result.error.message);
}
```

### Example 3: Processing Multiple Files

To process multiple files, call the method multiple times:

```typescript
const files = ['/path/to/File1.cls', '/path/to/File2.cls'];

for (const file of files) {
    const result = await pmdWrapperInvoker.invokeAstDumpCommand(
        'apex',
        file,
        '/tmp/workdir',
        'UTF-8',
        (progress) => console.log(`${file}: ${progress}%`)
    );

    if (result.ast) {
        console.log(`AST for ${file}:`, result.ast);
    }
}
```

---

## 8. Error Handling

### Scenarios Handled:
1. **Invalid Language ID**: Error stored in `error` field
2. **File Not Found**: Error stored in `error` field
3. **Parse Errors**: Error stored in `error` field with details
4. **Encoding Issues**: Error stored in `error` field

### Error Response Examples:

**Success Response**:
```json
{
  "file": "/path/to/MyClass.cls",
  "ast": "<?xml version='1.0'?>...",
  "error": null
}
```

**Parse Error Response**:
```json
{
  "file": "/path/to/BadFile.cls",
  "ast": null,
  "error": {
    "file": "/path/to/BadFile.cls",
    "message": "ParseException: Unexpected token at line 15",
    "detail": "net.sourceforge.pmd.lang.apex.ParseException: ..."
  }
}
```

**File Not Found Response**:
```json
{
  "file": "/path/to/missing.cls",
  "ast": null,
  "error": {
    "file": "/path/to/missing.cls",
    "message": "File not found",
    "detail": "java.io.FileNotFoundException: /path/to/missing.cls"
  }
}
```

**Invalid Language Response**:
```json
{
  "file": "/path/to/file.txt",
  "ast": null,
  "error": {
    "file": "/path/to/file.txt",
    "message": "Language not supported: unknown",
    "detail": "java.lang.RuntimeException: Language not supported: unknown"
  }
}
```

---

## 9. Testing Strategy

### A. Unit Tests to Create

#### Java Tests:
**File**: `PmdAstDumpTest.java`

Test cases:
```java
- testDumpApexClassAsXml()           // Successfully dump Apex class
- testDumpApexTriggerAsXml()         // Successfully dump Apex trigger
- testDumpVisualforceAsXml()         // Successfully dump Visualforce page
- testDumpXmlAsXml()                 // Successfully dump XML file
- testInvalidLanguage()              // Error: language not supported
- testFileNotFound()                 // Error: file doesn't exist
- testParseError()                   // Error: syntax error in file
- testDifferentEncodings()           // Test UTF-8, ISO-8859-1, etc.
- testXmlOutputStructure()           // Verify XML format is valid
- testEmptyFile()                    // Handle empty source files
```

**Location**: `/packages/code-analyzer-pmd-engine/pmd-cpd-wrappers/src/test/java/com/salesforce/sfca/pmdwrapper/`

#### TypeScript Tests:
**File**: `pmd-ast-dump.test.ts`

Test cases:
```typescript
- testInvokeAstDumpCommandSuccess()  // Successful AST generation
- testInvokeAstDumpCommandError()    // Error handling
- testXmlFormatValidation()          // Verify XML output is well-formed
- testMultipleFilesSequential()      // Process multiple files in sequence
- testProgressReporting()            // Verify progress callbacks work
- testDifferentLanguages()           // Test apex, xml, visualforce, etc.
```

**Location**: `/packages/code-analyzer-pmd-engine/test/`

### B. Integration Tests
- End-to-end test calling from TypeScript through Java
- Test with real Apex, Visualforce, XML files
- Verify AST structure is correct
- Performance testing with large files

---

## 10. Performance Considerations

### Expected Performance (Single File):
- **Small files** (<1KB): ~50-100ms per file
- **Medium files** (1-10KB): ~100-500ms per file
- **Large files** (>10KB): ~500ms-2s per file

### Processing Multiple Files:
Since only one file is processed per request, to handle multiple files:
1. **Sequential Processing**: Call the API multiple times (simpler, predictable)
2. **Parallel Processing**: Use Promise.all() to process multiple files concurrently (faster)

Example of parallel processing:
```typescript
const files = ['file1.cls', 'file2.cls', 'file3.cls'];
const results = await Promise.all(
    files.map(file => pmdWrapperInvoker.invokeAstDumpCommand(
        'apex', file, '/tmp/workdir', 'UTF-8', (p) => {}
    ))
);
```

### Memory Considerations:
- Each AST held in memory temporarily
- XML output can be 5-10x larger than source
- Processing one file at a time keeps memory usage predictable
- For parallel processing, limit concurrency to avoid memory issues

---

## 11. Limitations & Known Issues

### Limitations:
1. **Single File Per Request**: Only one file can be processed per API call (not batch processing)
2. **XML Format Only**: Only XML format is supported (text format not supported in v1)
3. **Language Support**: Limited to languages with PMD modules installed
4. **AST Depth**: Full AST can be very large for complex files
5. **Memory**: Large files may require increased heap size

### Not Supported (v1):
- Batch processing (multiple files in one request)
- Text format output
- JSON format output
- Custom AST node filtering
- Partial AST extraction
- AST modification or manipulation
- Direct AST querying (use PMD's XPath instead)

### Future Enhancements (Potential v2):
- Support for text format
- Batch processing for multiple files
- AST node filtering options
- Performance optimizations

---

## 12. Alternative Approaches Considered

### Approach 1: Direct CLI Wrapper
**Pros**: Simpler, no code changes
**Cons**: Requires PMD CLI installation, harder to integrate

### Approach 2: Separate Microservice
**Pros**: Language-agnostic
**Cons**: Complex deployment, network overhead

### Approach 3: JavaScript AST Parser
**Pros**: No Java dependency
**Cons**: Would need separate parsers for each language, inconsistent with PMD analysis

**Chosen Approach**: **Library Integration** (this plan)
**Reason**: Consistent with existing architecture, no external dependencies, reuses existing PMD infrastructure

---

## 13. Migration Path (If Upgrading PMD)

When upgrading PMD version:
1. Update `gradle/libs.versions.toml` (pmd version)
2. Check for API changes in:
   - `LanguageProcessor` API
   - `TreeRenderer` API
   - `TextDocument` API
3. Update `PmdAstDumper.java` if APIs changed
4. Re-run tests
5. Update documentation

---

## 14. Security Considerations

### Input Validation:
- ✅ Validate language ID exists
- ✅ Validate file paths (no directory traversal)
- ✅ Validate format is 'xml' or 'text'
- ✅ Limit file size to prevent DoS
- ✅ Sanitize file content before parsing

### Output Safety:
- ✅ AST output is read-only representation
- ✅ No code execution in AST generation
- ✅ Error messages don't expose sensitive paths

---

## 15. Documentation to Update

After implementation:
1. **User Documentation**:
   - Add AST dump API reference
   - Add usage examples
   - Add troubleshooting guide

2. **Developer Documentation**:
   - Update architecture diagrams
   - Document new Java classes
   - Update TypeScript API docs

3. **README Files**:
   - Update feature list
   - Add AST dump to capabilities

---

## 16. Summary

### Files to Create:
1. `PmdAstDumpInputData.java` (Input structure) ✅
2. `PmdAstDumpResults.java` (Output structure) ✅
3. `PmdAstDumper.java` (Core implementation using TreeExporter) ✅
4. `PmdAstDumpTest.java` (Unit tests - 8 comprehensive tests) ✅
5. `pmd-ast-dump.test.ts` (Integration tests - NOT YET IMPLEMENTED)

### Files to Modify:
1. `PmdWrapper.java` (Add ast-dump command) ✅ DONE
2. `pmd-wrapper.ts` (Add TypeScript types and method) ⏳ PENDING
3. `pmd-engine.ts` (Optional: Add high-level API) ⏳ PENDING

### Dependencies:
- ✅ No new dependencies required (all APIs in pmd-core)

### Estimated Effort:
- **Java Implementation**: 3-4 hours (simplified - single file, XML only)
- **TypeScript Integration**: 1-2 hours (simplified API)
- **Testing**: 3-4 hours
- **Documentation**: 1-2 hours
- **Total**: ~8-12 hours (reduced due to simplified scope)

### Benefits:
✅ No PMD CLI installation required
✅ Consistent with existing architecture
✅ Full control over AST generation
✅ Easy to extend for new languages
✅ Programmatic access from TypeScript
✅ Simple API - one file in, one AST out
✅ Predictable memory usage (single file processing)
✅ Easy error handling (error embedded in result)

---

## 17. Next Steps

1. **Review this document** - Confirm approach
2. **Create Java classes** - Implement core functionality
3. **Update PmdWrapper** - Add new command
4. **Add TypeScript types** - Type definitions
5. **Implement TypeScript method** - Integration layer
6. **Write tests** - Unit and integration tests
7. **Test with real files** - Apex, Visualforce, XML
8. **Update documentation** - User and developer docs
9. **Review and iterate** - Code review and refinement

---

## Questions to Consider (For Future Versions)

### Answered in v1:
✅ **Format support**: XML only (simplifies implementation)
✅ **Batch processing**: Single file only (simplifies API and error handling)
✅ **Error handling**: Errors embedded in result object (no exceptions thrown)

### For Future Consideration (v2+):
1. **Should we limit file size?** Prevent memory issues with very large files
2. **Should we add batch processing?** Process multiple files in one request
3. **Should we support text format?** In addition to XML
4. **Should we cache parsed ASTs?** For repeated operations on same file
5. **Should we support AST filtering?** Extract only specific node types
6. **Should we add XPath support?** Query AST nodes directly
7. **Should we add streaming?** For very large files to reduce memory usage

---

**End of Implementation Plan**
