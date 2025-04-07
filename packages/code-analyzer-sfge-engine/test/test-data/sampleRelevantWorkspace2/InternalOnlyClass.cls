public inherited sharing class InternalOnlyClass {

    public void doAnInsecureQuery() {
        // This query should be using the USER_MODE syntax for CRUD/FLS reasons. It doesn't, and is therefore insecure.
        Account[] accs = [SELECT Name, CustomField__c FROM Account];
    }
}
