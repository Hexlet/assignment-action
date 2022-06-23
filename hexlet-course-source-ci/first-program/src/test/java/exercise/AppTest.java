package exercise;

import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.assertThat;
import static com.github.stefanbirkner.systemlambda.SystemLambda.*;

class AppTest {
    @Test
    void testMain() throws Exception {
        String result = tapSystemOut(() -> {
            App.main(null);
        });
        assertThat(result.trim()).isEqualTo("This is Hexlet!");
    }
}
