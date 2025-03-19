package com.salesforce.security.pmd.apex;

import java.util.List;

import com.salesforce.security.pmd.apex.utils.PMDApexUtils;

import net.sourceforge.pmd.lang.apex.ast.ASTAssignmentExpression;
import net.sourceforge.pmd.lang.apex.ast.ASTLiteralExpression;
import net.sourceforge.pmd.lang.apex.ast.ASTMethodCallExpression;
import net.sourceforge.pmd.lang.apex.ast.ASTVariableExpression;
import net.sourceforge.pmd.lang.ast.Node;

public class DetectHardcodedCredentialsInVarAssign extends DetectHardcodedCredentialsBase {
    
    @Override
    public Object visit(ASTAssignmentExpression node, Object data) {

        if (PMDApexUtils.isTestBlock(node)) {
            return data;
        }

        ASTVariableExpression varExpression = node.firstChild(ASTVariableExpression.class);
        if (varExpression == null) {
            return data;
        }

        String varName = varExpression.getImage();
        String matchedToken = isAnAuthToken(varName);
        if (matchedToken == null) {
            return data;
        }

        List<ASTLiteralExpression> stringLiterals = node
            .descendants(ASTLiteralExpression.class)
            .filterMatching(ASTLiteralExpression::isString, true)
            .filterNotMatching(ASTLiteralExpression::getImage, "").toList();

        for (ASTLiteralExpression nextStringLiteral: stringLiterals) {

            Node parent = nextStringLiteral.getParent();
            if (parent.getClass() == ASTMethodCallExpression.class) {
                continue;
            }

            String value = nextStringLiteral.getImage();
            if (notAnInterestingString(value)) {
                continue;
            }

            String violationMessage = String.format(HARDCODED_CREDENTIALS_FOUND_MESSAGE, varName, matchedToken);
            asCtx(data).addViolationWithMessage(varExpression, violationMessage);
        }
        return data;
    }
}
