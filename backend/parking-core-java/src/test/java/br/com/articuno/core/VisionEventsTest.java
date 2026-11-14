package br.com.articuno.core;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.net.URI;
import java.net.http.*;
import java.nio.file.Path;
import java.sql.DriverManager;
import java.util.*;
import java.util.concurrent.CompletableFuture;
import java.util.stream.Stream;
import javax.sql.DataSource;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.*;
import org.springframework.boot.builder.SpringApplicationBuilder;
import org.springframework.boot.web.servlet.context.ServletWebServerApplicationContext;
import org.springframework.context.ConfigurableApplicationContext;
import org.springframework.jdbc.core.JdbcTemplate;
import static org.assertj.core.api.Assertions.*;

class VisionEventsTest {
    private static final String KEY = "test-only-key-never-use-outside-tests-0123456789";
    private static final String ROUTE = "/api/v1/internal/vision-events";
    private static final ObjectMapper JSON = new ObjectMapper();
    @TempDir Path directory;

    private static ObjectNode event() {
        var node = JSON.createObjectNode();
        node.put("event_id", UUID.randomUUID().toString());
        node.put("camera_id", "CAM_ENTRADA");
        node.put("event_type", "ENTRY");
        node.put("plate", "ABC1D23");
        node.putNull("session_id");
        node.putNull("origin_sector");
        node.putNull("destination_sector");
        node.put("detected_at", "2026-11-14T09:30:00-03:00");
        node.putNull("confidence");
        node.put("source", "SIMULATION");
        return node;
    }

    private Server start(String key) {
        return new Server(directory.resolve("events.db"), key);
    }

    private static class Server implements AutoCloseable {
        final ConfigurableApplicationContext context;
        final HttpClient client;
        final String origin;
        final JdbcTemplate jdbc;
        Server(Path database, String key) {
            context = new SpringApplicationBuilder(CoreApplication.class).run(
                    "--CORE_DB_PATH=" + database, "--CORE_PORT=0", "--server.port=0",
                    "--CORE_BIND_ADDRESS=127.0.0.1", "--INTERNAL_API_KEY=" + key,
                    "--logging.level.root=OFF", "--spring.main.banner-mode=off");
            client = HttpClient.newHttpClient();
            origin = "http://127.0.0.1:" + ((ServletWebServerApplicationContext) context).getWebServer().getPort();
            jdbc = new JdbcTemplate(context.getBean(DataSource.class));
        }
        HttpRequest request(String body, String key) {
            var builder = HttpRequest.newBuilder(URI.create(origin + ROUTE))
                    .header("Content-Type", "application/json").POST(HttpRequest.BodyPublishers.ofString(body));
            if (key != null) builder.header("X-Internal-API-Key", key);
            return builder.build();
        }
        HttpResponse<String> post(String body, String key) throws Exception {
            return client.send(request(body, key), HttpResponse.BodyHandlers.ofString());
        }
        HttpResponse<String> get(String path, String key) throws Exception {
            var builder = HttpRequest.newBuilder(URI.create(origin + path));
            if (key != null) builder.header("X-Internal-API-Key", key);
            return client.send(builder.build(), HttpResponse.BodyHandlers.ofString());
        }
        int count() { return jdbc.queryForObject("SELECT COUNT(*) FROM vision_events", Integer.class); }
        public void close() { client.close(); context.close(); }
    }

    @Test
    void recordsPythonWireFixturesAndReturnsStableReceipt() throws Exception {
        JsonNode fixtures = JSON.readTree(getClass().getResourceAsStream("/vision-events-python.json"));
        try (var server = start(KEY)) {
            for (JsonNode fixture : fixtures) {
                var response = server.post(fixture.toString(), KEY);
                assertThat(response.statusCode()).isEqualTo(200);
                JsonNode receipt = JSON.readTree(response.body());
                assertThat(receipt.path("event_id").asText()).isEqualTo(fixture.path("event_id").asText());
                assertThat(receipt.path("status").asText()).isEqualTo("RECORDED");
                assertThat(receipt.path("received_at").asText()).endsWith("Z");
                assertThat(receipt.has("session_id")).isFalse();
                var stored = server.get(ROUTE + "/" + fixture.path("event_id").asText(), KEY);
                assertThat(stored.statusCode()).isEqualTo(200);
                assertThat(JSON.readTree(stored.body()).path("event").path("event_type")).isEqualTo(fixture.path("event_type"));
                assertThat(server.post(fixture.toPrettyString(), KEY).body()).isEqualTo(response.body());
            }
            assertThat(server.count()).isEqualTo(3);
        }
    }

