package com.salesforce.security.pmd.apex;

import com.salesforce.security.pmd.apex.utils.PMDApexUtils;

import net.sourceforge.pmd.lang.apex.ast.ASTMethodCallExpression;
import net.sourceforge.pmd.lang.apex.rule.AbstractApexRule;

public class UnauthorizedUseOfGetSessionId extends AbstractApexRule {
    private static final String USERINFO_GETSESSIONID = "UserInfo.getSessionId";
    private static final String SYSTEM_USERINFO_GETSESSIONID = "System.UserInfo.getSessionId";
    private static final String SESSIONID_VIOLATION = "User of UserInfo.getSessionId might not be authorized";

    @Override
    public Object visit(ASTMethodCallExpression node, Object data) {

        if (PMDApexUtils.isTestBlock(node)) {
            return data;
        }

        String fullMethodName = node.getFullMethodName();
        if (USERINFO_GETSESSIONID.compareToIgnoreCase(fullMethodName) == 0
            || SYSTEM_USERINFO_GETSESSIONID.compareToIgnoreCase(fullMethodName) == 0 )
        {
            asCtx(data).addViolationWithMessage(node, SESSIONID_VIOLATION);
        }

        return data;
    }
}
