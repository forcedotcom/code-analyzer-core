package com.salesforce.security.pmd.apex;

import com.salesforce.security.pmd.apex.utils.PMDApexUtils;
import com.salesforce.security.pmd.utils.SecretsInPackageUtils;

import net.sourceforge.pmd.lang.apex.ast.ASTEmptyReferenceExpression;
import net.sourceforge.pmd.lang.apex.ast.ASTLiteralExpression;
import net.sourceforge.pmd.lang.apex.ast.ASTMethodCallExpression;
import net.sourceforge.pmd.lang.apex.ast.ASTReferenceExpression;
import net.sourceforge.pmd.lang.apex.ast.ASTVariableExpression;
import net.sourceforge.pmd.lang.ast.Node;

import java.util.Arrays;
import java.util.List;

public class DetectHardcodedCredentialsInHttpRequests extends DetectHardcodedCredentialsBase {
    private static final List<String> HTTP_AUTH_HEADERS = SecretsInPackageUtils.AUTH_FIELD_MAPPINGS_LIST;
    private static final List<String> HTTP_AUTH_HEADER_VALUES_TO_IGNORE = Arrays.asList(SecretsInPackageUtils.STRINGS_TO_IGNORE);

    private static final String HARD_CODED_SECRET_IN_HTTP_REQUEST_HEADER_VIOLATION = "Potentially hardcoded secret found in HTTP request header";
    private static final String MERGE_FIELD_LITERAL="{!$Credential.";

    @Override
    public Object visit(ASTMethodCallExpression node, Object data) {

        if (PMDApexUtils.isTestBlock(node)) {
            return data;
        }

        String methodName = node.getMethodName();
        if (methodName.compareToIgnoreCase("setHeader") != 0) {
            return data;
        }
        if (node.getInputParametersSize() != 2) {
            return data;
        }

        ASTReferenceExpression refExpr = node.firstChild(ASTReferenceExpression.class);
        ASTEmptyReferenceExpression emptyRefExpr = node.firstChild(ASTEmptyReferenceExpression.class);
        Node childRefExpr = null;

        if (refExpr == null && emptyRefExpr == null) {
            return data;
        } else if (refExpr != null) {
            childRefExpr = refExpr;
        } else if (emptyRefExpr != null) {
            childRefExpr = emptyRefExpr;
        }

        Node firstChild = childRefExpr.getNextSibling();
        Node secondChild = firstChild.getNextSibling();

        List<ASTLiteralExpression> firstArgLiterals = firstChild.descendantsOrSelf()
                .filterIs(ASTLiteralExpression.class).toList();
        List<ASTVariableExpression> firstArgVars =
                firstChild.descendantsOrSelf()
                .filterIs(ASTVariableExpression.class).toList();
        List<ASTLiteralExpression> secondArgLiterals = secondChild.descendantsOrSelf()
                .filterIs(ASTLiteralExpression.class)
                .filterMatching(ASTLiteralExpression::isString,true)
                .toList();

        Boolean validLiteralFound = false;

        for (ASTLiteralExpression nextSecondArgLiteral:secondArgLiterals) {
            String value = nextSecondArgLiteral.getImage();
            if (value.strip().length() == 0) {
                continue;
            } else if (SecretsInPackageUtils.notAnInterestingString(value,HTTP_AUTH_HEADER_VALUES_TO_IGNORE)) {
                continue;
            } else if (isAMergeField(value)) {
                break;
            } else {
                validLiteralFound = true;
                break;
            }
        }

        if (!validLiteralFound) {
            return data;
        }

        for (ASTLiteralExpression nextFirstArgLiteral: firstArgLiterals) {
            String value = nextFirstArgLiteral.getImage();
            if (SecretsInPackageUtils.isAPartialMatchInList(value, HTTP_AUTH_HEADERS)) {
                //violation;
                this.asCtx(data)
                .addViolationWithMessage(node, HARD_CODED_SECRET_IN_HTTP_REQUEST_HEADER_VIOLATION);
                break;
            }
        }

        for (ASTVariableExpression nextFirstArgVar: firstArgVars) {
            String varName = nextFirstArgVar.getImage();
            if (SecretsInPackageUtils.isAPartialMatchInList(varName, HTTP_AUTH_HEADERS)) {
                //violation;
                this.asCtx(data)
                .addViolationWithMessage(node, HARD_CODED_SECRET_IN_HTTP_REQUEST_HEADER_VIOLATION);
                break;
            }
        }
        return super.visit(node, data);
    }

    private boolean isAMergeField(String value) {
        if (value.contains(MERGE_FIELD_LITERAL)) {
            return true;
        }
        return false;
    }
}
