package br.com.articuno.core;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import java.time.Instant;
import java.util.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Service;

@Service
class ParkingService {
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    record Session(String sessionId, String plate, String sectorId, String status,
                   String enteredAt, String lastDetectedAt, boolean locationEstimated) {}
    private static final RowMapper<Session> SESSION = (row, index) -> new Session(row.getString("session_id"),
            row.getString("plate"), row.getString("sector_id"), row.getString("status"),
            row.getString("entered_at"), row.getString("last_detected_at"), true);
    private final JdbcTemplate database;
    private final ParkingLayout layout;

    ParkingService(JdbcTemplate database, ParkingLayout layout) { this.database = database; this.layout = layout; }

    // Called only inside the event transaction. Validate all business rules before its single write.
    Session apply(VisionEvent event) {
        var camera = layout.cameras().get(event.cameraId());
        if (camera == null || camera.eventType() != event.eventType()
                || !Objects.equals(camera.originSector(), event.originSector())
                || !Objects.equals(camera.destinationSector(), event.destinationSector())) {
            throw new EventFailure(422, "invalid_camera_transition");
        }
        if (event.eventType() == VisionEvent.EventType.ENTRY) {
            if (event.sessionId() != null) throw new EventFailure(422, "entry_session_not_allowed");
            if (event.plate() != null && database.queryForObject(
                    "SELECT COUNT(*) FROM parking_sessions WHERE plate=? AND status='ACTIVE'", Integer.class, event.plate()) > 0) {
                throw new EventFailure(409, "active_session_exists");
            }
            requireCapacity(camera.sectorId());
            String id = UUID.randomUUID().toString();
            String time = event.detectedAt().toString();
            database.update("INSERT INTO parking_sessions (session_id,plate,sector_id,status,entered_at,last_detected_at,entry_event_id,last_event_id) "
                            + "VALUES (?,?,?,'ACTIVE',?,?,?,?)", id, event.plate(), camera.sectorId(), time, time,
                    event.eventId().toString(), event.eventId().toString());
            return new Session(id, event.plate(), camera.sectorId(), "ACTIVE", time, time, true);
        }

        Session session;
        if (event.sessionId() != null) {
            session = session(event.sessionId());
            if (event.plate() != null && !event.plate().equals(session.plate())) throw new EventFailure(409, "session_identity_conflict");
        } else {
            var rows = database.query("SELECT * FROM parking_sessions WHERE plate=? AND status='ACTIVE'", SESSION, event.plate());
            if (rows.isEmpty()) throw new EventFailure(404, "session_not_found");
            session = rows.getFirst();
        }
        if (!session.status().equals("ACTIVE")) throw new EventFailure(409, "session_not_active");
        if (event.detectedAt().isBefore(Instant.parse(session.lastDetectedAt()))) throw new EventFailure(409, "stale_event");
        if (event.eventType() == VisionEvent.EventType.EXIT) {
            if (!session.sectorId().equals(camera.sectorId())) throw new EventFailure(409, "invalid_session_transition");
            // No authorization issuer exists yet. JV-06 must supply and consume a real authorization.
            throw new EventFailure(403, "exit_authorization_required");
        }
        if (!session.sectorId().equals(event.originSector())) throw new EventFailure(409, "invalid_session_transition");
        requireCapacity(event.destinationSector());
        database.update("UPDATE parking_sessions SET sector_id=?,last_detected_at=?,last_event_id=? WHERE session_id=?",
                event.destinationSector(), event.detectedAt().toString(), event.eventId().toString(), session.sessionId());
        return new Session(session.sessionId(), session.plate(), event.destinationSector(), session.status(),
                session.enteredAt(), event.detectedAt().toString(), true);
    }

    private void requireCapacity(String sector) {
        int free = database.queryForObject("SELECT capacity-(SELECT COUNT(*) FROM parking_sessions "
                + "WHERE sector_id=? AND status='ACTIVE') FROM parking_sectors WHERE sector_id=?", Integer.class, sector, sector);
        if (free <= 0) throw new EventFailure(409, "sector_full");
    }

    Session session(String id) {
        var rows = database.query("SELECT * FROM parking_sessions WHERE session_id=?", SESSION, id);
        if (rows.isEmpty()) throw new EventFailure(404, "session_not_found");
        return rows.getFirst();
    }

    Map<String, Object> sessions(int limit, int offset) {
        if (limit < 1 || limit > 100 || offset < 0) throw EventFailure.invalid("pagination");
        var items = database.query("SELECT * FROM parking_sessions ORDER BY rowid DESC LIMIT ? OFFSET ?", SESSION, limit, offset);
        return Map.of("items", items, "limit", limit, "offset", offset);
    }

    Map<String, Object> sectors() {
        var items = database.query("SELECT s.sector_id,s.capacity,COUNT(p.session_id) occupied "
                + "FROM parking_sectors s LEFT JOIN parking_sessions p ON p.sector_id=s.sector_id AND p.status='ACTIVE' "
                + "GROUP BY s.sector_id,s.capacity ORDER BY s.sector_id", (row, index) -> Map.of(
                    "sector_id", row.getString("sector_id"), "capacity", row.getInt("capacity"),
                    "occupied_estimated", row.getInt("occupied"), "free_estimated", row.getInt("capacity") - row.getInt("occupied")));
        return Map.of("estimated", true, "items", items);
    }

    Map<String, Object> dashboard() {
        return database.queryForObject("SELECT (SELECT COALESCE(SUM(capacity),0) FROM parking_sectors) capacity, "
                + "(SELECT COUNT(*) FROM parking_sessions WHERE status='ACTIVE') occupied", (row, index) -> Map.of(
                    "estimated", true, "total_capacity", row.getInt("capacity"), "occupied_estimated", row.getInt("occupied"),
                    "free_estimated", row.getInt("capacity") - row.getInt("occupied"), "active_sessions", row.getInt("occupied"),
                    "exit_policy", "BLOCKED_PENDING_JV06"));
    }
}
