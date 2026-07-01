package com.corp_krc.backend.kafka.event;

import com.corp_krc.backend.entity.DocumentType;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.NoArgsConstructor;
import lombok.experimental.SuperBuilder;

import java.util.UUID;

@Data
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
@EqualsAndHashCode(callSuper = true)
public class DocumentUploadedEvent extends BaseEvent {

    private UUID documentId;
    private DocumentType documentType;
    private String title;
    private UUID uploadedBy;
    private UUID projectId;
    private int retryCount;
}
