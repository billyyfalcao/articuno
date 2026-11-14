package br.com.articuno.core;

import java.net.InetAddress;
import java.net.UnknownHostException;
import java.nio.file.InvalidPathException;
import java.nio.file.Path;
import org.springframework.core.env.Environment;

record CoreSettings(int port, InetAddress bindAddress, Path databasePath) {
    static CoreSettings from(Environment environment) {
        int port;
        try {
            port = Integer.parseInt(property(environment, "CORE_PORT", "8080"));
            if (port < 0 || port > 65535) throw new NumberFormatException();
        } catch (NumberFormatException failure) {
            throw new IllegalArgumentException("Invalid CORE_PORT: expected integer 0..65535.");
        }

        String address = property(environment, "CORE_BIND_ADDRESS", "127.0.0.1");
        InetAddress bindAddress;
        try {
            // Numeric IPv4 only: configuration must not trigger DNS/network discovery.
            if (!address.matches("[0-9]{1,3}(\\.[0-9]{1,3}){3}")) throw new IllegalArgumentException();
            String[] octets = address.split("\\.");
            byte[] bytes = new byte[4];
            for (int i = 0; i < 4; i++) {
                int value = Integer.parseInt(octets[i]);
                if (value > 255) throw new IllegalArgumentException();
                bytes[i] = (byte) value;
            }
            bindAddress = InetAddress.getByAddress(bytes);
        } catch (IllegalArgumentException | UnknownHostException failure) {
            throw new IllegalArgumentException("Invalid CORE_BIND_ADDRESS: expected numeric IPv4.");
        }

        String filename = property(environment, "CORE_DB_PATH", "./data/articuno.db");
        if (filename.isBlank() || filename.equals(":memory:") || filename.startsWith("file:")
                || filename.contains("?") || filename.contains("#")
                || filename.chars().anyMatch(c -> c < 32 || c == 127)) {
            throw new IllegalArgumentException("Invalid CORE_DB_PATH: expected local file path.");
        }
        try {
            return new CoreSettings(port, bindAddress, Path.of(filename).toAbsolutePath().normalize());
        } catch (InvalidPathException failure) {
            throw new IllegalArgumentException("Invalid CORE_DB_PATH: expected local file path.");
        }
    }

    private static String property(Environment environment, String name, String fallback) {
        try {
            return environment.getProperty(name, fallback);
        } catch (IllegalArgumentException failure) {
            // Spring placeholder errors can include the raw value. Discard that cause too.
            throw new IllegalArgumentException("Invalid " + name + ": cannot resolve configuration.");
        }
    }
}