    @Test
    void acceptsManualEntryAndKnownSessionWithoutInventingPlateOrConfidence() throws Exception {
        try (var server = start(KEY)) {
            var input = event().put("source", "ASSISTED");
            input.putNull("plate");
            assertThat(server.post(input.toString(), KEY).statusCode()).isEqualTo(200);
            input.put("event_id", UUID.randomUUID().toString()).put("camera_id", "CAM_SAIDA")
                    .put("event_type", "EXIT").put("session_id", "known-session");
            assertThat(server.post(input.toString(), KEY).statusCode()).isEqualTo(200);
            assertThat(server.count()).isEqualTo(2);
        }
    }

    @Test
    void authenticatesBeforeParsingAndProtectsLookup() throws Exception {
        try (var server = start(KEY)) {
            for (String key : new String[] {null, "wrong-key"}) {
                var response = server.post("{broken private-body", key);
                assertThat(response.statusCode()).isEqualTo(401);
                assertThat(response.body()).doesNotContain(KEY, "wrong-key", "private-body");
                assertThat(server.get(ROUTE + "/" + UUID.randomUUID(), key).statusCode()).isEqualTo(401);
            }
            var duplicateHeaders = HttpRequest.newBuilder(URI.create(server.origin + ROUTE))
                    .header("Content-Type", "application/json").header("X-Internal-API-Key", KEY)
                    .header("X-Internal-API-Key", KEY).POST(HttpRequest.BodyPublishers.ofString(event().toString())).build();
            assertThat(server.client.send(duplicateHeaders, HttpResponse.BodyHandlers.ofString()).statusCode()).isEqualTo(401);
            assertThat(server.count()).isZero();
        }
    }

    @Test
    void apiKeyIsLiteralAndMatchesTheUnchangedPythonClient() throws Exception {
        String literal = "${unused.property:" + KEY + "}";
        try (var server = start(literal)) {
            assertThat(server.post(event().toString(), literal).statusCode()).isEqualTo(200);
            assertThat(server.post(event().toString(), KEY).statusCode()).isEqualTo(401);
        }
    }

    @Test
    void unrepresentableJsonNumberReturnsSanitizedClientError() throws Exception {
        try (var server = start(KEY)) {
            var input = event().put("source", "OCR").put("confidence", .9);
            String body = input.toString().replace("\"confidence\":0.9", "\"confidence\":1e-2147483648");
            assertThat(server.post(body, KEY).statusCode()).isEqualTo(400);
            assertThat(server.count()).isZero();
        }
    }

    @ParameterizedTest @ValueSource(strings = {"+23:00", "-23:59"})
    void acceptsTimezoneOffsetsEmittedByPython(String offset) throws Exception {
        try (var server = start(KEY)) {
            var input = event().put("detected_at", "2026-11-14T09:30:00" + offset);
            assertThat(server.post(input.toString(), KEY).statusCode()).isEqualTo(200);
            input.put("detected_at", offset.equals("+23:00") ? "2026-11-13T10:30:00Z" : "2026-11-15T09:29:00Z");
            assertThat(server.post(input.toString(), KEY).statusCode()).isEqualTo(200);
            assertThat(server.count()).isEqualTo(1);
        }
    }

    @Test
    void absentKeyDisablesReceiverButKeepsHealth() throws Exception {
        try (var server = start("")) {
            assertThat(server.post(event().toString(), KEY).statusCode()).isEqualTo(503);
            assertThat(server.get("/health", null).statusCode()).isEqualTo(200);
            assertThat(server.count()).isZero();
        }
    }

