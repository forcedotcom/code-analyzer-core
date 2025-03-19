package com.salesforce.security.pmd.apex;

import com.salesforce.security.pmd.apex.utils.PMDApexUtils;
import net.sourceforge.pmd.lang.apex.ast.ASTMethodCallExpression;
import net.sourceforge.pmd.lang.apex.rule.AbstractApexRule;
import net.sourceforge.pmd.reporting.RuleContext;

public class DetectInvalidCRUDContentDistribution extends AbstractApexRule {

    private static final String CD_CREATEABLE =
            "Schema.SObjectType.ContentDistribution.isCreateable";
    private static final String CD_DELETABLE =
            "Schema.SObjectType.ContentDistribution.isDeletable";
    private static final String CD_UPDATEABLE =
            "Schema.SObjectType.ContentDistribution.isUpdateable";
    private static final String CD_ACCESSIBLE =
            "Schema.SObjectType.ContentDistribution.isAccessible";
    private static final String CD_CRUD_VIOLATION =
            "Do not use Schema.DescribeSObjectResult methods"
            + " to enforce CRUD check on ContentDistribution";

    @Override
    public void start(RuleContext ctx) {
        //todo: write note about internal rules
        super.start(ctx);
    }

    @Override
    public Object visit(ASTMethodCallExpression node, Object data) {

        if (PMDApexUtils.isTestBlock(node)) {
            return true;
        }

        String fullName = node.getFullMethodName();
        if (fullName.compareToIgnoreCase(CD_ACCESSIBLE) == 0 
            || fullName.compareToIgnoreCase(CD_CREATEABLE) == 0
            || fullName.compareToIgnoreCase(CD_DELETABLE) == 0
            || fullName.compareToIgnoreCase(CD_UPDATEABLE) == 0)
        {
            this.asCtx(data).addViolationWithMessage(node, CD_CRUD_VIOLATION);
        }

        return data;
    }
}
