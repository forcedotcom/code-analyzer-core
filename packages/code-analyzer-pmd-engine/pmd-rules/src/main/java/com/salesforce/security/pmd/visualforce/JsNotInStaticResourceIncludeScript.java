/*
 * <apex:includescript></apex:includescript>
 * 
 * 
 * 
 */
package com.salesforce.security.pmd.visualforce;

import org.checkerframework.checker.nullness.qual.NonNull;
import net.sourceforge.pmd.lang.visualforce.ast.ASTExpression;
import net.sourceforge.pmd.lang.ast.NodeStream;
import net.sourceforge.pmd.lang.visualforce.ast.ASTText;
import net.sourceforge.pmd.lang.rule.RuleTargetSelector;
import net.sourceforge.pmd.lang.visualforce.ast.ASTAttribute;
import net.sourceforge.pmd.lang.visualforce.ast.ASTAttributeValue;
import net.sourceforge.pmd.lang.visualforce.ast.ASTElement;
import net.sourceforge.pmd.lang.visualforce.ast.ASTIdentifier;
import net.sourceforge.pmd.lang.visualforce.ast.VfNode;
import net.sourceforge.pmd.lang.visualforce.rule.AbstractVfRule;

public class JsNotInStaticResourceIncludeScript extends AbstractVfRule {
    private static final String APEX_INCLUDESCRIPT = "apex:includescript";
    private static final String GOOGLE_MAPS_API_URL = "https://maps.googleapis.com/";
    private static final String GOOGLE_MAPS_API_URL_DOUBLE_SLASH_URI = "//maps.googleapis.com/";
    private static final String URLFOR_IDENTIFIER = "URLFOR";
    private static final String RESOURCE_IDENTIFIER = "$Resource";
    private static final String SCRIPT_SRC_VIOLATION_MESSAGE = "Javascript should always be loaded from static resources";

    @Override
    protected @NonNull RuleTargetSelector buildTargetSelector() {
        return RuleTargetSelector.forTypes(ASTElement.class);
    }

    @Override
    public Object visit(ASTElement node, Object data) {
        if(!APEX_INCLUDESCRIPT.equalsIgnoreCase(node.getName())) {
            return data;
        }
        processASTAttribute(node, data);
        return data;
    }

    private void processASTAttribute(ASTElement node, Object data) {
        ASTAttribute valueAttr =
                node.children(ASTAttribute.class)
                .filterMatching(ASTAttribute::getName, "value").get(0);

        if (valueAttr == null) {
            return ; //inline script
        }

        ASTAttributeValue valueAttrValue = valueAttr.children(ASTAttributeValue.class).get(0);
        
        int countOfAttrExpressions = valueAttr.descendants(ASTExpression.class).count();
        if (countOfAttrExpressions != 0) {
            handleExpression(valueAttrValue,data);
        } else { 
            ASTText valueAttrText = valueAttrValue.children(ASTText.class).get(0);
            handleLiteralStringSrc(valueAttrText, data);
        }
    }

    private void handleExpression(ASTAttributeValue node, Object data) {
        VfNode firstChild = node.getFirstChild();
        if (firstChild.getClass() == ASTText.class) {
            handleLiteralStringSrc((ASTText)firstChild, data);
            return;
        }
        
        NodeStream<ASTExpression> expressions = node.descendants(ASTExpression.class);
        VfNode firstExpressionIdentifier = expressions.get(0).getFirstChild();
        if (firstExpressionIdentifier.getClass() == ASTIdentifier.class) {
            if (firstExpressionIdentifier.getImage().compareToIgnoreCase(URLFOR_IDENTIFIER) == 0 ||
                firstExpressionIdentifier.getImage().compareToIgnoreCase(RESOURCE_IDENTIFIER) == 0) 
            {
                return;
            } else {
                asCtx(data).addViolationWithMessage(node, SCRIPT_SRC_VIOLATION_MESSAGE);
            }
        }
    }
    private void handleLiteralStringSrc(ASTText node, Object data) {
        if (node == null) {
            return;
        }

        String srcValue = node.getImage();
        if (srcValue.startsWith(GOOGLE_MAPS_API_URL) || srcValue.startsWith(GOOGLE_MAPS_API_URL_DOUBLE_SLASH_URI)|| 
           (srcValue.startsWith("/") && !srcValue.startsWith("//")) ||
            srcValue.startsWith("../")
        ) {
            return;
        } else {
            asCtx(data).addViolationWithMessage(node, SCRIPT_SRC_VIOLATION_MESSAGE);
        }
    }
}