    static Stream<Arguments> invalidFields() {
        return Stream.of(
            Arguments.of("event_id", "not-a-uuid"), Arguments.of("event_id", "1-1-1-1-1"),
            Arguments.of("camera_id", ""), Arguments.of("camera_id", "CAM A"),
            Arguments.of("camera_id", "x".repeat(129)), Arguments.of("camera_id", 12),
            Arguments.of("event_type", "entry"), Arguments.of("source", "SIMULATED"),
            Arguments.of("plate", "AP05JEO"), Arguments.of("plate", "abc1d23"),
            Arguments.of("confidence", -.1), Arguments.of("confidence", 1.1),
            Arguments.of("confidence", .9), Arguments.of("session_id", "bad session"),
            Arguments.of("detected_at", "2026-11-14T09:30:00"),
            Arguments.of("detected_at", 123), Arguments.of("origin_sector", "A"),
            Arguments.of("unexpected-private-field", "private-value"));
    }

    @ParameterizedTest @MethodSource("invalidFields")
    void rejectsInvalidFieldsWithoutStoringOrEchoingPayload(String name, Object value) throws Exception {
        try (var server = start(KEY)) {
            var input = event();
            input.set(name, JSON.valueToTree(value));
            var response = server.post(input.toString(), KEY);
            assertThat(response.statusCode()).isEqualTo(422);
            assertThat(response.body()).doesNotContain("ABC1D23", "private-value", "unexpected-private-field");
            assertThat(server.count()).isZero();
        }
    }

    @Test
    void enforcesRequiredFieldsOcrEvidenceAndPassageShape() throws Exception {
        try (var server = start(KEY)) {
            for (String required : List.of("event_id", "camera_id", "event_type", "source", "detected_at")) {
                var input = event(); input.remove(required);
                assertThat(server.post(input.toString(), KEY).statusCode()).isEqualTo(422);
            }
            var ocr = event().put("source", "OCR");
            assertThat(server.post(ocr.toString(), KEY).statusCode()).isEqualTo(422);
            ocr.put("confidence", "0.9");
            assertThat(server.post(ocr.toString(), KEY).statusCode()).isEqualTo(422);
            ocr.put("confidence", .9);
            assertThat(server.post(ocr.toString(), KEY).statusCode()).isEqualTo(200);
            var passage = event().put("event_type", "PASSAGE").put("camera_id", "CAM_A_B");
            assertThat(server.post(passage.toString(), KEY).statusCode()).isEqualTo(422);
            passage.put("origin_sector", "A").put("destination_sector", "A");
            assertThat(server.post(passage.toString(), KEY).statusCode()).isEqualTo(422);
            passage.put("destination_sector", "B").putNull("plate");
            assertThat(server.post(passage.toString(), KEY).statusCode()).isEqualTo(422);
            assertThat(server.count()).isEqualTo(1);
        }
    }

    @Test
    void rejectsMalformedDuplicateTrailingAndOversizedJsonAndWrongMedia() throws Exception {
        try (var server = start(KEY)) {
            for (String invalid : List.of("", "   ", "{", event() + " {}", "{\"event_id\":\"a\",\"event_id\":\"b\"}")) {
                assertThat(server.post(invalid, KEY).statusCode()).as("malformed JSON length=%d", invalid.length()).isEqualTo(400);
            }
            assertThat(server.post(" ".repeat(16385), KEY).statusCode()).isEqualTo(413);
            assertThat(server.post("null", KEY).statusCode()).isEqualTo(422);
            var wrongMedia = HttpRequest.newBuilder(URI.create(server.origin + ROUTE))
                    .header("Content-Type", "text/plain").header("X-Internal-API-Key", KEY)
                    .POST(HttpRequest.BodyPublishers.ofString(event().toString())).build();
            assertThat(server.client.send(wrongMedia, HttpResponse.BodyHandlers.ofString()).statusCode()).isEqualTo(415);
            assertThat(server.count()).isZero();
        }
    }

