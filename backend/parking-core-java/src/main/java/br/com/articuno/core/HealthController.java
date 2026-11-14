package br.com.articuno.core;

import java.util.Map;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
class HealthController {
    private final JdbcTemplate database;

    HealthController(JdbcTemplate database) {
        this.database = database;
    }

    @GetMapping("/health")
    Map<String, String> health() {
        database.queryForObject("SELECT value FROM app_metadata WHERE key='schema_version'", String.class);
        return Map.of("status", "ok");
    }
}
