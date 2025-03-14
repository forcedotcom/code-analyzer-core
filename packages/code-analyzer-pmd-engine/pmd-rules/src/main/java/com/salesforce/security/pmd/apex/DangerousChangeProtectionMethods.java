package com.salesforce.security.pmd.apex;

import java.util.Arrays;
import java.util.List;

import org.checkerframework.checker.nullness.qual.NonNull;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import com.salesforce.security.pmd.apex.utils.PMDApexUtils;

import net.sourceforge.pmd.lang.apex.ast.ASTMethod;
import net.sourceforge.pmd.lang.apex.ast.ASTAnnotation;
import net.sourceforge.pmd.lang.apex.ast.ASTLiteralExpression;
import net.sourceforge.pmd.lang.apex.ast.ASTLiteralExpression.LiteralType;
import net.sourceforge.pmd.lang.apex.ast.ASTVariableExpression;
import net.sourceforge.pmd.lang.apex.ast.ApexNode;
import net.sourceforge.pmd.lang.apex.ast.ASTParameter;
import net.sourceforge.pmd.lang.apex.ast.ASTMethodCallExpression;
import net.sourceforge.pmd.lang.apex.ast.ASTModifierNode;
import net.sourceforge.pmd.lang.apex.ast.ASTUserClass;
import net.sourceforge.pmd.lang.apex.rule.AbstractApexRule;
import net.sourceforge.pmd.lang.apex.rule.internal.Helper;
import net.sourceforge.pmd.lang.rule.RuleTargetSelector;

public class DangerousChangeProtectionMethods extends AbstractApexRule {
    private static final Logger LOG = LoggerFactory.getLogger(DangerousChangeProtectionMethods.class);

	//Reference: https://developer.salesforce.com/docs/atlas.en-us.apexref.meta/apexref/apex_class_System_FeatureManagement.htm
	private static final String CHANGE_PROTECTION = "FeatureManagement.changeProtection";
	private static final String SYSTEM_CHANGE_PROTECTION = "System.FeatureManagement.changeProtection";
	
	private static final String CHANGE_PROTECTION_VIOLATION = "Object/Custom Permission changed to Unprotected inside a controller";
	
    @Override
    protected @NonNull RuleTargetSelector buildTargetSelector() {
        return RuleTargetSelector.forTypes(ASTUserClass.class);
    }
	
	@Override
    public Object visit(ASTMethodCallExpression node, Object data) {
		if (Helper.isTestMethodOrClass(node)) {
			super.visit(node, data);
        }

		if (node.getFullMethodName().compareToIgnoreCase(
            CHANGE_PROTECTION) == 0
			|| node.getFullMethodName().compareToIgnoreCase(SYSTEM_CHANGE_PROTECTION) == 0) {
			this.handleChangeProtection(node, data);
		}
		super.visit(node, data);
		return data;
	}
	
	private void handleChangeProtection(ASTMethodCallExpression node, Object data) {
		//Custom object will not go back to Protected from Unprotected
		if (!PMDApexUtils.isMethodInvokedInsideAController(node)) {
			return; // for now don't care if this is not invoked inside a controller
		}

		Integer paramsCount = node.getInputParametersSize();
		if (paramsCount!=3) {
			return;
		}

		ApexNode lastParamNode=node.getLastChild();

		if (lastParamNode.getClass().equals(ASTLiteralExpression.class)) {
			ASTLiteralExpression lastParamLiteral = (ASTLiteralExpression)lastParamNode;
			if (!lastParamLiteral.isString()) {
				return;
			}
			String lastParamVal = lastParamLiteral.getImage();
			if (lastParamVal.compareToIgnoreCase("UnProtected") == 0 ) {
				asCtx(data).addViolationWithMessage(node, CHANGE_PROTECTION_VIOLATION);
			}
		}
		else if (lastParamNode.getClass().equals(ASTVariableExpression.class)) {
			ASTVariableExpression lastParamVariable = (ASTVariableExpression)lastParamNode;
		}
		
	}
	
}
