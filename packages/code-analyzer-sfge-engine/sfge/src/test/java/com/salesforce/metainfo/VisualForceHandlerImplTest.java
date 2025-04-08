package com.salesforce.metainfo;

import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.containsInAnyOrder;
import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.not;

import com.salesforce.TestUtil;
import com.salesforce.graph.ops.GraphUtil;

import java.nio.file.Path;
import java.util.Arrays;
import java.util.Collections;
import java.util.Set;
import org.apache.tinkerpop.gremlin.process.traversal.dsl.graph.GraphTraversalSource;
import org.hamcrest.MatcherAssert;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInfo;

public class VisualForceHandlerImplTest {
    private GraphTraversalSource g;

    @BeforeEach
    public void setup() throws Exception {
        g = GraphUtil.getGraph();
    }

    @Test
    public void loadVisualForce_testWithRootFolder(TestInfo testInfo) throws Exception {
        TestUtil.compileTestFiles(g, testInfo);
        try {
            MetaInfoCollectorTestProvider.setVisualForceHandler(new VisualForceHandlerImpl());
            String rootFolder = TestUtil.getTestFileDirectory(testInfo).resolve("root").toString();
            MetaInfoCollector metaInfoCollector = MetaInfoCollectorProvider.getVisualForceHandler();
            metaInfoCollector.loadProjectFiles(Collections.singletonList(rootFolder));
            Set<String> referencedNames = metaInfoCollector.getMetaInfoCollected();
            // When given a folder whose subdirectories contain VF pages and corresponding VF controllers,
            // the appropriate controllers are picked up.
            MatcherAssert.assertThat(referencedNames, hasSize(equalTo(1)));
            MatcherAssert.assertThat(referencedNames, contains("MyController"));
        } finally {
            MetaInfoCollectorTestProvider.removeVisualForceHandler();
        }
    }

    @Test
    public void loadVisualForce_testWithClassFolder(TestInfo testInfo) throws Exception {
        TestUtil.compileTestFiles(g, testInfo);
        try {
            MetaInfoCollectorTestProvider.setVisualForceHandler(new VisualForceHandlerImpl());
            String classes = TestUtil.getTestFileDirectory(testInfo).resolve("classes").toString();
            MetaInfoCollector metaInfoCollector = MetaInfoCollectorProvider.getVisualForceHandler();
            metaInfoCollector.loadProjectFiles(Collections.singletonList(classes));
            Set<String> referencedNames = metaInfoCollector.getMetaInfoCollected();
            // When provided with just a folder containing Apex, we don't identify any controllers.
            MatcherAssert.assertThat(referencedNames, hasSize(equalTo(0)));
        } finally {
            MetaInfoCollectorTestProvider.removeVisualForceHandler();
        }
    }

    @Test
    public void loadVisualForce_testWithIndividualApexFiles(TestInfo testInfo) throws Exception {
        TestUtil.compileTestFiles(g, testInfo);
        try {
            MetaInfoCollectorTestProvider.setVisualForceHandler(new VisualForceHandlerImpl());
            String[] sourceFiles = new String[]{
                TestUtil.getTestFileDirectory(testInfo).resolve(Path.of("classes", "MyController.cls")).toString(),
                TestUtil.getTestFileDirectory(testInfo).resolve(Path.of("classes", "MyNonController.cls")).toString()
            };
            MetaInfoCollector metaInfoCollector = MetaInfoCollectorProvider.getVisualForceHandler();
            metaInfoCollector.loadProjectFiles(Arrays.asList(sourceFiles));
            Set<String> referencedNames = metaInfoCollector.getMetaInfoCollected();
            // When provided with individual apex files, the controllers will not be automatically identified.
            MatcherAssert.assertThat(referencedNames, hasSize(equalTo(0)));
        } finally {
            MetaInfoCollectorTestProvider.removeVisualForceHandler();
        }
    }

    @Test
    public void loadVisualForce_testWithIndividualApexAndVfFiles(TestInfo testInfo) throws Exception {
        TestUtil.compileTestFiles(g, testInfo);
        try {
            MetaInfoCollectorTestProvider.setVisualForceHandler(new VisualForceHandlerImpl());
            String[] sourceFiles = new String[]{
                TestUtil.getTestFileDirectory(testInfo).resolve(Path.of("classes", "MyController.cls")).toString(),
                TestUtil.getTestFileDirectory(testInfo).resolve(Path.of("classes", "MyNonController.cls")).toString(),
                TestUtil.getTestFileDirectory(testInfo).resolve(Path.of("pages", "MyVfPage.page")).toString()
            };
            MetaInfoCollector metaInfoCollector = MetaInfoCollectorProvider.getVisualForceHandler();
            metaInfoCollector.loadProjectFiles(Arrays.asList(sourceFiles));
            Set<String> referencedNames = metaInfoCollector.getMetaInfoCollected();
            // When provided with individual apex and vf files, the controllers will be automatically identified.
            MatcherAssert.assertThat(referencedNames, hasSize(equalTo(1)));
            MatcherAssert.assertThat(referencedNames, contains("MyController"));
        } finally {
            MetaInfoCollectorTestProvider.removeVisualForceHandler();
        }
    }

    @Test
    public void loadVisualForce_testWithMalformedVf(TestInfo testInfo) throws Exception {
        TestUtil.compileTestFiles(g, testInfo);
        try {
            MetaInfoCollectorTestProvider.setVisualForceHandler(new VisualForceHandlerImpl());
            String classes = TestUtil.getTestFileDirectory(testInfo).resolve("root").toString();
            MetaInfoCollector metaInfoCollector = MetaInfoCollectorProvider.getVisualForceHandler();
            metaInfoCollector.loadProjectFiles(Collections.singletonList(classes));
            Set<String> referencedNames = metaInfoCollector.getMetaInfoCollected();
            // A malformed VF file should be skipped without crashing the process.
            MatcherAssert.assertThat(referencedNames, hasSize(equalTo(1)));
            MatcherAssert.assertThat(referencedNames, contains("MyController"));
        } finally {
            MetaInfoCollectorTestProvider.removeVisualForceHandler();
        }
    }

    @Test
    public void loadVisualForce_testWithIntenselyCommentedVf(TestInfo testInfo) throws Exception {
        TestUtil.compileTestFiles(g, testInfo);
        try {
            MetaInfoCollectorTestProvider.setVisualForceHandler(new VisualForceHandlerImpl());
            String classes = TestUtil.getTestFileDirectory(testInfo).resolve("root").toString();
            MetaInfoCollector metaInfoCollector = MetaInfoCollectorProvider.getVisualForceHandler();
            metaInfoCollector.loadProjectFiles(Collections.singletonList(classes));

            Set<String> referencedNames = metaInfoCollector.getMetaInfoCollected();
            MatcherAssert.assertThat(referencedNames, hasSize(equalTo(2)));
            MatcherAssert.assertThat(
                    referencedNames,
                    containsInAnyOrder(
                            "PageWithMultipleInlineCommentsCtrl_expectIncluded",
                            "PageWithMultilineCommentsCtrl_expectIncluded"));
            MatcherAssert.assertThat(
                    referencedNames, not(contains("PageWithCommentedTagCtrl_expectExcluded")));
        } finally {
            MetaInfoCollectorTestProvider.removeVisualForceHandler();
        }
    }
}
