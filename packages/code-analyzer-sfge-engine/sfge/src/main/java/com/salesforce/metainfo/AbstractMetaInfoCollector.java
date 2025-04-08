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
    protected final TreeSet<String> collectedMetaInfo;
    private final TreeSet<String> acceptedExtensions = getAcceptedExtensions();
    private boolean projectFilesLoaded;

    AbstractMetaInfoCollector() {
        this.collectedMetaInfo = CollectionUtil.newTreeSet();
    }

    /**
     * @return Accepted file extensions of the project files
     */
    protected abstract TreeSet<String> getAcceptedExtensions();

    /** Process file to collect meta info from non-apex project file */
    protected abstract void processProjectFile(Path path);

    // TODO: The method should (if possible) be rewritten so that it searches the provided workspace files for relevant files,
    //       instead of checking parent directories. It is possible that this may cause test failures. We will see what happens.
    @Override
    public synchronized void loadProjectFiles(List<String> sourceFoldersAndFiles)
            throws MetaInfoLoadException {
        if (projectFilesLoaded) {
            throw new ProgrammingException("Project files already loaded");
        }
        final long start = System.currentTimeMillis();
        for (String sourceFolderOrFile : sourceFoldersAndFiles) {
            processSourceFolderOrFile(sourceFolderOrFile);
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

    private void processSourceFolderOrFile(String sourceFolder) throws MetaInfoLoadException {
        Path path = new File(sourceFolder).toPath();
        final ProjectFileVisitor projectFileVisitor = new ProjectFileVisitor();
        try {
            Files.walkFileTree(path, projectFileVisitor);
        } catch (IOException ex) {
            // This should only happen if something really odd happens in the traversal. Rethrow it
            // as our custom
            // exception.
            throw new MetaInfoLoadException("Failed to load project files", ex);
        }
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
