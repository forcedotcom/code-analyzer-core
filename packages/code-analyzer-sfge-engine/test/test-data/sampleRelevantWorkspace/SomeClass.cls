// This class is going to perform a SOQL query, so its lack of `with sharing` is a violation of an SFGE rule.
// It is `global` so that it can count as an entrypoint without necessarily needing to use `pathStart` functionality.
global class SomeClass {
    // This static block is here to violate RemoveUnusedMethod and test the fudging of synthetic locations.
    static {
        System.debug('asdasdfasdf');
    }
    // This method is global so it can act as an entrypoint.
    global static void entryPointMethod() {
        return doInsecureQuery();
    }

    public static Account[] doInsecureQuery() {
        // This query should be using `WITH USER_MODE` for security. Not doing that is a violation.
        return [SELECT Name, CustomField__c FROM Account];
    }
}
