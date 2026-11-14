package br.com.articuno.core;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.time.format.DateTimeParseException;
import java.util.Set;
import java.util.UUID;
import java.util.regex.Pattern;

@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
record VisionEvent(UUID eventId, String cameraId, EventType eventType, String plate,
                   String sessionId, String originSector, String destinationSector,
                   Instant detectedAt, BigDecimal confidence, Source source) {
    enum EventType { ENTRY, PASSAGE, EXIT }
    enum Source { OCR, ASSISTED, SIMULATION }
    private static final Set<String> FIELDS = Set.of("event_id", "camera_id", "event_type", "plate",
            "session_id", "origin_sector", "destination_sector", "detected_at", "confidence", "source");
    private static final Pattern IDENTIFIER = Pattern.compile("\\S+", Pattern.UNICODE_CHARACTER_CLASS);
    private static final Pattern PLATE = Pattern.compile("[A-Z]{3}(?:[0-9]{4}|[0-9][A-Z][0-9]{2})");
    private static final Pattern TIMESTAMP = Pattern.compile(
            "(\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(?:\\.\\d{1,9})?)(Z|([+-])(\\d{2}):(\\d{2}))");

    static VisionEvent parse(JsonNode input) {
        if (input == null || !input.isObject()) throw EventFailure.invalid("body");
        input.fieldNames().forEachRemaining(name -> {
            if (!FIELDS.contains(name)) throw EventFailure.invalid("body");
        });
        UUID id = uuid(text(input, "event_id", true));
        String camera = identifier(input, "camera_id", true);
        EventType type;
        Source source;
        try { type = EventType.valueOf(text(input, "event_type", true)); }
        catch (IllegalArgumentException failure) { throw EventFailure.invalid("event_type"); }
        try { source = Source.valueOf(text(input, "source", true)); }
        catch (IllegalArgumentException failure) { throw EventFailure.invalid("source"); }

        String plate = text(input, "plate", false);
        if (plate != null && !PLATE.matcher(plate).matches()) throw EventFailure.invalid("plate");
        String session = identifier(input, "session_id", false);
        String origin = identifier(input, "origin_sector", false);
        String destination = identifier(input, "destination_sector", false);
        if (type == EventType.PASSAGE) {
            if (origin == null || destination == null || origin.equals(destination)) {
                throw EventFailure.invalid("destination_sector");
            }
        } else if (origin != null || destination != null) {
            throw EventFailure.invalid("origin_sector");
        }
        if (type != EventType.ENTRY && plate == null && session == null) throw EventFailure.invalid("session_id");

        Instant detected = timestamp(text(input, "detected_at", true));

        JsonNode score = input.get("confidence");
        BigDecimal confidence = null;
        if (score != null && !score.isNull()) {
            if (!score.isNumber()) throw EventFailure.invalid("confidence");
            confidence = score.decimalValue().stripTrailingZeros();
            if (confidence.compareTo(BigDecimal.ZERO) < 0 || confidence.compareTo(BigDecimal.ONE) > 0) {
                throw EventFailure.invalid("confidence");
            }
        }
        if (source == Source.OCR) {
            if (plate == null) throw EventFailure.invalid("plate");
            if (confidence == null) throw EventFailure.invalid("confidence");
        } else if (confidence != null) {
            throw EventFailure.invalid("confidence");
        }
        return new VisionEvent(id, camera, type, plate, session, origin, destination, detected, confidence, source);
    }

    static UUID uuid(String value) {
        if (value == null || !value.matches("[a-fA-F0-9]{8}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{12}")) {
            throw EventFailure.invalid("event_id");
        }
        return UUID.fromString(value);
    }

    private static Instant timestamp(String value) {
        // Python emits offsets below 24h; Java ZoneOffset stops at 18h.
        var match = TIMESTAMP.matcher(value);
        if (!match.matches()) throw EventFailure.invalid("detected_at");
        try {
            var local = LocalDateTime.parse(match.group(1));
            if (local.getYear() < 1) throw EventFailure.invalid("detected_at");
            int seconds = 0;
            if (!"Z".equals(match.group(2))) {
                int hours = Integer.parseInt(match.group(4));
                int minutes = Integer.parseInt(match.group(5));
                if (hours > 23 || minutes > 59) throw EventFailure.invalid("detected_at");
                seconds = (hours * 3600 + minutes * 60) * ("-".equals(match.group(3)) ? -1 : 1);
            }
            return local.toInstant(ZoneOffset.UTC).minusSeconds(seconds);
        } catch (DateTimeParseException failure) { throw EventFailure.invalid("detected_at"); }
    }

    private static String text(JsonNode input, String field, boolean required) {
        JsonNode value = input.get(field);
        if (value == null || value.isNull()) {
            if (required) throw EventFailure.invalid(field);
            return null;
        }
        if (!value.isTextual()) throw EventFailure.invalid(field);
        return value.textValue();
    }

    static String identifier(JsonNode input, String field, boolean required) {
        String value = text(input, field, required);
        if (value != null && (value.codePointCount(0, value.length()) > 128 || !IDENTIFIER.matcher(value).matches())) {
            throw EventFailure.invalid(field);
        }
        return value;
    }
}
