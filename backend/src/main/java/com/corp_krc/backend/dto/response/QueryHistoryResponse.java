package com.corp_krc.backend.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class QueryHistoryResponse {

    private UUID id;
    private String question;
    private Map<String, Object> reasoningPath;
    private Integer responseTimeMs;
    private Instant createdAt;
}
