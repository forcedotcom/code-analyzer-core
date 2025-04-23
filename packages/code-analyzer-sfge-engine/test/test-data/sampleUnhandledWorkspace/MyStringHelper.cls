global virtual class MyStringHelper {
    global static final String NEW_LINE;

    static {

    }

    global static Boolean isEmpty(String val) {
        return (val == null || val.trim().length() == 0);
    }

    static Map<String, String> prefixedNameCache = new Map<String, String>();
}
