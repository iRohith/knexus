package com.corp_krc.backend.mapper;

import com.corp_krc.backend.dto.response.QueryHistoryResponse;
import com.corp_krc.backend.entity.QueryHistory;
import org.springframework.stereotype.Component;

@Component
public class QueryMapper {

    public QueryHistoryResponse toResponse(QueryHistory queryHistory) {
        return QueryHistoryResponse.builder()
                .id(queryHistory.getId())
                .question(queryHistory.getQuestion())
                .reasoningPath(queryHistory.getReasoningPath())
                .responseTimeMs(queryHistory.getResponseTimeMs())
                .createdAt(queryHistory.getCreatedAt())
                .build();
    }
}
