package com.salesforce.rules.databaseoperationsmustusewithsharing;

import com.salesforce.exception.ProgrammingException;
import com.salesforce.graph.ApexPath;
import com.salesforce.graph.symbols.CloningSymbolProvider;
import com.salesforce.graph.symbols.SymbolProvider;
import com.salesforce.graph.vertex.*;
import com.salesforce.graph.visitor.ApexPathWalker;
import com.salesforce.rules.Violation;
import com.salesforce.rules.ops.DatabaseOperationUtil;
import com.salesforce.rules.ops.boundary.SharingPolicyBoundaryDetector;
import java.util.Set;
import org.apache.tinkerpop.gremlin.process.traversal.dsl.graph.GraphTraversalSource;

public class DatabaseOperationsMustUseWithSharingHandler {

    public boolean test(BaseSFVertex vertex) {
        return DatabaseOperationUtil.isDatabaseOperation(vertex);
    }

    public Set<Violation.PathBasedRuleViolation> detectViolations(
            GraphTraversalSource g, ApexPath path, BaseSFVertex dbOpVertex) {

        final BaseSFVertex sourceVertex = path.getMethodVertex().orElse(null);

        if (!(DatabaseOperationUtil.isDatabaseOperation(dbOpVertex))) {
            throw new ProgrammingException(
                    "SharingRule unexpected invoked on an instance"
                            + "that's not a MethodCallExpressionVertex within the Database class, "
                            + "DmlStatementVertex, nor SoqlExpressionVertex. vertex="
                            + dbOpVertex);
        }

        // boundaryManager needs to be shared with both the rule visitor and the symbol visitor
        SharingPolicyBoundaryDetector boundaryManager = new SharingPolicyBoundaryDetector();

        final DatabaseOperationsMustUseWithSharingVisitor ruleVisitor =
                new DatabaseOperationsMustUseWithSharingVisitor(
                        boundaryManager, sourceVertex, dbOpVertex);

        final SharingPolicySymbolProviderVertexVisitor symbolVisitor =
                new SharingPolicySymbolProviderVertexVisitor(g, boundaryManager, sourceVertex);

        final SymbolProvider symbols = new CloningSymbolProvider(symbolVisitor.getSymbolProvider());

        ApexPathWalker.walkPath(g, path, ruleVisitor, symbolVisitor, symbols);

        return ruleVisitor.getViolations();
    }

    public static DatabaseOperationsMustUseWithSharingHandler getInstance() {
        return DatabaseOperationsMustUseWithSharingHandler.LazyHolder.INSTANCE;
    }

    private static final class LazyHolder {
        // postpone initialization until after first use
        private static final DatabaseOperationsMustUseWithSharingHandler INSTANCE =
                new DatabaseOperationsMustUseWithSharingHandler();
    }
}
