package br.com.articuno.core;

import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
class VisionEventStore {
    record StoredEvent(String payload, String receipt) {}
    private final JdbcTemplate database;
    VisionEventStore(JdbcTemplate database) { this.database = database; }

    String record(UUID id, String payload, String receipt) {
        // SQLite uniqueness, not an in-process lock, arbitrates concurrent producers.
        database.update("INSERT INTO vision_events (event_id, payload_json, receipt_json) VALUES (?, ?, ?) "
                + "ON CONFLICT(event_id) DO NOTHING", id.toString(), payload, receipt);
        StoredEvent existing = find(id);
        if (!existing.payload().equals(payload)) throw new EventFailure(409, "event_id_conflict");
        return existing.receipt();
    }

    StoredEvent find(UUID id) {
        var rows = database.query("SELECT payload_json, receipt_json FROM vision_events WHERE event_id=?",
                (row, index) -> new StoredEvent(row.getString(1), row.getString(2)), id.toString());
        if (rows.isEmpty()) throw new EventFailure(404, "event_not_found");
        return rows.getFirst();
    }
}
