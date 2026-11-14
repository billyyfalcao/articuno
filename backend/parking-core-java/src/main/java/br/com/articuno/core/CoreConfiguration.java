package br.com.articuno.core;

import java.io.IOException;
import java.nio.file.Files;
import java.sql.Connection;
import java.sql.SQLException;
import javax.sql.DataSource;

import org.springframework.boot.web.server.WebServerFactoryCustomizer;
import org.springframework.boot.web.servlet.server.ConfigurableServletWebServerFactory;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.env.Environment;
import org.sqlite.SQLiteConfig;
import org.sqlite.SQLiteDataSource;

@Configuration(proxyBeanMethods = false)
class CoreConfiguration {
    @Bean
    CoreSettings coreSettings(Environment environment) {
        return CoreSettings.from(environment);
    }

    @Bean
    WebServerFactoryCustomizer<ConfigurableServletWebServerFactory> serverSettings(CoreSettings settings) {
        return server -> {
            server.setPort(settings.port());
            server.setAddress(settings.bindAddress());
        };
    }

    @Bean
    ParkingLayout parkingLayout(Environment environment) { return ParkingLayout.load(environment); }

    @Bean
    DataSource dataSource(CoreSettings settings, ParkingLayout layout) {
        var config = new SQLiteConfig();
        config.enforceForeignKeys(true);
        config.setBusyTimeout(5000);
        config.setTransactionMode(SQLiteConfig.TransactionMode.IMMEDIATE);
        var source = new SQLiteDataSource(config);
        source.setUrl("jdbc:sqlite:" + settings.databasePath());
        try {
            Files.createDirectories(settings.databasePath().getParent());
            try (var connection = source.getConnection()) {
                migrate(connection, layout);
            }
            return source;
        } catch (IOException | SQLException failure) {
            // Do not attach the driver exception: it can contain paths or connection details.
            throw new IllegalStateException("Database initialization failed: check CORE_DB_PATH and file permissions.");
        }
    }

    private void migrate(Connection connection, ParkingLayout layout) throws SQLException {
        connection.setAutoCommit(false);
        try (var statement = connection.createStatement()) {
            statement.executeUpdate("CREATE TABLE IF NOT EXISTS app_metadata "
                    + "(key TEXT PRIMARY KEY, value TEXT NOT NULL)");
            statement.executeUpdate("INSERT OR IGNORE INTO app_metadata VALUES ('schema_version', '1')");
            String version;
            try (var result = statement.executeQuery("SELECT value FROM app_metadata WHERE key='schema_version'")) {
                if (!result.next()) throw new SQLException("Missing schema version");
                version = result.getString(1);
            }
            if ("1".equals(version)) {
                statement.executeUpdate("CREATE TABLE vision_events (event_id TEXT PRIMARY KEY NOT NULL, "
                        + "payload_json TEXT NOT NULL, receipt_json TEXT NOT NULL)");
                statement.executeUpdate("UPDATE app_metadata SET value='2' WHERE key='schema_version'");
                version = "2";
            }
            if ("2".equals(version)) {
                statement.executeUpdate("ALTER TABLE vision_events ADD COLUMN http_status INTEGER NOT NULL DEFAULT 200");
                statement.executeUpdate("CREATE TABLE parking_sectors (sector_id TEXT PRIMARY KEY NOT NULL, "
                        + "capacity INTEGER NOT NULL CHECK(capacity > 0))");
                statement.executeUpdate("CREATE TABLE parking_sessions (session_id TEXT PRIMARY KEY NOT NULL, plate TEXT, "
                        + "sector_id TEXT NOT NULL REFERENCES parking_sectors(sector_id), "
                        + "status TEXT NOT NULL CHECK(status IN ('ACTIVE','CLOSED')), entered_at TEXT NOT NULL, "
                        + "last_detected_at TEXT NOT NULL, entry_event_id TEXT NOT NULL UNIQUE REFERENCES vision_events(event_id), "
                        + "last_event_id TEXT NOT NULL REFERENCES vision_events(event_id))");
                statement.executeUpdate("CREATE UNIQUE INDEX active_plate ON parking_sessions(plate) WHERE status='ACTIVE' AND plate IS NOT NULL");
                statement.executeUpdate("CREATE INDEX active_sector ON parking_sessions(sector_id,status)");
                statement.executeUpdate("UPDATE app_metadata SET value='3' WHERE key='schema_version'");
            } else if (!"3".equals(version)) {
                throw new SQLException("Unsupported schema");
            }
            try (var columns = statement.executeQuery(
                    "SELECT event_id, payload_json, receipt_json, http_status FROM vision_events LIMIT 0")) {
                // Fail startup for an incompatible declared schema.
            }
            layout.install(connection);
            connection.commit();
        } catch (SQLException | RuntimeException failure) {
            connection.rollback();
            throw failure;
        }
    }
}
