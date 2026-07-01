package com.corp_krc.backend.mapper;

import com.corp_krc.backend.dto.response.DocumentResponse;
import com.corp_krc.backend.entity.Document;
import com.corp_krc.backend.entity.IndexingJob;
import org.springframework.stereotype.Component;

@Component
public class DocumentMapper {

    public DocumentResponse toResponse(Document document, IndexingJob indexingJob) {
        return DocumentResponse.builder()
                .id(document.getId())
                .title(document.getTitle())
                .documentType(document.getDocumentType())
                .sourceSystem(document.getSourceSystem())
                .uploadedBy(document.getUploadedBy().getId())
                .uploadedByName(document.getUploadedBy().getFullName())
                .projectId(document.getProject() != null ? document.getProject().getId() : null)
                .projectName(document.getProject() != null ? document.getProject().getName() : null)
                .metadata(document.getMetadata())
                .cogneeDatasetId(document.getCogneeDatasetId())
                .fileSizeBytes(document.getFileSizeBytes())
                .indexingStatus(indexingJob != null ? indexingJob.getStatus().name() : null)
                .createdAt(document.getCreatedAt())
                .build();
    }

    public DocumentResponse toResponse(Document document) {
        return toResponse(document, null);
    }
}
