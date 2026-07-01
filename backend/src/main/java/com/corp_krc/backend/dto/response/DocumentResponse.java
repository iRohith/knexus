package com.corp_krc.backend.dto.response;

import com.corp_krc.backend.entity.DocumentType;
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
public class DocumentResponse {

    private UUID id;
    private String title;
    private DocumentType documentType;
    private String sourceSystem;
    private UUID uploadedBy;
    private String uploadedByName;
    private UUID projectId;
    private String projectName;
    private Map<String, Object> metadata;
    private String cogneeDatasetId;
    private Long fileSizeBytes;
    private String indexingStatus;
    private Instant createdAt;
}
