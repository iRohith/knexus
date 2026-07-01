package com.corp_krc.backend.service;

import com.corp_krc.backend.dto.request.DocumentUploadRequest;
import com.corp_krc.backend.dto.response.DocumentResponse;
import com.corp_krc.backend.dto.response.PagedResponse;
import com.corp_krc.backend.entity.Document;
import com.corp_krc.backend.entity.DocumentType;
import com.corp_krc.backend.entity.Employee;
import com.corp_krc.backend.entity.IndexingJob;
import com.corp_krc.backend.entity.IndexingStatus;
import com.corp_krc.backend.entity.Project;
import com.corp_krc.backend.exception.ResourceNotFoundException;
import com.corp_krc.backend.kafka.event.DocumentUploadedEvent;
import com.corp_krc.backend.kafka.producer.DocumentEventProducer;
import com.corp_krc.backend.mapper.DocumentMapper;
import com.corp_krc.backend.repository.DocumentRepository;
import com.corp_krc.backend.repository.EmployeeRepository;
import com.corp_krc.backend.repository.IndexingJobRepository;
import com.corp_krc.backend.repository.ProjectRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class DocumentService {

    private final DocumentRepository documentRepository;
    private final IndexingJobRepository indexingJobRepository;
    private final EmployeeRepository employeeRepository;
    private final ProjectRepository projectRepository;
    private final DocumentMapper documentMapper;
    private final DocumentEventProducer documentEventProducer;

    @Transactional
    public DocumentResponse uploadDocument(DocumentUploadRequest request, String uploaderEmail) {
        Employee uploader = employeeRepository.findByEmail(uploaderEmail)
                .orElseThrow(() -> new ResourceNotFoundException("Employee", "email", uploaderEmail));

        Project project = null;
        if (request.getProjectId() != null) {
            project = projectRepository.findById(request.getProjectId())
                    .orElseThrow(() -> new ResourceNotFoundException("Project", "id", request.getProjectId()));
        }

        Document document = Document.builder()
                .title(request.getTitle())
                .documentType(request.getDocumentType())
                .sourceSystem(request.getSourceSystem())
                .uploadedBy(uploader)
                .project(project)
                .rawContent(request.getRawContent())
                .metadata(request.getMetadata())
                .build();

        document = documentRepository.save(document);

        // Create IndexingJob in same transaction for atomicity
        IndexingJob indexingJob = IndexingJob.builder()
                .document(document)
                .status(IndexingStatus.PENDING)
                .retryCount(0)
                .build();

        indexingJob = indexingJobRepository.save(indexingJob);

        log.info("Document uploaded: {} (type: {}), IndexingJob created: {}",
                document.getTitle(), document.getDocumentType(), indexingJob.getId());

        // Publish Kafka event for async Cognee indexing
        UUID correlationId = UUID.randomUUID();
        DocumentUploadedEvent event = DocumentUploadedEvent.builder()
                .eventId(UUID.randomUUID())
                .eventType("DOCUMENT_UPLOADED")
                .correlationId(correlationId)
                .documentId(document.getId())
                .documentType(document.getDocumentType())
                .title(document.getTitle())
                .uploadedBy(uploader.getId())
                .projectId(document.getProject() != null ? document.getProject().getId() : null)
                .build();
        documentEventProducer.publishDocumentUploaded(event);
        return documentMapper.toResponse(document, indexingJob);
    }

    @Transactional(readOnly = true)
    public DocumentResponse getDocumentById(UUID id) {
        Document document = findDocumentOrThrow(id);
        IndexingJob indexingJob = indexingJobRepository.findByDocumentId(id).orElse(null);
        return documentMapper.toResponse(document, indexingJob);
    }

    @Transactional(readOnly = true)
    public PagedResponse<DocumentResponse> getAllDocuments(Pageable pageable) {
        Page<Document> page = documentRepository.findAll(pageable);
        return toPagedResponse(page);
    }

    @Transactional(readOnly = true)
    public PagedResponse<DocumentResponse> getDocumentsByType(DocumentType type, Pageable pageable) {
        Page<Document> page = documentRepository.findByDocumentType(type, pageable);
        return toPagedResponse(page);
    }

    @Transactional(readOnly = true)
    public PagedResponse<DocumentResponse> getDocumentsByProject(UUID projectId, Pageable pageable) {
        Page<Document> page = documentRepository.findByProjectId(projectId, pageable);
        return toPagedResponse(page);
    }

    @Transactional
    public void deleteDocument(UUID id) {
        Document document = findDocumentOrThrow(id);
        indexingJobRepository.findByDocumentId(id).ifPresent(indexingJobRepository::delete);
        documentRepository.delete(document);
        log.info("Deleted document: {}", document.getTitle());
    }

    private Document findDocumentOrThrow(UUID id) {
        return documentRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Document", "id", id));
    }

    private PagedResponse<DocumentResponse> toPagedResponse(Page<Document> page) {
        return PagedResponse.<DocumentResponse>builder()
                .data(page.getContent().stream().map(documentMapper::toResponse).toList())
                .page(page.getNumber())
                .size(page.getSize())
                .totalElements(page.getTotalElements())
                .totalPages(page.getTotalPages())
                .build();
    }
}
