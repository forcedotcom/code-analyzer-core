package tmp;

import org.junit.jupiter.api.Test;

import java.io.ByteArrayOutputStream;
import java.io.PrintStream;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.is;

public class MainTest {

    @Test
    public void testMain() {
        String printedOutput = callMain();
        assertThat(printedOutput.trim(), is("Printing something"));
    }

    private static String callMain() {
        try (StdOutCaptor stdOutCaptor = new StdOutCaptor()) {
            Main.main(new String[]{});
            return stdOutCaptor.getCapturedOutput();
        }
    }

    public static class StdOutCaptor implements AutoCloseable {
        private final ByteArrayOutputStream outputStreamCaptor;
        private final PrintStream origStream;

        public StdOutCaptor() {
            this.origStream = System.out;
            this.outputStreamCaptor = new ByteArrayOutputStream();
            System.setOut(new PrintStream(this.outputStreamCaptor));
        }

        public String getCapturedOutput() {
            return this.outputStreamCaptor.toString();
        }

        @Override
        public void close() {
            System.setOut(this.origStream);
        }
    }
}
