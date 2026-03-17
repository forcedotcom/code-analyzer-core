public class EdgeCaseViolations {
    // This file SHOULD trigger violations

    // 1. Single space then tab
 	public void violation1() {
        System.debug('test');
    }

    // 2. Multiple spaces then tab
      	public void violation2() {
        System.debug('test');
    }

    // 3. Tab then single space
	 public void violation3() {
        System.debug('test');
    }

    // 4. Tab then multiple spaces
	    public void violation4() {
        System.debug('test');
    }

    // 5. Multiple tabs and spaces mixed
		  	public void violation5() {
        System.debug('test');
    }

    // 6. Mixed indentation in comments
    	// This comment violates

    // 7. Mixed indentation in multiline string
    public void violation6() {
        String badString = '''
        	This line has spaces then tab
	        This line has tab then spaces
        ''';
    }
}
