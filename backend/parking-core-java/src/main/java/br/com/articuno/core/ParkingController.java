package br.com.articuno.core;

import java.util.Map;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/internal")
class ParkingController {
    private final ParkingService parking;
    ParkingController(ParkingService parking) { this.parking = parking; }
    @GetMapping("/sessions")
    Map<String, Object> sessions(@RequestParam(defaultValue = "50") int limit, @RequestParam(defaultValue = "0") int offset) {
        return parking.sessions(limit, offset);
    }
    @GetMapping("/sessions/{sessionId}")
    ParkingService.Session session(@PathVariable String sessionId) { return parking.session(sessionId); }
    @GetMapping("/sectors")
    Map<String, Object> sectors() { return parking.sectors(); }
    @GetMapping("/dashboard")
    Map<String, Object> dashboard() { return parking.dashboard(); }
}
