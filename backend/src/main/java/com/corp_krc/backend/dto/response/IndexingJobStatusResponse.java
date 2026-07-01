package com.corp_krc.backend.dto.response;

import com.corp_krc.backend.entity.IndexingStatus;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class IndexingJobStatusResponse {

    private UUID id;
    private UUID documentId;
    private String documentTitle;
    private IndexingStatus status;
    private Integer retryCount;
    private String errorMessage;
    private Instant startedAt;
    private Instant completedAt;
    private Instant createdAt;
}
