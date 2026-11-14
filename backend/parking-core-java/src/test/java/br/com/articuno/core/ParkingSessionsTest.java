package br.com.articuno.core;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.net.URI;
import java.net.http.*;
import java.nio.file.*;
import java.sql.DriverManager;
import java.util.*;
import java.util.concurrent.CompletableFuture;
import javax.sql.DataSource;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.boot.builder.SpringApplicationBuilder;
import org.springframework.boot.web.servlet.context.ServletWebServerApplicationContext;
import org.springframework.context.ConfigurableApplicationContext;
import org.springframework.jdbc.core.JdbcTemplate;
import static org.assertj.core.api.Assertions.*;

class ParkingSessionsTest {
    private static final ObjectMapper JSON = new ObjectMapper();
    private static final String KEY = "test-only-key-never-use-outside-tests-0123456789";
    private static final String API = "/api/v1/internal";
    @TempDir Path directory;

    private ObjectNode event(String type, String plate) {
        var node = JSON.createObjectNode().put("event_id", UUID.randomUUID().toString())
                .put("event_type", type).put("plate", plate).put("source", "ASSISTED")
                .put("detected_at", "2026-11-14T12:30:00Z");
        node.put("camera_id", switch (type) { case "ENTRY" -> "CAM_ENTRADA"; case "PASSAGE" -> "CAM_A_B"; default -> "CAM_SAIDA"; });
        if (type.equals("PASSAGE")) node.put("origin_sector", "A").put("destination_sector", "B");
        return node;
    }

    private ObjectNode layout(int capacity) throws Exception {
        return (ObjectNode) JSON.readTree("""
            {"sectors":[{"sector_id":"A","capacity":20},{"sector_id":"B","capacity":20}],
             "cameras":[{"camera_id":"CAM_ENTRADA","event_type":"ENTRY","sector_id":"A"},
                        {"camera_id":"CAM_A_B","event_type":"PASSAGE","origin_sector":"A","destination_sector":"B"},
                        {"camera_id":"CAM_SAIDA","event_type":"EXIT","sector_id":"B"}]}
            """.replace("\"capacity\":20", "\"capacity\":" + capacity));
    }

    private Server start(int capacity) throws Exception { return start(layout(capacity)); }
    private Server start(ObjectNode layout) throws Exception {
        Path file = directory.resolve("layout.json");
        Files.writeString(file, layout.toString());
        return new Server(file);
    }

