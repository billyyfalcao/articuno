package br.com.articuno.core;

import java.util.UUID;
import java.time.Instant;
import javax.sql.DataSource;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.support.TransactionTemplate;

@Repository
class VisionEventStore {
    record StoredEvent(String payload, String receipt, int httpStatus) {}
    private final JdbcTemplate database;
    private final ParkingService parking;
    private final TransactionTemplate transaction;
    private final ObjectMapper json;
    VisionEventStore(JdbcTemplate database, DataSource source, ParkingService parking, ObjectMapper json) {
        this.database = database; this.parking = parking; this.json = json;
        transaction = new TransactionTemplate(new DataSourceTransactionManager(source));
    }

    StoredEvent record(VisionEvent event, String payload) {
        // SQLite IMMEDIATE transaction serializes capacity checks across all writers.
        return transaction.execute(status -> {
            String id = event.eventId().toString();
            int inserted = database.update("INSERT INTO vision_events (event_id, payload_json, receipt_json) VALUES (?, ?, '{}') "
                    + "ON CONFLICT(event_id) DO NOTHING", id, payload);
            if (inserted == 0) {
                StoredEvent existing = find(event.eventId());
                if (!existing.payload().equals(payload)) throw new EventFailure(409, "event_id_conflict");
                return existing;
            }
            var receipt = json.createObjectNode().put("event_id", id).put("received_at", Instant.now().toString());
            int httpStatus = 200;
            try {
                var session = parking.apply(event);
                receipt.put("status", "APPLIED").put("session_id", session.sessionId())
                        .put("sector_id", session.sectorId()).put("session_status", session.status());
            } catch (EventFailure rejection) {
                // Business validation precedes writes. SQL failures escape and roll back everything.
                httpStatus = rejection.status;
                receipt.put("status", "REJECTED").put("error", rejection.code);
            }
            String body = receipt.toString();
            database.update("UPDATE vision_events SET receipt_json=?,http_status=? WHERE event_id=?", body, httpStatus, id);
            return new StoredEvent(payload, body, httpStatus);
        });
    }

    StoredEvent find(UUID id) {
        var rows = database.query("SELECT payload_json, receipt_json, http_status FROM vision_events WHERE event_id=?",
                (row, index) -> new StoredEvent(row.getString(1), row.getString(2), row.getInt(3)), id.toString());
        if (rows.isEmpty()) throw new EventFailure(404, "event_not_found");
        return rows.getFirst();
    }
}
