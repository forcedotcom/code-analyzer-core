package com.salesforce.security.pmd.visualforce;

import java.util.ArrayList;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import net.sourceforge.pmd.lang.document.Chars;
import net.sourceforge.pmd.lang.visualforce.ast.ASTHtmlScript;
import net.sourceforge.pmd.lang.visualforce.rule.AbstractVfRule;
import net.sourceforge.pmd.reporting.RuleContext;

public class DetectCreateElementScriptTag extends AbstractVfRule {

    private static ArrayList<Pattern> CREATE_ELEMENT_PATTERNS = new ArrayList<Pattern>();
    private static final String[] CREATE_ELEMENT_REGEXES = {
            "createElement.*['\"]script",
            "createElement.*['\"]link", //Detects CSS; seemed inefficient to run this as a separate rule
    };
    private static final String CREATE_ELEMENT_SCRIPT_CSS_VIOLATION =
            "Detected dynamic script or dynamic CSS"
            + " creation using document.createElement";

    @Override
    public void start(RuleContext ctx) {
        if (CREATE_ELEMENT_PATTERNS.size() == 0) {
            for (String nextRegex: CREATE_ELEMENT_REGEXES) {
                Pattern nextPattern = Pattern.compile(nextRegex, Pattern.CASE_INSENSITIVE|Pattern.DOTALL);
                CREATE_ELEMENT_PATTERNS.add(nextPattern);
            }
        }
        super.start(ctx);
    }

    @Override
    public Object visit(ASTHtmlScript node, Object data) {
        Chars c = node.getText();
        searchForPatterns(node,data,c);
        return super.visit(node, data);
    }

    private void searchForPatterns(ASTHtmlScript node, Object data, Chars c) {
        String staticJS = c.toString();

        for (Pattern nextPattern: CREATE_ELEMENT_PATTERNS) {
            Matcher match = nextPattern.matcher(staticJS);
            if (match.find()) {
                this.asCtx(data)
                .addViolationWithMessage(node,
                        CREATE_ELEMENT_SCRIPT_CSS_VIOLATION);
                break; //Difficult to flag all instances in the code, so break
            }
        }
    }
}
