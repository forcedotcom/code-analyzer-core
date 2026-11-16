public class BlockCommentLookalikes {
	// This file SHOULD trigger violations. Each case is close to, but is not, a tab-indented block comment line.

	/**
	  * 1. Tabs, then two spaces, then an asterisk
	 */

	/**
 	 * 2. A space, then a tab, then a space, then an asterisk
	 */

	/**
	 3. Tabs, then a single space, then a character that is not an asterisk
	 */

		/*
		  4. Tabs, then two spaces, then text
		 */

	public void method() {}
}
