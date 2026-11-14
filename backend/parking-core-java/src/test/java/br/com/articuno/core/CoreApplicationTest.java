package br.com.articuno.core;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.DriverManager;
import javax.sql.DataSource;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.springframework.boot.builder.SpringApplicationBuilder;
import org.springframework.boot.web.servlet.context.ServletWebServerApplicationContext;
import org.springframework.context.ConfigurableApplicationContext;
import org.springframework.jdbc.core.JdbcTemplate;

import static org.assertj.core.api.Assertions.*;

class CoreApplicationTest {
    @TempDir Path directory;

    private ConfigurableApplicationContext start(String... overrides) {
        var args = new java.util.ArrayList<String>();
        args.add("--CORE_DB_PATH=" + directory.resolve("core.db"));
        args.add("--CORE_PORT=0");
        args.add("--CORE_BIND_ADDRESS=127.0.0.1");
        args.add("--INTERNAL_API_KEY=");
        args.add("--CORE_LAYOUT_PATH=" + Path.of("parking.example.json").toAbsolutePath());
        args.add("--server.port=0");
        args.add("--spring.main.banner-mode=off");
        args.add("--logging.level.root=OFF");
        for (String override : overrides) {
            String prefix = override.substring(0, override.indexOf('=') + 1);
            args.removeIf(argument -> argument.startsWith(prefix));
            args.add(override);
        }
        return new SpringApplicationBuilder(CoreApplication.class).run(args.toArray(String[]::new));
    }

    @Test
    void healthUsesRealHttpAndDatabase() throws Exception {
        try (var context = start()) {
            int port = ((ServletWebServerApplicationContext) context).getWebServer().getPort();
            try (var client = HttpClient.newHttpClient()) {
                var response = client.send(HttpRequest.newBuilder(
                        URI.create("http://127.0.0.1:" + port + "/health")).build(),
                        HttpResponse.BodyHandlers.ofString());
                assertThat(response.statusCode()).isEqualTo(200);
                assertThat(response.body()).contains("\"status\":\"ok\"");
            }
        }
    }

    @Test
    void databaseSurvivesApplicationRestartWithoutOverwritingData() throws Exception {
        try (var context = start()) {
            var jdbc = new JdbcTemplate(context.getBean(DataSource.class));
            jdbc.execute("CREATE TABLE persistence_test (value TEXT NOT NULL)");
            jdbc.update("INSERT INTO persistence_test VALUES (?)", "persisted-marker");
        }
        assertThat(Files.size(directory.resolve("core.db"))).isGreaterThan(0);
        try (var context = start()) {
            var jdbc = new JdbcTemplate(context.getBean(DataSource.class));
            assertThat(jdbc.queryForObject("SELECT value FROM persistence_test", String.class))
                    .isEqualTo("persisted-marker");
            assertThat(jdbc.queryForObject(
                    "SELECT value FROM app_metadata WHERE key='schema_version'", String.class)).isEqualTo("3");
            assertThat(jdbc.queryForObject("PRAGMA foreign_keys", Integer.class)).isEqualTo(1);
        }
        // Independent connection proves this is an ordinary persistent SQLite file.
        try (var connection = DriverManager.getConnection("jdbc:sqlite:" + directory.resolve("core.db"));
             var statement = connection.createStatement();
             var result = statement.executeQuery("SELECT COUNT(*) FROM app_metadata WHERE key='schema_version'")) {
            assertThat(result.getInt(1)).isEqualTo(1);
        }
    }

    @Test
    void healthReturnsUnavailableWithoutExposingDatabaseDetails() throws Exception {
        try (var context = start(); var client = HttpClient.newHttpClient()) {
            int port = ((ServletWebServerApplicationContext) context).getWebServer().getPort();
            Files.writeString(directory.resolve("core.db"), "invalid sqlite private-marker");
            var response = client.send(HttpRequest.newBuilder(
                    URI.create("http://127.0.0.1:" + port + "/health")).build(),
                    HttpResponse.BodyHandlers.ofString());
            assertThat(response.statusCode()).isEqualTo(503);
            assertThat(response.body()).isEqualTo("{\"error\":\"database_unavailable\"}");
        }
    }

    @Test
    void unknownRouteAndWrongMethodKeepTheirHttpStatus() throws Exception {
        try (var context = start(); var client = HttpClient.newHttpClient()) {
            int port = ((ServletWebServerApplicationContext) context).getWebServer().getPort();
            var missing = client.send(HttpRequest.newBuilder(
                    URI.create("http://127.0.0.1:" + port + "/not-implemented")).build(),
                    HttpResponse.BodyHandlers.ofString());
            var wrongMethod = client.send(HttpRequest.newBuilder(
                    URI.create("http://127.0.0.1:" + port + "/health"))
                    .POST(HttpRequest.BodyPublishers.noBody()).build(), HttpResponse.BodyHandlers.ofString());
            assertThat(missing.statusCode()).isEqualTo(404);
            assertThat(wrongMethod.statusCode()).isEqualTo(405);
            assertThat(wrongMethod.body()).doesNotContain("exception", "trace");
        }
    }

    @Test
    void unsupportedDatabaseSchemaFailsClosed() throws Exception {
        try (var context = start()) {
            new JdbcTemplate(context.getBean(DataSource.class)).update(
                    "UPDATE app_metadata SET value='999' WHERE key='schema_version'");
        }
        Throwable failure = catchThrowable(() -> { try (var context = start()) { } });
        assertThat(failure).isNotNull().hasStackTraceContaining("Database initialization failed");
    }

    @ParameterizedTest
    @CsvSource({"CORE_PORT,-1", "CORE_PORT,65536", "CORE_PORT,private-value",
                "CORE_BIND_ADDRESS,private-value", "CORE_DB_PATH,''", "CORE_DB_PATH,:memory:",
                "CORE_DB_PATH,file:private-value?mode=memory", "CORE_PORT,${private-value}",
                "CORE_BIND_ADDRESS,${private-value}", "CORE_DB_PATH,${private-value}"})
    void invalidConfigurationFailsWithoutEchoingValue(String name, String value) {
        Throwable failure = catchThrowable(() -> {
            try (var context = start("--" + name + "=" + value)) {
                // Must not start with invalid settings.
            }
        });
        assertThat(failure).isNotNull();
        assertThat(failure).hasStackTraceContaining(name);
        if (value.contains("private-value")) {
            assertThat(stackTrace(failure)).doesNotContain("private-value");
        }
    }

    @Test
    void unusableDatabaseFailsWithoutRevealingPath() throws Exception {
        Path blocked = directory.resolve("private-marker");
        Files.writeString(blocked, "not a directory");
        Throwable failure = catchThrowable(() -> {
            try (var context = start("--CORE_DB_PATH=" + blocked.resolve("core.db"))) { }
        });
        assertThat(failure).isNotNull();
        assertThat(stackTrace(failure)).doesNotContain("private-marker");
    }

    private String stackTrace(Throwable failure) {
        var text = new java.io.StringWriter();
        failure.printStackTrace(new java.io.PrintWriter(text));
        return text.toString();
    }
}
