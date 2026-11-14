package br.com.articuno.core;

class EventFailure extends RuntimeException {
    final int status;
    final String code;
    final String field;
    EventFailure(int status, String code) { this(status, code, null); }
    EventFailure(int status, String code, String field) {
        super(code);
        this.status = status;
        this.code = code;
        this.field = field;
    }
    static EventFailure invalid(String field) { return new EventFailure(422, "invalid_event", field); }
}