    private class Server implements AutoCloseable {
        final ConfigurableApplicationContext context;
        final HttpClient client;
        final String origin;
        final JdbcTemplate jdbc;
        Server(Path layout) {
            context = new SpringApplicationBuilder(CoreApplication.class).run(
                    "--CORE_DB_PATH=" + directory.resolve("parking.db"), "--CORE_PORT=0", "--server.port=0",
                    "--CORE_BIND_ADDRESS=127.0.0.1", "--INTERNAL_API_KEY=" + KEY,
                    "--CORE_LAYOUT_PATH=" + layout, "--logging.level.root=OFF", "--spring.main.banner-mode=off");
            client = HttpClient.newHttpClient();
            origin = "http://127.0.0.1:" + ((ServletWebServerApplicationContext) context).getWebServer().getPort();
            jdbc = new JdbcTemplate(context.getBean(DataSource.class));
        }
        HttpRequest request(ObjectNode event) {
            return HttpRequest.newBuilder(URI.create(origin + API + "/vision-events"))
                    .header("X-Internal-API-Key", KEY).header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(event.toString())).build();
        }
        HttpResponse<String> post(ObjectNode event) throws Exception {
            return client.send(request(event), HttpResponse.BodyHandlers.ofString());
        }
        HttpResponse<String> get(String path, String key) throws Exception {
            var request = HttpRequest.newBuilder(URI.create(origin + API + path));
            if (key != null) request.header("X-Internal-API-Key", key);
            return client.send(request.build(), HttpResponse.BodyHandlers.ofString());
        }
        JsonNode read(String path) throws Exception {
            var response = get(path, KEY);
            assertThat(response.statusCode()).as(path).isEqualTo(200);
            return JSON.readTree(response.body());
        }
        String accepted(ObjectNode event) throws Exception {
            var response = post(event);
            assertThat(response.statusCode()).as(response.body()).isEqualTo(200);
            var receipt = JSON.readTree(response.body());
            assertThat(receipt.path("status").asText()).isEqualTo("APPLIED");
            assertThat(receipt.path("session_id").asText()).isNotEmpty();
            return receipt.path("session_id").asText();
        }
        int count(String table) { return jdbc.queryForObject("SELECT COUNT(*) FROM " + table, Integer.class); }
        public void close() { client.close(); context.close(); }
    }

    @Test void entryPassageQueriesAndExitFailClosed() throws Exception {
        try (var server = start(2)) {
            var entry = event("ENTRY", "ABC1D23");
            String id = server.accepted(entry);
            assertThat(server.read("/sessions/" + id).path("sector_id").asText()).isEqualTo("A");
            assertThat(server.read("/dashboard").path("occupied_estimated").asInt()).isEqualTo(1);
            assertThat(server.read("/dashboard").path("free_estimated").asInt()).isEqualTo(3);
            assertThat(server.read("/dashboard").path("estimated").asBoolean()).isTrue();
            var passage = event("PASSAGE", "ABC1D23").put("detected_at", "2026-11-14T12:31:00Z");
            assertThat(server.accepted(passage)).isEqualTo(id);
            var sectors = server.read("/sectors").path("items");
            assertThat(sectors.get(0).path("occupied_estimated").asInt()).isZero();
            assertThat(sectors.get(1).path("occupied_estimated").asInt()).isEqualTo(1);
            assertThat(server.read("/sessions/" + id).path("sector_id").asText()).isEqualTo("B");
            var exit = event("EXIT", "ABC1D23").put("detected_at", "2026-11-14T12:32:00Z");
            var denied = server.post(exit);
            assertThat(denied.statusCode()).isEqualTo(403);
            assertThat(JSON.readTree(denied.body()).path("error").asText()).isEqualTo("exit_authorization_required");
            assertThat(server.post(exit).body()).isEqualTo(denied.body());
            assertThat(server.read("/sessions/" + id).path("status").asText()).isEqualTo("ACTIVE");
            assertThat(server.read("/dashboard").path("active_sessions").asInt()).isEqualTo(1);
            assertThat(server.count("vision_events")).isEqualTo(3);
        }
    }

    @Test void manualSessionUsesReturnedIdWithoutInventingPlate() throws Exception {
        try (var server = start(2)) {
            String id = server.accepted(event("ENTRY", null));
            assertThat(server.read("/sessions/" + id).path("plate").isNull()).isTrue();
            assertThat(server.accepted(event("PASSAGE", null).put("session_id", id))).isEqualTo(id);
            assertThat(server.post(event("EXIT", null).put("session_id", id)).statusCode()).isEqualTo(403);
            assertThat(server.post(event("ENTRY", null).put("session_id", id)).statusCode()).isEqualTo(422);
            assertThat(server.count("parking_sessions")).isEqualTo(1);
        }
    }

    @Test void replayAfterMovementAndRestartReturnsOriginalReceipt() throws Exception {
        var entry = event("ENTRY", "ABC1234");
        String receipt; String id;
        try (var server = start(2)) {
            id = server.accepted(entry);
            receipt = server.post(entry).body();
            server.accepted(event("PASSAGE", "ABC1234"));
        }
        try (var server = start(2)) {
            assertThat(server.post(entry).body()).isEqualTo(receipt);
            assertThat(server.read("/sessions/" + id).path("sector_id").asText()).isEqualTo("B");
            assertThat(server.count("parking_sessions")).isEqualTo(1);
            assertThat(server.post(entry.deepCopy().put("plate", "XYZ9876")).statusCode()).isEqualTo(409);
        }
    }

    @Test void duplicatePlateAndInconsistentIdentityDoNotCreateOrMoveSessions() throws Exception {
        try (var server = start(3)) {
            String first = server.accepted(event("ENTRY", "ABC1234"));
            String other = server.accepted(event("ENTRY", "XYZ9876"));
            assertThat(server.post(event("ENTRY", "ABC1234")).statusCode()).isEqualTo(409);
            assertThat(server.post(event("PASSAGE", "ABC1234").put("session_id", other)).statusCode()).isEqualTo(409);
            assertThat(server.post(event("PASSAGE", "ABC1234").put("session_id", "unknown")).statusCode()).isEqualTo(404);
            assertThat(server.post(event("PASSAGE", "QQQ1234")).statusCode()).isEqualTo(404);
            assertThat(server.read("/sessions/" + first).path("sector_id").asText()).isEqualTo("A");
            assertThat(server.read("/dashboard").path("active_sessions").asInt()).isEqualTo(2);
        }
    }

    @Test void cameraRouteSectorAndStaleTimeAreValidated() throws Exception {
        try (var server = start(3)) {
            String id = server.accepted(event("ENTRY", "ABC1234"));
            assertThat(server.post(event("ENTRY", "XYZ9876").put("camera_id", "UNKNOWN")).statusCode()).isEqualTo(422);
            assertThat(server.post(event("PASSAGE", "ABC1234").put("camera_id", "CAM_ENTRADA")).statusCode()).isEqualTo(422);
            assertThat(server.post(event("PASSAGE", "ABC1234").put("destination_sector", "C")).statusCode()).isEqualTo(422);
            assertThat(server.post(event("PASSAGE", "ABC1234").put("detected_at", "2026-11-14T12:29:59Z")).statusCode()).isEqualTo(409);
            assertThat(server.post(event("EXIT", "ABC1234")).statusCode()).isEqualTo(409);
            server.accepted(event("PASSAGE", "ABC1234"));
            assertThat(server.post(event("PASSAGE", "ABC1234")).statusCode()).isEqualTo(409);
            assertThat(server.read("/sessions/" + id).path("sector_id").asText()).isEqualTo("B");
        }
    }

    @Test void fullEntryIsStableRejectionEvenAfterSpaceBecomesFree() throws Exception {
        try (var server = start(1)) {
            server.accepted(event("ENTRY", "ABC1234"));
            var waiting = event("ENTRY", "XYZ9876");
            var denied = server.post(waiting);
            assertThat(denied.statusCode()).isEqualTo(409);
            assertThat(JSON.readTree(denied.body()).path("error").asText()).isEqualTo("sector_full");
            server.accepted(event("PASSAGE", "ABC1234"));
            assertThat(server.post(waiting).body()).isEqualTo(denied.body());
            assertThat(server.post(waiting).statusCode()).isEqualTo(409);
            server.accepted(waiting.deepCopy().put("event_id", UUID.randomUUID().toString()));
            assertThat(server.post(event("PASSAGE", "XYZ9876")).statusCode()).isEqualTo(409);
            assertThat(server.read("/dashboard").path("occupied_estimated").asInt()).isEqualTo(2);
            assertThat(server.read("/dashboard").path("free_estimated").asInt()).isZero();
        }
    }

    @Test void concurrentDifferentEntriesCannotOverbookLastSpace() throws Exception {
        try (var first = start(1); var second = start(1)) {
            var tasks = new ArrayList<CompletableFuture<HttpResponse<String>>>();
            for (int i = 0; i < 12; i++) {
                var server = i % 2 == 0 ? first : second;
                tasks.add(server.client.sendAsync(server.request(event("ENTRY", "ABC" + (1000 + i))), HttpResponse.BodyHandlers.ofString()));
            }
            var results = tasks.stream().map(CompletableFuture::join).toList();
            assertThat(results.stream().filter(r -> r.statusCode() == 200)).hasSize(1);
            assertThat(results.stream().filter(r -> r.statusCode() == 409)).hasSize(11);
            assertThat(first.count("parking_sessions")).isEqualTo(1);
            assertThat(first.count("vision_events")).isEqualTo(12);
            assertThat(first.read("/sectors").path("items").get(0).path("free_estimated").asInt()).isZero();
        }
    }

    @Test void sqlFailureAfterSessionWriteRollsBackEventAndSession() throws Exception {
        try (var server = start(2)) {
            server.jdbc.execute("CREATE TRIGGER force_receipt_failure BEFORE UPDATE ON vision_events BEGIN SELECT RAISE(ABORT,'private-db-error'); END");
            var input = event("ENTRY", "ABC1234");
            var response = server.post(input);
            assertThat(response.statusCode()).isEqualTo(503);
            assertThat(response.body()).doesNotContain("private-db-error", "ABC1234");
            assertThat(server.count("vision_events")).isZero();
            assertThat(server.count("parking_sessions")).isZero();
            server.jdbc.execute("DROP TRIGGER force_receipt_failure");
            String id = server.accepted(input);
            server.jdbc.execute("CREATE TRIGGER force_receipt_failure BEFORE UPDATE ON vision_events BEGIN SELECT RAISE(ABORT,'private-db-error'); END");
            var passage = event("PASSAGE", "ABC1234");
            assertThat(server.post(passage).statusCode()).isEqualTo(503);
            assertThat(server.count("vision_events")).isEqualTo(1);
            assertThat(server.read("/sessions/" + id).path("sector_id").asText()).isEqualTo("A");
            server.jdbc.execute("DROP TRIGGER force_receipt_failure");
            server.accepted(passage);
        }
    }

    @Test void concurrentPassagesCannotOverbookDestination() throws Exception {
        var config = layout(2);
        ((ObjectNode) config.path("sectors").get(1)).put("capacity", 1);
        try (var first = start(config); var second = start(config)) {
            first.accepted(event("ENTRY", "ABC1234"));
            first.accepted(event("ENTRY", "XYZ9876"));
            var a = first.client.sendAsync(first.request(event("PASSAGE", "ABC1234")), HttpResponse.BodyHandlers.ofString());
            var b = second.client.sendAsync(second.request(event("PASSAGE", "XYZ9876")), HttpResponse.BodyHandlers.ofString());
            assertThat(List.of(a.join().statusCode(), b.join().statusCode())).containsExactlyInAnyOrder(200, 409);
            for (var sector : first.read("/sectors").path("items")) {
                assertThat(sector.path("occupied_estimated").asInt()).isEqualTo(1);
            }
            assertThat(first.read("/dashboard").path("active_sessions").asInt()).isEqualTo(2);
        }
    }

    @Test void queriesRequireAuthenticationAndBoundPagination() throws Exception {
        try (var server = start(3)) {
            for (String path : List.of("/sessions", "/sessions/unknown", "/sectors", "/dashboard")) {
                assertThat(server.get(path, null).statusCode()).isEqualTo(401);
                assertThat(server.get(path, "wrong").statusCode()).isEqualTo(401);
            }
            assertThat(server.read("/sessions").path("items").isEmpty()).isTrue();
            assertThat(server.get("/sessions/unknown", KEY).statusCode()).isEqualTo(404);
            for (String query : List.of("limit=0", "limit=101", "offset=-1", "limit=bad")) {
                assertThat(server.get("/sessions?" + query, KEY).statusCode()).isBetween(400, 422);
            }
            server.accepted(event("ENTRY", "ABC1234"));
            server.accepted(event("ENTRY", "XYZ9876"));
            assertThat(server.read("/sessions?limit=1&offset=1").path("items").size()).isEqualTo(1);
        }
    }

    @Test void capacityChangesPersistButCannotHideExistingOccupancy() throws Exception {
        try (var server = start(2)) {
            server.accepted(event("ENTRY", "ABC1234"));
            server.accepted(event("ENTRY", "XYZ9876"));
        }
        assertThat(catchThrowable(() -> { try (var ignored = start(1)) {} })).isNotNull();
        try (var server = start(3)) {
            assertThat(server.read("/dashboard").path("total_capacity").asInt()).isEqualTo(6);
            assertThat(server.read("/dashboard").path("active_sessions").asInt()).isEqualTo(2);
        }
        var changed = layout(3);
        ((ObjectNode) changed.path("cameras").get(0)).put("sector_id", "B");
        assertThat(catchThrowable(() -> { try (var ignored = start(changed)) {} })).isNotNull();
        try (var server = start(3)) {
            assertThat(server.read("/sectors").path("items").get(0).path("occupied_estimated").asInt()).isEqualTo(2);
        }
    }

    @ParameterizedTest @ValueSource(strings = {"zero", "text-capacity", "duplicate-sector", "unknown-sector", "duplicate-camera", "wrong-type", "extra"})
    void invalidLayoutFailsWithoutEchoingPrivateContent(String kind) throws Exception {
        var config = layout(2);
        var sector = (ObjectNode) config.path("sectors").get(0);
        var camera = (ObjectNode) config.path("cameras").get(0);
        switch (kind) {
            case "zero" -> sector.put("capacity", 0);
            case "text-capacity" -> sector.put("capacity", "2");
            case "duplicate-sector" -> ((ObjectNode) config.path("sectors").get(1)).put("sector_id", "A");
            case "unknown-sector" -> camera.put("sector_id", "private-unknown-sector");
            case "duplicate-camera" -> ((ObjectNode) config.path("cameras").get(1)).put("camera_id", "CAM_ENTRADA");
            case "wrong-type" -> camera.put("event_type", "private-wrong-type");
            default -> config.put("unexpected", "private-layout-value");
        }
        Throwable failure = catchThrowable(() -> { try (var ignored = start(config)) {} });
        assertThat(failure).isNotNull();
        var text = new java.io.StringWriter(); failure.printStackTrace(new java.io.PrintWriter(text));
        assertThat(text.toString()).contains("CORE_LAYOUT_PATH").doesNotContain("private-unknown-sector", "private-wrong-type", "private-layout-value");
    }

    @Test void schemaTwoReceiptsRemainStableAndDoNotCreateRetroactiveSessions() throws Exception {
        var input = event("ENTRY", "ABC1234");
        String payload = new ObjectMapper().findAndRegisterModules()
                .disable(com.fasterxml.jackson.databind.SerializationFeature.WRITE_DATES_AS_TIMESTAMPS)
                .writeValueAsString(VisionEvent.parse(input));
        String receipt = "{\"event_id\":\"" + input.path("event_id").asText() + "\",\"status\":\"RECORDED\",\"received_at\":\"2026-11-14T12:30:01Z\"}";
        try (var c = DriverManager.getConnection("jdbc:sqlite:" + directory.resolve("parking.db")); var s = c.createStatement()) {
            s.executeUpdate("CREATE TABLE app_metadata (key TEXT PRIMARY KEY,value TEXT NOT NULL)");
            s.executeUpdate("INSERT INTO app_metadata VALUES ('schema_version','2')");
            s.executeUpdate("CREATE TABLE vision_events (event_id TEXT PRIMARY KEY NOT NULL,payload_json TEXT NOT NULL,receipt_json TEXT NOT NULL)");
            try (var insert = c.prepareStatement("INSERT INTO vision_events VALUES (?,?,?)")) {
                insert.setString(1, input.path("event_id").asText()); insert.setString(2, payload); insert.setString(3, receipt); insert.executeUpdate();
            }
        }
        try (var server = start(2)) {
            assertThat(server.post(input).body()).isEqualTo(receipt);
            assertThat(server.count("parking_sessions")).isZero();
            assertThat(server.jdbc.queryForObject("SELECT value FROM app_metadata WHERE key='schema_version'", String.class)).isEqualTo("3");
            server.accepted(event("ENTRY", "ABC1234"));
        }
    }
}
