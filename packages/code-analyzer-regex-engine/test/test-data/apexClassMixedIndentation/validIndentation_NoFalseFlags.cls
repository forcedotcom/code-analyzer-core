public class NoFalseFlagsTest {
    // This file should NOT trigger any violations

    // 1. Code starting at column 0 (no indentation)
public void methodOne() {
String x = 'test';
}

    // 2. Empty lines (should be ignored)


    // 3. Tabs and spaces in string literals (NOT indentation)
    public void stringLiterals() {
        String withTab = 'hello	world';  // Tab inside string - OK
        String withSpaces = 'hello    world';  // Spaces inside string - OK
        String mixed = 'a	b    c';  // Mixed inside string - OK
    }

    // 4. Whitespace in the middle of lines (after code starts)
    public void midLineWhitespace() {
        Integer x	=	5;  // Tab after code starts - OK
        String y    =    'test';  // Spaces after code starts - OK
    }

    // 5. Consistent spaces throughout
    public void allSpaces() {
        if (true) {
            while (false) {
                System.debug('test');
            }
        }
    }

    // 6. Consistent tabs throughout
	public void allTabs() {
		if (true) {
			while (false) {
				System.debug('test');
			}
		}
	}

    // 7. Comments with consistent indentation
    public void commentsOk() {
        // This comment has spaces
        /* Multi-line comment
           with spaces */
        System.debug('ok');
    }

    // 8. Multiline strings with consistent indentation
    public void multilineStrings() {
        String spaces = '''
            Line 1
            Line 2
            Line 3
        ''';

        String tabs = '''
			Line 1
			Line 2
			Line 3
		''';
    }
}
