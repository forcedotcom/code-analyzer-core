package com.salesforce.security.pmd.apex;

import com.salesforce.security.pmd.apex.utils.PMDApexUtils;

import net.sourceforge.pmd.lang.apex.ast.ASTMethod;
import net.sourceforge.pmd.lang.apex.ast.ASTMethodCallExpression;
import net.sourceforge.pmd.lang.apex.ast.ASTParameter;
import net.sourceforge.pmd.lang.apex.ast.ASTVariableExpression;
import net.sourceforge.pmd.lang.apex.rule.AbstractApexRule;

public class CustomSettingsGetInstanceMisuse extends AbstractApexRule {
        private static final String GET_INSTANCE_METHOD = "getInstance";
        private static final String CUSTOM_SETTINGS_GET_INSTANCE_HIGH_CONFIDENCE_VIOLATION =
                "getInstance() is invoked with tainted parameter";

        @Override
        public Object visit(ASTMethodCallExpression node, Object data) {
            if (PMDApexUtils.isTestBlock(node)) {
                return true;
            }

            String methodName = node.getMethodName();
            String fullMethodName = node.getFullMethodName();
            if (methodName.compareToIgnoreCase(GET_INSTANCE_METHOD) != 0) {
                return data;
            }
            if (node.getInputParametersSize() != 1) {
                return data;
            }
            String [] parts = fullMethodName.split("\\.");
            if (parts.length != 2) {
                return data;
            }

            //check for usage in custom object, not custom settings
            String objectAPIName = parts[0];
            if (!objectAPIName.endsWith("__c") && !objectAPIName.endsWith("__C")) {
                return data;
            } else if (PMDApexUtils.isMethodInvokedInsideAController(node) && getInstanceHighConfidence(node,data)) {
                //high confidence violation
                asCtx(data).addViolationWithMessage(node, CUSTOM_SETTINGS_GET_INSTANCE_HIGH_CONFIDENCE_VIOLATION);
            }
             
            return data;
        }

        private boolean getInstanceHighConfidence(ASTMethodCallExpression node, Object data) {
            ASTMethod callingNode=node.ancestors(ASTMethod.class).first();
            ASTVariableExpression idVar= node.descendants(ASTVariableExpression.class).first();
            
            if (idVar == null) {
                //Likely a literal - getInstance('hello');
                return false;
            }
            
            String idVarName = idVar.getImage();
            int taintedParamCount = callingNode.children(ASTParameter.class).count();

            if (taintedParamCount == 0) {
                return false;
            }

            ASTParameter taintedParam = callingNode
                    .children(ASTParameter.class)
                    .filterMatching(ASTParameter::getImage,idVarName).first();

            if (taintedParam != null) {
                return true;
            }
            return false;
        }
}