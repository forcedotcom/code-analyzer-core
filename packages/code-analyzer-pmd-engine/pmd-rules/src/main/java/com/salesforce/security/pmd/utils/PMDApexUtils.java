package com.salesforce.security.pmd.apex.utils;

import java.util.Arrays;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import net.sourceforge.pmd.lang.apex.ast.ASTAnnotation;
import net.sourceforge.pmd.lang.apex.ast.ASTMethod;
import net.sourceforge.pmd.lang.apex.ast.ASTMethodCallExpression;
import net.sourceforge.pmd.lang.apex.ast.ASTModifierNode;
import net.sourceforge.pmd.lang.apex.ast.ASTUserClass;
import net.sourceforge.pmd.lang.apex.ast.ApexNode;
import net.sourceforge.pmd.lang.apex.rule.internal.Helper;
import net.sourceforge.pmd.lang.ast.Node;
import net.sourceforge.pmd.lang.document.FileId;

public class PMDApexUtils {
	private static final Logger LOG = LoggerFactory.getLogger(PMDApexUtils.class);
	private static final String [] CONTROLLER_ANNOTATIONS_ARRAY= {
		"AuraEnabled",
		"RemoteAction",
		//global RestResource methods
		"HttpPost",
		"HttpGet",
		"HttpPatch",
		"HttpDelete",
		"HttpPut",
		"InvocableMethod", //https://developer.salesforce.com/docs/atlas.en-us.apexcode.meta/apexcode/apex_classes_annotation_InvocableMethod.htm
		"NamespaceAccessible"
	};
	public static final List<String> CONTROLLER_ANNOTATIONS = Arrays.asList(CONTROLLER_ANNOTATIONS_ARRAY);
	private static final String HTTP_CALLOUT_MOCK = "HttpCalloutMock";
	
    // commented b/c I didn't want it to create issues for test coverage until I'm ready for it
	// public static boolean isATrigger(String fileName) {
	// 	if (fileName.endsWith(".trigger")) {
	// 		return true;
	// 	}
	// 	return false;
	// }

    // public static boolean isTestBlock(Node node) {
	// 	FileId fId=node.getReportLocation().getFileId();
	// 	String fileName=fId.getAbsolutePath();
	// 	if (isATrigger(fileName)) {
	// 		return false;
	// 	}

	// 	ASTMethod method = node.ancestors(ASTMethod.class).first();

	// 	if (method != null && Helper.isTestMethodOrClass(method)) {
    //         return true;
    //     }
		
	// 	ASTUserClass userClass = node.ancestors(ASTUserClass.class).first();
	// 	if (userClass != null && Helper.isTestMethodOrClass(userClass)) {
    //         return true;
    //     }
	// 	List<String>userClassInterfaces = userClass.getInterfaceNames();
		
	// 	for (String nextInterface: userClassInterfaces) {
	// 		if (nextInterface.compareToIgnoreCase(HTTP_CALLOUT_MOCK) == 0) {
	// 			return true;
	// 		}
	// 	}
		
	// 	userClass = node.ancestors(ASTUserClass.class).last();
	// 	if (userClass != null && Helper.isTestMethodOrClass(userClass)) {
    //         return true;
    //     }

    // 	return false;
    // }
    
    public static boolean isMethodInvokedInsideAController(ASTMethodCallExpression node) {

		ASTMethod callingNode = node.ancestors(ASTMethod.class).first();
	
		if (callingNode == null) {
			return false;
		}

		ASTModifierNode modifiers = callingNode.getModifiers();

		if (modifiers.isGlobal()) {
			return true; //all global methods are controllers
		}

		List<ASTAnnotation> annotations = modifiers.children(ASTAnnotation.class).toList();

		for (ASTAnnotation nextAnnotation: annotations) {
			boolean validAnnotation=CONTROLLER_ANNOTATIONS.stream()
			    .anyMatch(nextAnnotation.getName()::equalsIgnoreCase);
			if (validAnnotation) {
				return true;
			}
		}
		return false;
	}

    // public static boolean isAnInternalOnlyRule(String ruleName) {
    // 	if (ruleName.endsWith("Internal") ||
	// 			ruleName.endsWith("InternalOnly")) {
	// 		return true;
	// 	}
    // 	return false;
    // }
    
}
