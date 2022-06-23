package exercise;

class App {
    public static void numbers() {
        // BEGIN
        Number result = (8 / 2) + (100 % 3);
        System.out.println(result);
        // END
    }

    public static void strings() {
        // BEGIN
        String language = "Java";
        String sentence = language + " works on JVM";
        System.out.println(sentence);
        // END
    }

    public static void converting() {
        // BEGIN
        Number soldiersCount = 300;
        String name = "spartans";
        System.out.println(soldiersCount + " " + name);
        // END
    }
}
