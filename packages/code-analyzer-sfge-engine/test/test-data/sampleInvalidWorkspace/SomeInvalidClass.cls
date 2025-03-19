global class SomeInvalidClass {
    public static boolean invalidMethod() {
        return true;
        // This method has code after the return, which will cause a compile failure.
        System.debug('asdfasdfasdf');
    }
}