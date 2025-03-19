package com.salesforce.security.pmd.apex;

import com.salesforce.security.pmd.apex.utils.PMDApexUtils;

import net.sourceforge.pmd.lang.apex.ast.ASTLiteralExpression;
import net.sourceforge.pmd.lang.apex.rule.AbstractApexRule;

public class UnauthorizedUseOfApiSessionId extends AbstractApexRule {
  
    private static final String API_SESSION_ID = "{!API.Session_ID}";
    private static final String API_SESSION_ID_VIOLATION = "Use of API.Session_Id might not be authorized";
 
    @Override
    public Object visit(ASTLiteralExpression node, Object data) {

        if (PMDApexUtils.isTestBlock(node)) {
            return data;
        }

        String literalValue = node.getImage();

        if (literalValue != null && literalValue.toUpperCase().indexOf(API_SESSION_ID.toUpperCase()) != -1) {
            asCtx(data).addViolationWithMessage(node, API_SESSION_ID_VIOLATION);
        }
        return data;
    }
}
