package com.salesforce.security.pmd.apex;

import org.w3c.dom.*;

import java.io.*;
import java.util.regex.Pattern;

import javax.xml.parsers.DocumentBuilder;
import javax.xml.parsers.DocumentBuilderFactory;
import javax.xml.xpath.XPath;
import javax.xml.xpath.XPathConstants;
import javax.xml.xpath.XPathFactory;

import com.salesforce.security.pmd.apex.utils.PMDApexUtils;

import net.sourceforge.pmd.lang.apex.ast.ASTLiteralExpression;
import net.sourceforge.pmd.lang.apex.ast.ASTSoqlExpression;
import net.sourceforge.pmd.lang.apex.rule.AbstractApexRule;
import net.sourceforge.pmd.lang.ast.Node;
import net.sourceforge.pmd.lang.document.FileId;

public class DetectInsecureUseOfWithSecurityEnforced extends AbstractApexRule {
    private static final String WITH_SECURITY_ENFORCED_PATTERN_STR = "WITH\\s+SECURITY_ENFORCED";
    private static final Pattern WITH_SECURITY_ENFORCED_PATTERN =
            Pattern.compile(WITH_SECURITY_ENFORCED_PATTERN_STR, Pattern.CASE_INSENSITIVE);
    private static final String APEX_CLASS_APIVERSION_XPATH="/ApexClass/apiVersion";
    private static final String APEX_CLASS_OLD_VERSION_VIOLATION=
            "SOQL uses \"WITH SECURITY_ENFORCED\" with API version less than 48.0";

    @Override
    public Object visit(ASTSoqlExpression node, Object data) {

        if (PMDApexUtils.isTestBlock(node)) {
            return true;
        }

        String query = node.getQuery();
        if (!isSecurityEnforced(query)) {
            return data;
        }

        if (isUnsupportedAPIVersion(node)) {
            this.asCtx(data).addViolationWithMessage(node, APEX_CLASS_OLD_VERSION_VIOLATION);
        }
        return data;
    }

    public Object visit(ASTLiteralExpression node, Object data) {
        if (PMDApexUtils.isTestBlock(node)) {
            return true;
        }
        if (!node.isString()) {
            return data;
        }
        String value = node.getImage();
        if (!isSecurityEnforced(value)) {
            return data;
        }

        if (isUnsupportedAPIVersion(node)) {
            //violation: APEX_CLASS_OLD_VERSION_VIOLATION
            this.asCtx(data).addViolationWithMessage(node, APEX_CLASS_OLD_VERSION_VIOLATION);
        }
        return data;
    }

    private static boolean isSecurityEnforced(String query) {
        return WITH_SECURITY_ENFORCED_PATTERN.matcher(query).find();
    }

    private boolean isUnsupportedAPIVersion(Node node)   {
        FileId fId = node.getReportLocation().getFileId();
        String fileName = fId.getAbsolutePath();
        String metadataFile = fileName + "-meta.xml";
        File xmlFile = null;

        try {
            DocumentBuilderFactory factory = DocumentBuilderFactory.newInstance();
            factory.setExpandEntityReferences(false);
            factory.setFeature("http://xml.org/sax/features/external-general-entities", false);
            factory.setFeature("http://xml.org/sax/features/external-parameter-entities", false);
            DocumentBuilder builder = factory.newDocumentBuilder();
            xmlFile = new File(metadataFile);
            Document doc = builder.parse(xmlFile);

            XPath xPath =  XPathFactory.newInstance().newXPath();
            NodeList nodeList = (NodeList)xPath
                .compile(APEX_CLASS_APIVERSION_XPATH)
                .evaluate(doc, XPathConstants.NODESET);

            if (nodeList.getLength() != 1) {
                return false; //skip
            }

            String apiVersionText = nodeList.item(0).getTextContent();
            Integer apiVersion = Double.valueOf(apiVersionText).intValue();
            if (apiVersion < 48) {
                return true;
            }
        } catch (Exception e) {
            //something went wrong - was logged previously
        }
        return false;
    }

}
