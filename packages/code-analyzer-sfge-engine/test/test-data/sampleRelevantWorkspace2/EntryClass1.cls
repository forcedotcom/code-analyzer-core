global with sharing class EntryClass1 {
    global static void entryPointMethod1() {
        InternalOnlyClass i = new InternalOnlyClass();
        i.doAnInsecureQuery();
    }

    global static void entryPointMethod2() {
        InternalOnlyClass i = new InternalOnlyClass();
        i.doAnInsecureQuery();
    }
}
