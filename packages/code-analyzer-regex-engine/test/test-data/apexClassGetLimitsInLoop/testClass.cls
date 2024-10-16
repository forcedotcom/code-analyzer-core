public class myCls {
    public static void someMethodWithForLoop() {
        for (Integer i = 0, j = 0; i < 10; i++) {
            System.debug('Hello World 1');
            Limits.getHeapSize();
            System.debug('Hello World 2');
        }
        for (Integer i = 0, j = 0; i < 10; i++) {
            Limits.getHeapSize();
        }
    }

    public static void someMethodWithDoWhileLoop() {
        Integer i = 0;
        do {
            System.debug('Hello World 1');
            Integer n = Limits.getHeapSize();
            System.debug('Hello World 2');
            i++;
        } while (i<10);
        i = 0;
        do {
            Integer n=Limits.getHeapSize();
        } while (++i<10);
    }

    public static void someMethodWithWhileLoop() {
        Integer i = 0;
        while(i<10) {
            System.debug('Hello World 1');
            System.debug(Limits.getHeapSize());
            System.debug('Hello World 2');
            i++;
        }
        while(i++<20) {
            System.debug( Limits.getHeapSize() );
        }
        while(i++<20) {
            // should not match the following
            aLimits.getHeapSize();
        }
    }
}  

