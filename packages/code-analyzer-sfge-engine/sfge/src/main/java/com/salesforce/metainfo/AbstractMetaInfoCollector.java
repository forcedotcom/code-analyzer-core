package com.salesforce.metainfo;

import com.salesforce.collections.CollectionUtil;
import com.salesforce.exception.ProgrammingException;
import java.io.File;
import java.io.IOException;
import java.nio.file.FileVisitResult;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.SimpleFileVisitor;
import java.nio.file.attribute.BasicFileAttributes;
import java.util.Arrays;
import java.util.List;
import java.util.TreeSet;
import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;

/**
 * Performs common steps needed for an implementation of {@link MetaInfoCollector} such as
 * identifying parent directory of apex classes as well as visiting interested file paths.
 */
public abstract class AbstractMetaInfoCollector implements MetaInfoCollector {
    private static final Logger LOGGER = LogManager.getLogger(AbstractMetaInfoCollector.class);
    private static final String APEX_FILE_EXTENSION = ".cls";
    protected final TreeSet<String> collectedMetaInfo;
    private final TreeSet<String> acceptedExtensions = getAcceptedExtensions();
    private final TreeSet<String> pathsWalked;
    private boolean projectFilesLoaded;

    AbstractMetaInfoCollector() {
        this.collectedMetaInfo = CollectionUtil.newTreeSet();
        this.pathsWalked = CollectionUtil.newTreeSet();
    }

    /**
     * @return Accepted file extensions of the project files
     */
    protected abstract TreeSet<String> getAcceptedExtensions();

    /** Process file to collect meta info from non-apex project file */
    protected abstract void processProjectFile(Path path);

    @Override
    public synchronized void loadProjectFiles(List<String> sourceFolders)
            throws MetaInfoLoadException {
        if (projectFilesLoaded) {
            throw new ProgrammingException("Project files already loaded");
        }
        final long start = System.currentTimeMillis();
        for (String sourceFolder : sourceFolders) {
            processSourceFolder(sourceFolder);
        }
        if (LOGGER.isInfoEnabled()) {
            LOGGER.info("Took: " + (System.currentTimeMillis() - start) + "ms");
        }
        projectFilesLoaded = true;
    }

    @Override
    public TreeSet<String> getMetaInfoCollected() {
        return collectedMetaInfo;
    }

    private void processSourceFolder(String sourceFolder) throws MetaInfoLoadException {
        Path path = new File(sourceFolder).toPath();
        if (isDirectoryContainingApex(path)) {
            // If the path is a directory with apex files in it, we should assume it's the `classes` folder, and that project
            // files like VF components or object metadata are in a sibling. So we'll go up a level before walking the file tree.
            path = path.getParent();
        } else if (isApexFile(path)) {
            // If the path itself is an apex file, we should assume that it is contained in the `classes` folder, and that
            // project files like VF components or object metadata are in a sibling of its parent directory. So we'll go
            // up two levels before walking the file tree.
            path = path.getParent().getParent();
        }
        final ProjectFileVisitor projectFileVisitor = new ProjectFileVisitor();
        if (this.pathsWalked.contains(path.toString())) {
            return;
        }
        this.pathsWalked.add(path.toString());
        try {
            Files.walkFileTree(path, projectFileVisitor);
        } catch (IOException ex) {
            // This should only happen if something really odd happens in the traversal. Rethrow it
            // as our custom
            // exception.
            throw new MetaInfoLoadException("Failed to load project files", ex);
        }
    }

    private boolean isDirectoryContainingApex(Path path) {
        final File dir = path.toFile();
        // Non-directories obviously don't have any apex.
        if (!dir.isDirectory()) {
            return false;
        }

        final File[] dirContents = dir.listFiles();
        // If the directory has no contents, it doesn't contain any apex.
        if (dirContents == null) {
            return false;
        }

        // If the directory contains any '.cls' files, then it's got apex.
        return Arrays.stream(dirContents).anyMatch(f -> f.getName().endsWith(APEX_FILE_EXTENSION));
    }

    private boolean isApexFile(Path path) {
        final File file = path.toFile();

        if (!file.isFile()) {
            return false;
        }
        return file.getName().endsWith(APEX_FILE_EXTENSION);
    }

    protected boolean pathMatches(Path path) {
        final String pathExtension = getPathExtension(path);
        return acceptedExtensions.contains(pathExtension);
    }

    private String getPathExtension(Path path) {
        final String fileName = path.getFileName().toString();
        if (fileName.contains(".")) {
            return fileName.substring(fileName.lastIndexOf('.'));
        } else {
            return "";
        }
    }

    private final class ProjectFileVisitor extends SimpleFileVisitor<Path> {
        @Override
        public FileVisitResult visitFile(final Path file, final BasicFileAttributes attrs) {
            processProjectFile(file);
            return FileVisitResult.CONTINUE;
        }
    }
}
