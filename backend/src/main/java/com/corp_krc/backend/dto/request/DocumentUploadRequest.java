package com.corp_krc.backend.dto.request;

import com.corp_krc.backend.entity.DocumentType;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Map;
import java.util.UUID;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class DocumentUploadRequest {

    @NotBlank(message = "Title is required")
    private String title;

    @NotNull(message = "Document type is required")
    private DocumentType documentType;

    private String sourceSystem;

    private UUID projectId;

    @NotBlank(message = "Content is required")
    private String rawContent;

    private Map<String, Object> metadata;
}
