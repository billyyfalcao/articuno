package br.com.articuno.core;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.core.JsonParser;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.*;
import jakarta.servlet.http.HttpServletRequest;
import java.io.IOException;
import java.time.Instant;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/internal/vision-events")
class VisionEventController {
    private static final int MAX_BODY_BYTES = 16 * 1024;
    private final ObjectMapper json;
    private final VisionEventStore store;

    VisionEventController(ObjectMapper mapper, VisionEventStore store) {
        json = mapper.copy().enable(JsonParser.Feature.STRICT_DUPLICATE_DETECTION)
                .enable(DeserializationFeature.FAIL_ON_TRAILING_TOKENS)
                .enable(DeserializationFeature.USE_BIG_DECIMAL_FOR_FLOATS)
                .disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS)
                .setSerializationInclusion(JsonInclude.Include.ALWAYS);
        this.store = store;
    }

    @PostMapping(consumes = "application/json", produces = "application/json")
    String receive(HttpServletRequest request) throws IOException {
        if (request.getContentLengthLong() > MAX_BODY_BYTES) throw new EventFailure(413, "payload_too_large");
        byte[] body = request.getInputStream().readNBytes(MAX_BODY_BYTES + 1);
        if (body.length > MAX_BODY_BYTES) throw new EventFailure(413, "payload_too_large");
        JsonNode tree;
        try {
            tree = json.readTree(body);
            if (tree == null || tree.isMissingNode()) throw new EventFailure(400, "invalid_json");
        } catch (JsonProcessingException | IllegalArgumentException | ArithmeticException failure) {
            throw new EventFailure(400, "invalid_json");
        }
        VisionEvent event = VisionEvent.parse(tree);
        var receipt = json.createObjectNode().put("event_id", event.eventId().toString())
                .put("status", "RECORDED").put("received_at", Instant.now().toString());
        return store.record(event.eventId(), json.writeValueAsString(event), json.writeValueAsString(receipt));
    }

    @GetMapping(value = "/{eventId}", produces = "application/json")
    JsonNode find(@PathVariable String eventId) throws JsonProcessingException {
        var stored = store.find(VisionEvent.uuid(eventId));
        var result = json.createObjectNode();
        result.set("event", json.readTree(stored.payload()));
        result.set("receipt", json.readTree(stored.receipt()));
        return result;
    }
}
