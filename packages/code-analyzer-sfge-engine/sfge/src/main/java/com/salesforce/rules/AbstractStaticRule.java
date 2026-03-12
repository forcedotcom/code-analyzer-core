package com.salesforce.rules;

import com.salesforce.graph.ops.TraversalUtil;
import java.util.ArrayList;
import java.util.List;
import org.apache.tinkerpop.gremlin.process.traversal.dsl.graph.GraphTraversal;
import org.apache.tinkerpop.gremlin.process.traversal.dsl.graph.GraphTraversalSource;
import org.apache.tinkerpop.gremlin.structure.Vertex;

public abstract class AbstractStaticRule extends AbstractRule implements StaticRule {

    @Override
    public final List<Violation> run(GraphTraversalSource g) {
        return run(g, new ArrayList<>());
    }

    /**
     * TinkerGraph's .union() operator degrades non-linearly when given thousands of
     * sub-traversals. Splitting targets into batches of this size keeps each .union()
     * manageable and avoids the performance cliff.
     */
    private static final int BATCH_SIZE = 500;

    public final List<Violation> run(
            GraphTraversalSource g, List<AbstractRuleRunner.RuleRunnerTarget> targets) {
        if (targets.size() <= BATCH_SIZE) {
            GraphTraversal<Vertex, Vertex> eligibleVertices =
                    TraversalUtil.ruleTargetTraversal(g, targets);
            return _run(g, eligibleVertices);
        }

        int totalBatches = (targets.size() + BATCH_SIZE - 1) / BATCH_SIZE;
        List<Violation> allViolations = new ArrayList<>();

        for (int batchNum = 0; batchNum < totalBatches; batchNum++) {
            int fromIndex = batchNum * BATCH_SIZE;
            int toIndex = Math.min(fromIndex + BATCH_SIZE, targets.size());
            List<AbstractRuleRunner.RuleRunnerTarget> batch = targets.subList(fromIndex, toIndex);

            GraphTraversal<Vertex, Vertex> batchTraversal =
                    TraversalUtil.ruleTargetTraversal(g, batch);
            List<Violation> batchViolations = _run(g, batchTraversal);
            allViolations.addAll(batchViolations);
        }
        return allViolations;
    }

    /**
     * @param g
     * @param eligibleVertices - A traversal containing the vertices that are eligible for analysis
     *     by this rule. This traversal should be used as the base for any traversals done during
     *     the rule's evaluation.
     * @return
     */
    protected abstract List<Violation> _run(
            GraphTraversalSource g, GraphTraversal<Vertex, Vertex> eligibleVertices);
}
