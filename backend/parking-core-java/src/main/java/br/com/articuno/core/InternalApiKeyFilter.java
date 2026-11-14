package br.com.articuno.core;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Collections;
import org.springframework.core.env.ConfigurableEnvironment;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

@Component
class InternalApiKeyFilter extends OncePerRequestFilter {
    private final byte[] expected;

    InternalApiKeyFilter(ConfigurableEnvironment environment) {
        Object raw = null;
        try {
            // Secrets are literal bytes; Environment.getProperty would expand ${...}.
            for (var propertySource : environment.getPropertySources()) {
                raw = propertySource.getProperty("INTERNAL_API_KEY");
                if (raw != null) break;
            }
        }
        catch (IllegalArgumentException failure) {
            throw new IllegalArgumentException("Invalid INTERNAL_API_KEY configuration.");
        }
        if (raw != null && !(raw instanceof String)) {
            throw new IllegalArgumentException("Invalid INTERNAL_API_KEY configuration.");
        }
        String key = (String) raw;
        if (key == null || key.isEmpty()) { expected = null; return; }
        if (!key.matches("[!-~]{32,256}")) {
            throw new IllegalArgumentException("Invalid INTERNAL_API_KEY: use 32..256 printable ASCII characters without spaces.");
        }
        expected = key.getBytes(StandardCharsets.US_ASCII);
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        return !request.getServletPath().startsWith("/api/v1/internal/");
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        if (expected == null) {
            reject(response, 503, "receiver_not_configured");
            return;
        }
        var headers = Collections.list(request.getHeaders("X-Internal-API-Key"));
        if (headers.size() != 1 || headers.getFirst().length() > 256
                || !MessageDigest.isEqual(expected, headers.getFirst().getBytes(StandardCharsets.UTF_8))) {
            response.setHeader("WWW-Authenticate", "ApiKey");
            reject(response, 401, "unauthorized");
            return;
        }
        chain.doFilter(request, response);
    }

    private void reject(HttpServletResponse response, int status, String code) throws IOException {
        response.setStatus(status);
        response.setContentType("application/json");
        response.setCharacterEncoding("UTF-8");
        response.getWriter().write("{\"error\":\"" + code + "\"}");
    }
}
