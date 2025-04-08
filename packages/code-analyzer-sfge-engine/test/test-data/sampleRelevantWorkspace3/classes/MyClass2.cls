public class MyClass2 {
	public String someMethod() {
	    // This operation has no CRUD check, and is therefore insecure. However, this method isn't an entry point,
	    // so even if we include the VF page in the workspace, there should be no violation for this.
	    Account[] accs = [SELECT Name FROM Account];
		return 'beep';
	}
}
