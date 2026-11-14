package br.com.articuno.core;

import com.fasterxml.jackson.core.JsonParser;
import com.fasterxml.jackson.databind.*;
import java.io.IOException;
import java.nio.file.*;
import java.sql.*;
import java.util.*;
import org.springframework.core.env.Environment;

record ParkingLayout(SortedMap<String, Integer> sectors, SortedMap<String, Camera> cameras, String topology) {
    record Camera(String cameraId, VisionEvent.EventType eventType, String sectorId, String originSector, String destinationSector) {}

    static ParkingLayout load(Environment environment) {
        try {
            Path path = Path.of(environment.getProperty("CORE_LAYOUT_PATH", "./parking.example.json"));
            byte[] bytes;
            try (var stream = Files.newInputStream(path)) { bytes = stream.readNBytes(65537); }
            if (bytes.length > 65536) throw new IllegalArgumentException();
            var json = new ObjectMapper().enable(JsonParser.Feature.STRICT_DUPLICATE_DETECTION)
                    .enable(DeserializationFeature.FAIL_ON_TRAILING_TOKENS);
            JsonNode root = json.readTree(bytes);
            fields(root, Set.of("sectors", "cameras"));
            if (!root.path("sectors").isArray() || root.path("sectors").isEmpty()
                    || !root.path("cameras").isArray() || root.path("cameras").isEmpty()) throw new IllegalArgumentException();
            var sectors = new TreeMap<String, Integer>();
            for (var item : root.path("sectors")) {
                fields(item, Set.of("sector_id", "capacity"));
                String id = VisionEvent.identifier(item, "sector_id", true);
                var capacity = item.path("capacity");
                if (!capacity.isIntegralNumber() || !capacity.canConvertToInt() || capacity.intValue() < 1
                        || capacity.intValue() > 1_000_000 || sectors.put(id, capacity.intValue()) != null) throw new IllegalArgumentException();
            }
            var cameras = new TreeMap<String, Camera>();
            for (var item : root.path("cameras")) {
                fields(item, Set.of("camera_id", "event_type", "sector_id", "origin_sector", "destination_sector"));
                String id = VisionEvent.identifier(item, "camera_id", true);
                var type = VisionEvent.EventType.valueOf(item.path("event_type").asText());
                String sector = VisionEvent.identifier(item, "sector_id", false);
                String origin = VisionEvent.identifier(item, "origin_sector", false);
                String destination = VisionEvent.identifier(item, "destination_sector", false);
                if (type == VisionEvent.EventType.PASSAGE) {
                    if (sector != null || origin == null || destination == null || origin.equals(destination)
                            || !sectors.containsKey(origin) || !sectors.containsKey(destination)) throw new IllegalArgumentException();
                } else if (sector == null || !sectors.containsKey(sector) || origin != null || destination != null) {
                    throw new IllegalArgumentException();
                }
                if (cameras.put(id, new Camera(id, type, sector, origin, destination)) != null) throw new IllegalArgumentException();
            }
            var topology = new TreeMap<String, Object>();
            topology.put("sectors", sectors.keySet()); topology.put("cameras", cameras);
            return new ParkingLayout(Collections.unmodifiableSortedMap(sectors), Collections.unmodifiableSortedMap(cameras),
                    json.writeValueAsString(topology));
        } catch (IOException | RuntimeException failure) {
            // Config files and Spring placeholder errors may contain private content.
            throw new IllegalArgumentException("Invalid CORE_LAYOUT_PATH: provide a readable, valid sectors/cameras JSON file (max 64 KiB).");
        }
    }

    private static void fields(JsonNode node, Set<String> allowed) {
        if (node == null || !node.isObject()) throw new IllegalArgumentException();
        node.fieldNames().forEachRemaining(name -> { if (!allowed.contains(name)) throw new IllegalArgumentException(); });
    }

    void install(Connection connection) throws SQLException {
        String previous = null;
        try (var statement = connection.createStatement(); var result = statement.executeQuery(
                "SELECT value FROM app_metadata WHERE key='parking_topology'")) {
            if (result.next()) previous = result.getString(1);
        }
        if (previous != null && !previous.equals(topology)) {
            throw new IllegalArgumentException("CORE_LAYOUT_PATH topology differs from this database; an explicit migration is required.");
        }
        try (var insert = connection.prepareStatement("INSERT OR IGNORE INTO app_metadata VALUES ('parking_topology',?)")) {
            insert.setString(1, topology); insert.executeUpdate();
        }
        for (var sector : sectors.entrySet()) {
            try (var count = connection.prepareStatement("SELECT COUNT(*) FROM parking_sessions WHERE sector_id=? AND status='ACTIVE'")) {
                count.setString(1, sector.getKey());
                try (var result = count.executeQuery()) {
                    if (result.next() && result.getInt(1) > sector.getValue()) {
                        throw new IllegalArgumentException("CORE_LAYOUT_PATH capacity cannot be below active occupancy.");
                    }
                }
            }
            try (var update = connection.prepareStatement("INSERT INTO parking_sectors (sector_id,capacity) VALUES (?,?) "
                    + "ON CONFLICT(sector_id) DO UPDATE SET capacity=excluded.capacity")) {
                update.setString(1, sector.getKey()); update.setInt(2, sector.getValue()); update.executeUpdate();
            }
        }
    }
}
