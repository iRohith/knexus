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
public class KnowledgeQueryResponse {

    private UUID queryId;
    private String question;
    private String answer;
    private String queryKey;
    private String source;
    private String datasetName;
    private Map<String, Object> reasoningPath;
    private Map<String, Object> graphData;
    private Map<String, Object> raw;
    private Integer responseTimeMs;
    private Instant timestamp;
}
