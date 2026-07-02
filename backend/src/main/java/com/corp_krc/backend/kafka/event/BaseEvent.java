package com.corp_krc.backend.kafka.event;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.SuperBuilder;

import java.time.Instant;
import java.util.UUID;

@Data
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
public class BaseEvent {

    private UUID eventId;
    private String eventType;
    private UUID correlationId;

    @Builder.Default
    private Instant timestamp = Instant.now();
}
