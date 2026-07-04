package com.corp_krc.backend.dto.ingestion;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.Data;

@Data
@JsonIgnoreProperties(ignoreUnknown = true)
public class JsonInboundPayload {
    private String id;
    private String sourceApp;
    private String actorId;
    private long occurredAt; // Unix timestamp in milliseconds
    private String type;
    private String action;
    private String title;
    private String body;
    private String sourceEntityId;
    private String sourceEntityType;
    private String sourceUrl;

}
