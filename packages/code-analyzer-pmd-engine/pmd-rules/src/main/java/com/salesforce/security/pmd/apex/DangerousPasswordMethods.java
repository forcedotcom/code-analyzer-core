package com.salesforce.security.pmd.apex;

import org.checkerframework.checker.nullness.qual.NonNull;

import com.salesforce.security.pmd.apex.utils.PMDApexUtils;

import net.sourceforge.pmd.lang.apex.ast.ASTMethod;
import net.sourceforge.pmd.lang.apex.ast.ASTVariableExpression;
import net.sourceforge.pmd.lang.apex.ast.ASTParameter;
import net.sourceforge.pmd.lang.apex.ast.ASTMethodCallExpression;
import net.sourceforge.pmd.lang.apex.ast.ASTUserClass;
import net.sourceforge.pmd.lang.apex.rule.AbstractApexRule;
import net.sourceforge.pmd.lang.apex.rule.internal.Helper;
import net.sourceforge.pmd.lang.rule.RuleTargetSelector;

public class DangerousPasswordMethods extends AbstractApexRule {

    private static final String MOVE_PASSWORD = "movePassword";
    private static final String SYSTEM_MOVE_PASSWORD = "System.movePassword";

    private static final String RESET_PASSWORD = "resetPassword";
    private static final String SYSTEM_RESET_PASSWORD = "System.resetPassword";

    private static final String RESET_PASSWORD_WITH_EMAIL = "resetPasswordWithEmailTemplate";
    private static final String SYSTEM_RESET_PASSWORD_WITH_EMAIL = "System.resetPasswordWithEmailTemplate";

    private static final String SET_PASSWORD = "setPassword";
    private static final String SYSTEM_SET_PASSWORD = "System.setPassword";

    private static final String SET_PASSWORD_VIOLATION = "setPassword() is invoked inside a controller with "
            + "tainted input parameter: %s";
    private static final String SET_PASSWORD_VIOLATION_LOW_CONFIDENCE = "setPassword() is invoked inside a controller; "
            + "ensure that "
            + "variable: %s passed to setPassword() "
            + "is not tainted";

    private static final String RESET_PASSWORD_WITH_EMAIL_VIOLATION = "resetPasswordWithEmailTemplate() "
            + "is invoked inside a controller; ensure that "
            + "resetPasswordWithEmailTemplate() does not use tainted input";

    private static final String RESET_PASSWORD_VIOLATION = "resetPassword() "
            + "is invoked inside a controller; ensure that "
            + "resetPassword() does not use tainted input";

    private static final String MOVE_PASSWORD_VIOLATION = "movePassword() "
            + "is invoked inside a controller; ensure that"
            + "movePassword() does not use tainted input";

    @Override
    protected @NonNull RuleTargetSelector buildTargetSelector() {
        return RuleTargetSelector.forTypes(ASTUserClass.class);
    }

    @Override
    public Object visit(ASTMethodCallExpression node, Object data) {
        if (Helper.isTestMethodOrClass(node)) {
            return true;
        }

        if (node.getFullMethodName().compareToIgnoreCase(MOVE_PASSWORD) == 0
            || node.getFullMethodName().compareToIgnoreCase(SYSTEM_MOVE_PASSWORD) == 0)
        {
            this.handleMovePassword(node, data);
        } else if (node.getFullMethodName().compareToIgnoreCase(RESET_PASSWORD) == 0
            || node.getFullMethodName().compareToIgnoreCase(SYSTEM_RESET_PASSWORD) == 0)
        {
            this.handleResetPassword(node, data);
        } else if (node.getFullMethodName().compareToIgnoreCase(RESET_PASSWORD_WITH_EMAIL) == 0
            || node.getFullMethodName().compareToIgnoreCase(SYSTEM_RESET_PASSWORD_WITH_EMAIL) == 0)
        {
            this.handleResetPasswordWithEmail(node, data);
        } else if(node.getFullMethodName().compareToIgnoreCase(SET_PASSWORD) == 0
            || node.getFullMethodName().compareToIgnoreCase(SYSTEM_SET_PASSWORD) == 0)
        {
            this.handleSetPassword(node, data);
        }
        return super.visit(node, data);
    }

    private void handleMovePassword(ASTMethodCallExpression node, Object data) {
        /*
         * This method requires assistance from Salesforce support according to docs
         * but we should still check for it:
         * https://developer.salesforce.com/docs/atlas.en-us.apexref.meta/apexref/apex_methods_system_system.htm#apex_System_System_movePassword
         */
        if (PMDApexUtils.isMethodInvokedInsideAController(node)) {
            asCtx(data).addViolationWithMessage(node, MOVE_PASSWORD_VIOLATION);
        }
    }

    private void handleResetPassword(ASTMethodCallExpression node, Object data) {
        if (PMDApexUtils.isMethodInvokedInsideAController(node)) {
            asCtx(data).addViolationWithMessage(node, RESET_PASSWORD_VIOLATION);
        }
    }

    private void handleResetPasswordWithEmail(ASTMethodCallExpression node, Object data) {
        if (PMDApexUtils.isMethodInvokedInsideAController(node)) {
            asCtx(data).addViolationWithMessage(node, RESET_PASSWORD_WITH_EMAIL_VIOLATION);
        }
    }

    private void handleSetPassword(ASTMethodCallExpression node, Object data) {

        if (PMDApexUtils.isMethodInvokedInsideAController(node)) {

            ASTVariableExpression userIdVar = node.descendants(ASTVariableExpression.class).first();
            String userIdVarName = userIdVar.getImage();

            if (isSetPasswordHighConfidence(node,data)) {
                asCtx(data).addViolationWithMessage(node, String.format(SET_PASSWORD_VIOLATION, userIdVarName));
            } else {
                asCtx(data).addViolationWithMessage(node, String.format(SET_PASSWORD_VIOLATION_LOW_CONFIDENCE, userIdVarName));
            }

        }
    }

    private boolean isSetPasswordHighConfidence(ASTMethodCallExpression node, Object data) {
        ASTMethod callingNode = node.ancestors(ASTMethod.class).first();
        ASTVariableExpression userIdVar = node.descendants(ASTVariableExpression.class).first();
        String userIdVarName = userIdVar.getImage();

        int taintedParamCount = callingNode.children(ASTParameter.class).count();
        if (taintedParamCount == 0) {
            return false;
        }

        ASTParameter taintedParam = callingNode
            .children(ASTParameter.class)
            .filterMatching(ASTParameter::getImage, userIdVarName)
            .first();

        if (taintedParam != null) {
            //high confidence violation
            return true;
        }
        return false;
    }
}
