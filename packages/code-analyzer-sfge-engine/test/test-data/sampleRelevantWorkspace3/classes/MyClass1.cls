public class MyClass1 {
	public String someMethod() {
	    // This operation has no CRUD check, and is therefore insecure. And since this class is denoted as a controller
	    // by MyVfPage.page, that means this should throw an FLS violation as long as the VF page is included in the
	    // workspace.
	    Account[] accs = [SELECT Name FROM Account];
		return 'beep';
	}
}
