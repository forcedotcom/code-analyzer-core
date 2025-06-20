package com.salesforce.security.pmd.apex;

import java.util.List;

import net.sourceforge.pmd.lang.apex.ast.ASTLiteralExpression;
import net.sourceforge.pmd.lang.apex.ast.ASTMethodCallExpression;
import net.sourceforge.pmd.lang.apex.ast.ApexNode;
import net.sourceforge.pmd.lang.apex.rule.AbstractApexRule;
import net.sourceforge.pmd.lang.apex.rule.internal.Helper;

public class DetectHardcodedCredentialsInPasswordMethods extends AbstractApexRule {
        private static final String SET_PASSWORD = "setPassword";
        private static final String SYSTEM_SET_PASSWORD = "System.setPassword";
        private static final String SET_PASSWORD_HARD_CODED_PASSWORD = "setPassword invoked with hardcoded password";

        @Override
        public Object visit(ASTMethodCallExpression node, Object data) {
            if (Helper.isTestMethodOrClass(node)) {
                return true;
            }

            if (node.getFullMethodName().compareToIgnoreCase(SET_PASSWORD) == 0
                    || node.getFullMethodName().compareToIgnoreCase(SYSTEM_SET_PASSWORD) == 0) {
                this.handleSetPassword(node, data);
            }
            return super.visit(node, data);
        }

        private void handleSetPassword(ASTMethodCallExpression node, Object data) {
            ApexNode lastChild = node.getLastChild();
            Boolean foundLiteral = false;

            if (lastChild instanceof ASTLiteralExpression) {
                //we don't care if the string is empty;
                foundLiteral = true;
            } else {
                List<ASTLiteralExpression> literalExpressions = lastChild.
                    descendants(ASTLiteralExpression.class).
                    toList();
                if (literalExpressions.size() != 0) {
                    foundLiteral = true;
                }
            }
            if (foundLiteral) {
                //violation
                asCtx(data).addViolationWithMessage(node, SET_PASSWORD_HARD_CODED_PASSWORD);
            }
        }
}
