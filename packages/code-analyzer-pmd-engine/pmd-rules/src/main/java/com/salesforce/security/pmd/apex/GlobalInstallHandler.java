package com.salesforce.security.pmd.apex;

import java.util.List;

import org.checkerframework.checker.nullness.qual.NonNull;

import net.sourceforge.pmd.lang.apex.ast.ASTUserClass;
import net.sourceforge.pmd.lang.apex.rule.AbstractApexRule;
import net.sourceforge.pmd.lang.apex.rule.internal.Helper;
import net.sourceforge.pmd.lang.rule.RuleTargetSelector;

public class GlobalInstallHandler extends AbstractApexRule{
    public static String INSTALL_HANDLER = "InstallHandler";
    public static String SYSTEM_INSTALL_HANDLER = "System.InstallHandler";
    public static String UNINSTALL_HANDLER = "UninstallHandler";
    public static String SYSTEM_UNINSTALL_HANDLER = "System.UninstallHandler";
    
    public static final String GLOBAL_INSTALL_HANDLER_VIOLATION = "Classes that extend InstallHandler should be public and not global";
    public static final String GLOBAL_UNINSTALL_HANDLER_VIOLATION = "Classes that extend UninstallHandler should be public and not global";

    @Override
    protected @NonNull RuleTargetSelector buildTargetSelector() {
        return RuleTargetSelector.forTypes(ASTUserClass.class);
    }
    
    @Override
    public Object visit(ASTUserClass node, Object data) {

        if (Helper.isTestMethodOrClass(node)) {
            return data;
        }

        List<String> interfaceNames = node.getInterfaceNames();
        for (String each: interfaceNames) {
            if (each.compareToIgnoreCase(INSTALL_HANDLER) == 0 || 
                    each.compareToIgnoreCase(SYSTEM_INSTALL_HANDLER) == 0) 
                {
                if(node.getModifiers().isGlobal()) {
                    asCtx(data).addViolationWithMessage(node, GLOBAL_INSTALL_HANDLER_VIOLATION);
                    break;
                }
            }

            if (each.compareToIgnoreCase(UNINSTALL_HANDLER) == 0 || 
                each.compareToIgnoreCase(SYSTEM_UNINSTALL_HANDLER) == 0)
            {
                if (node.getModifiers().isGlobal()) {
                    asCtx(data).addViolationWithMessage(node, GLOBAL_UNINSTALL_HANDLER_VIOLATION);
                    break;
                }
            }
        }
        return data;
    }
}