    @Test
    void canonicalReplaySurvivesRestartAndRejectsConflictingPayload() throws Exception {
        var input = event();
        String receipt;
        try (var server = start(KEY)) {
            receipt = server.post(input.toString(), KEY).body();
        }
        try (var server = start(KEY)) {
            input.put("detected_at", "2026-11-14T12:30:00Z");
            input.remove(List.of("session_id", "origin_sector", "destination_sector", "confidence"));
            assertThat(server.post(input.toPrettyString(), KEY).body()).isEqualTo(receipt);
            var conflict = input.deepCopy().put("plate", "XYZ9876");
            assertThat(server.post(conflict.toString(), KEY).statusCode()).isEqualTo(409);
            assertThat(server.post(input.toString(), KEY).body()).isEqualTo(receipt);
            input.put("event_id", UUID.randomUUID().toString());
            assertThat(server.post(input.toString(), KEY).statusCode()).isEqualTo(200);
            assertThat(server.count()).isEqualTo(2);
        }
    }

    @Test
    void numericConfidenceFormattingDoesNotCreateAConflict() throws Exception {
        try (var server = start(KEY)) {
            var input = event().put("source", "OCR").put("confidence", new java.math.BigDecimal("0.900"));
            var original = server.post(input.toString(), KEY);
            assertThat(original.statusCode()).isEqualTo(200);
            input.put("confidence", new java.math.BigDecimal("0.9"));
            assertThat(server.post(input.toString(), KEY).body()).isEqualTo(original.body());
            input.put("confidence", new java.math.BigDecimal("0.91"));
            assertThat(server.post(input.toString(), KEY).statusCode()).isEqualTo(409);
            assertThat(server.count()).isEqualTo(1);
        }
    }

    @Test
    void concurrentRequestsAcrossTwoApplicationsInsertOnlyOnce() throws Exception {
        try (var first = start(KEY); var second = start(KEY)) {
            String payload = event().toString();
            var futures = new ArrayList<CompletableFuture<HttpResponse<String>>>();
            for (int i = 0; i < 12; i++) {
                var server = i % 2 == 0 ? first : second;
                futures.add(server.client.sendAsync(server.request(payload, KEY), HttpResponse.BodyHandlers.ofString()));
            }
            var responses = futures.stream().map(CompletableFuture::join).toList();
            assertThat(responses).allSatisfy(r -> assertThat(r.statusCode()).isEqualTo(200));
            assertThat(responses.stream().map(HttpResponse::body).distinct()).hasSize(1);
            assertThat(first.count()).isEqualTo(1);
        }
    }

    @Test
    void upgradesVersionOneWithoutLosingExistingData() throws Exception {
        try (var c = DriverManager.getConnection("jdbc:sqlite:" + directory.resolve("events.db"));
             var s = c.createStatement()) {
            s.executeUpdate("CREATE TABLE app_metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL)");
            s.executeUpdate("INSERT INTO app_metadata VALUES ('schema_version','1'),('marker','preserved')");
        }
        try (var server = start(KEY)) {
            assertThat(server.jdbc.queryForObject("SELECT value FROM app_metadata WHERE key='marker'", String.class)).isEqualTo("preserved");
            assertThat(server.jdbc.queryForObject("SELECT value FROM app_metadata WHERE key='schema_version'", String.class)).isEqualTo("2");
            assertThat(server.post(event().toString(), KEY).statusCode()).isEqualTo(200);
        }
    }

    @Test
    void missingEventAndDatabaseFailureAreExplicit() throws Exception {
        try (var server = start(KEY)) {
            assertThat(server.get(ROUTE + "/" + UUID.randomUUID(), KEY).statusCode()).isEqualTo(404);
            server.jdbc.execute("DROP TABLE vision_events");
            var response = server.post(event().toString(), KEY);
            assertThat(response.statusCode()).isEqualTo(503);
            assertThat(response.body()).isEqualTo("{\"error\":\"database_unavailable\"}");
        }
    }

    @ParameterizedTest @ValueSource(strings = {"short-private-key", "${private-key}", "invalid private key with spaces 0123456789"})
    void invalidKeyConfigurationIsSanitized(String key) {
        Throwable failure = catchThrowable(() -> { try (var server = start(key)) { } });
        assertThat(failure).isNotNull();
        var text = new java.io.StringWriter(); failure.printStackTrace(new java.io.PrintWriter(text));
        assertThat(text.toString()).contains("INTERNAL_API_KEY").doesNotContain(key, "private-key");
    }
}
