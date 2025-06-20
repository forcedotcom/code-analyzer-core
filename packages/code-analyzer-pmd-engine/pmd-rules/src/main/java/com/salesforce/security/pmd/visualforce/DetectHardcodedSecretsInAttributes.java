package com.salesforce.security.pmd.visualforce;

import java.util.List;

import com.salesforce.security.pmd.utils.SecretsInPackageUtils;

import net.sourceforge.pmd.lang.visualforce.ast.ASTAttribute;
import net.sourceforge.pmd.lang.visualforce.ast.ASTAttributeValue;
import net.sourceforge.pmd.lang.visualforce.ast.ASTElement;
import net.sourceforge.pmd.lang.visualforce.rule.AbstractVfRule;

public class DetectHardcodedSecretsInAttributes extends AbstractVfRule{
    private static final String APEX_ATTRIBUTE = "apex:attribute";
    private static final String APEX_C_COMPONENT = "C:";
    private static final String HARDCODED_SECRETS_IN_APEX_ATTRIBUTES_VIOLATION = "Potential hardcoded secrets detected in component attributes";

    @Override
    public Object visit(ASTElement node, Object data) {
        if (node.getName().toUpperCase().startsWith(APEX_C_COMPONENT)) {
            processComponentInclusion(node,data);
        } else if (APEX_ATTRIBUTE.equalsIgnoreCase(node.getName())) {
            processASTAttribute(node,data);
        }
        return super.visit(node, data);
    }

    private void processComponentInclusion(ASTElement node,Object data) {
        List<ASTAttribute> allAttributes = node.children(ASTAttribute.class).toList();

        for (ASTAttribute nextAttr: allAttributes) {
            String attrName = nextAttr.getName();
            if (SecretsInPackageUtils.isAPotentialSecret(attrName)) {
                this.asCtx(data)
                    .addViolationWithMessage(nextAttr, HARDCODED_SECRETS_IN_APEX_ATTRIBUTES_VIOLATION);
            }
        }
    }

    private void processASTAttribute(ASTElement node,Object data) {
        ASTAttribute typeAttr =
                node.children(ASTAttribute.class)
                .filterMatching(ASTAttribute::getName, "type").get(0);

        if (typeAttr != null) {
            String typeAttrValue = typeAttr
                .children(ASTAttributeValue.class)
                .get(0).getText().toString();
            if (typeAttrValue.compareToIgnoreCase("\"string\"") != 0) {
                return;
            }
        }

        ASTAttribute defaultAttr =
                node.children(ASTAttribute.class)
                .filterMatching(ASTAttribute::getName, "default").first();

        if (defaultAttr == null || defaultAttr.getText().length() == 0) {
            return;
        }

        ASTAttribute nameAttr =
            node.children(ASTAttribute.class)
            .filterMatching(ASTAttribute::getName, "name").first();

        String attribute = nameAttr.getFirstChild().getFirstChild().getImage();

        if (SecretsInPackageUtils.isAPotentialSecret(attribute)) {
            //violation
            this.asCtx(data)
                .addViolationWithMessage(defaultAttr, HARDCODED_SECRETS_IN_APEX_ATTRIBUTES_VIOLATION);
        }
    }
}
