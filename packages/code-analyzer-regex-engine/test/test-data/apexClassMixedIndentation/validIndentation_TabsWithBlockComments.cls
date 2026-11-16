/**
 * The ApexDoc comment on the class is not indented, so this file starts with the usual space-asterisk lines.
 */
public class TabsWithBlockComments {
	/**
	 * @description Every continuation line of this ApexDoc comment is a tab, a single space, and an asterisk.
	 * @param accountId The Id of the Account to query
	 * @return The Account with the given Id
	 */
	public static Account getAccount(Id accountId) {
		/*
		 * A plain block comment formatted the same way, two tabs deep.
		 */
		return [SELECT Id FROM Account WHERE Id = :accountId];
	}

	/**
	 * An ApexDoc comment that contains a block quote and a code block.
	 *
	 * > Each line of this block quote starts with a tab, a single space, and an asterisk.
	 * > So it is a block comment continuation line, not mixed indentation.
	 *
	 * ```
	 * Account a = getAccount(someId);
	 * ```
	 */
	public static void example() {
		System.debug('ok');
	}
}
