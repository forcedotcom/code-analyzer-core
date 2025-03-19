package com.salesforce.security.pmd.apex;

import java.util.Arrays;
import java.util.List;

import com.salesforce.security.pmd.utils.SecretsInPackageUtils;

import net.sourceforge.pmd.lang.apex.rule.AbstractApexRule;

public class DetectHardcodedCredentialsBase extends AbstractApexRule {
    protected static final String HARDCODED_CREDENTIALS_FOUND_MESSAGE =
            "Hard coded credentials assigned to variable: %s "
            + " matched the token: %s";

    private static final String [] LIST_OF_POTENTIAL_SECRET_VARS= {
            "APIKEY",
            "API_KEY",
            "API-KEY",
            "PASSWORD",
            "PASSWD",
            "ENCRYPT",
            "TOKEN",
            "HASH",
            "SECRET",
            "SIGNATURE",
            "AUTHN",
            "AUTHZ",
            "OAUTH",
            "AUTHORIZATION",
            "AUTHENTICATION",
            "AUTHENTICATE",
            "BEARER",
            "CREDS", //cred - has too many false +ve hits, same with credential(s),
            "CREDENTIAL",
            "REFRESHTOKEN",
            "REFRESH_TOKEN",
            "CERT",
            "PRIVATE",
            "SYMMETRICKEY",
            "SYMMETRIC_KEY",
            "ASYMMETRIC_KEY",
            "ASYMMETRICKEY",
            "JWT",
            "SALT",
            "COOKIE",
            "SESSIONID",
            "SESSION_ID",
            "CREDITCARD",
            "CREDIT_CARD"
    };

    private static final List<String> LIST_OF_STRINGS_TO_IGNORE = Arrays.asList(SecretsInPackageUtils.STRINGS_TO_IGNORE);

    protected boolean notAnInterestingString(String value) {
        return SecretsInPackageUtils.notAnInterestingString(value, LIST_OF_STRINGS_TO_IGNORE);
    }

    protected String isAnAuthToken(String varName) {
        for (String eachStr:LIST_OF_POTENTIAL_SECRET_VARS) {	    		
            if (varName.toUpperCase().indexOf(eachStr) != -1) {
                return eachStr;
            }
        }
        return null;
    }
}
