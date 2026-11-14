package br.com.articuno.core;

import java.util.Map;
import org.springframework.dao.DataAccessException;
import org.springframework.transaction.TransactionException;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice
class ApiExceptionHandler {
    @ExceptionHandler(EventFailure.class)
    ResponseEntity<Map<String, String>> eventFailure(EventFailure failure) {
        var body = new java.util.LinkedHashMap<String, String>();
        body.put("error", failure.code);
        if (failure.field != null) body.put("field", failure.field);
        return ResponseEntity.status(failure.status).body(body);
    }

    @ExceptionHandler({DataAccessException.class, TransactionException.class})
    ResponseEntity<Map<String, String>> unavailable() {
        return ResponseEntity.status(503).body(Map.of("error", "database_unavailable"));
    }
}
