package com.corp_krc.backend.service;

import com.corp_krc.backend.entity.Document;
import com.corp_krc.backend.entity.DocumentType;
import com.corp_krc.backend.entity.Employee;
import com.corp_krc.backend.entity.IndexingJob;
import com.corp_krc.backend.entity.IndexingStatus;
import com.corp_krc.backend.entity.IngestedDocument;
import com.corp_krc.backend.exception.ResourceNotFoundException;
import com.corp_krc.backend.kafka.event.DocumentUploadedEvent;
import com.corp_krc.backend.kafka.event.GraphUpdatedEvent;
import com.corp_krc.backend.kafka.event.IndexingCompletedEvent;
import com.corp_krc.backend.kafka.event.IndexingFailedEvent;
import com.corp_krc.backend.kafka.event.IndexingStartedEvent;
import com.corp_krc.backend.kafka.producer.DocumentEventProducer;
import com.corp_krc.backend.kafka.producer.GraphEventProducer;
import com.corp_krc.backend.repository.DocumentRepository;
import com.corp_krc.backend.repository.EmployeeRepository;
import com.corp_krc.backend.repository.IndexingJobRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.nio.charset.StandardCharsets;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class IndexingService {

    private final IndexingJobRepository indexingJobRepository;
    private final DocumentRepository documentRepository;
    private final CogneeService cogneeService;
    private final DocumentEventProducer documentEventProducer;
    private final GraphEventProducer graphEventProducer;
    private final EmployeeRepository employeeRepository;
    private final jakarta.persistence.EntityManager entityManager;

    private static final int MAX_RETRIES = 3;

    public void processIndexing(UUID documentId, UUID correlationId) {
        log.info("Processing indexing for document: {}, correlationId: {}", documentId, correlationId);

        IndexingJob job = indexingJobRepository.findByDocumentId(documentId)
                .orElseThrow(() -> new ResourceNotFoundException("IndexingJob", "documentId", documentId));

        Document document = documentRepository.findById(documentId)
                .orElseThrow(() -> new ResourceNotFoundException("Document", "id", documentId));

        // Mark as in-progress
        markInProgress(job);

        // Publish started event
        documentEventProducer.publishIndexingStarted(IndexingStartedEvent.builder()
                .eventId(UUID.randomUUID())
                .eventType("INDEXING_STARTED")
                .correlationId(correlationId)
                .documentId(documentId)
                .jobId(job.getId())
                .build());

        try {
            // Call Cognee
            cogneeService.indexDocument(document);

            // Mark completed
            markCompleted(job);

            // Publish completed event
            documentEventProducer.publishIndexingCompleted(IndexingCompletedEvent.builder()
                    .eventId(UUID.randomUUID())
                    .eventType("INDEXING_COMPLETED")
                    .correlationId(correlationId)
                    .documentId(documentId)
                    .jobId(job.getId())
                    .build());

            // Publish graph updated event
            graphEventProducer.publishGraphUpdated(GraphUpdatedEvent.builder()
                    .eventId(UUID.randomUUID())
                    .eventType("GRAPH_UPDATED")
                    .correlationId(correlationId)
                    .documentId(documentId)
                    .build());

            log.info("Indexing completed for document: {}", documentId);

        } catch (Exception e) {
            log.error("Indexing failed for document: {}, attempt: {}", documentId, job.getRetryCount() + 1, e);
            markFailed(job, e.getMessage());

            // Publish failed event
            documentEventProducer.publishIndexingFailed(IndexingFailedEvent.builder()
                    .eventId(UUID.randomUUID())
                    .eventType("INDEXING_FAILED")
                    .correlationId(correlationId)
                    .documentId(documentId)
                    .jobId(job.getId())
                    .errorMessage(e.getMessage())
                    .retryCount(job.getRetryCount())
                    .build());
        }
    }

    @Transactional
    public void retryFailedJob(UUID jobId) {
        IndexingJob job = indexingJobRepository.findById(jobId)
                .orElseThrow(() -> new ResourceNotFoundException("IndexingJob", "id", jobId));

        if (job.getStatus() != IndexingStatus.FAILED) {
            throw new IllegalStateException("Can only retry FAILED jobs");
        }

        if (job.getRetryCount() >= MAX_RETRIES) {
            throw new IllegalStateException("Maximum retry attempts reached");
        }

        job.setStatus(IndexingStatus.PENDING);
        indexingJobRepository.save(job);

        UUID correlationId = UUID.randomUUID();
        processIndexing(job.getDocument().getId(), correlationId);
    }

    @Transactional
    protected void markInProgress(IndexingJob job) {
        job.setStatus(IndexingStatus.IN_PROGRESS);
        job.setStartedAt(Instant.now());
        indexingJobRepository.save(job);
    }

    @Transactional
    protected void markCompleted(IndexingJob job) {
        job.setStatus(IndexingStatus.COMPLETED);
        job.setCompletedAt(Instant.now());
        indexingJobRepository.save(job);
    }

    @Transactional
    protected void markFailed(IndexingJob job, String errorMessage) {
        job.setStatus(IndexingStatus.FAILED);
        job.setRetryCount(job.getRetryCount() + 1);
        job.setErrorMessage(errorMessage);
        job.setCompletedAt(Instant.now());
        indexingJobRepository.save(job);
    }

    @Transactional
    public IndexingJob migrateIngestedToPipeline(IngestedDocument rawDoc) {
        log.info("Converting raw ingested document link to core pipeline: {}", rawDoc.getId());

        // 1. Generate clean deterministic UUID matching baseline architecture
        UUID documentUuid = UUID.nameUUIDFromBytes(rawDoc.getId().getBytes(StandardCharsets.UTF_8));

        // 2. Build and save core Document entity via standard instantiation
        if (!documentRepository.existsById(documentUuid)) {

            // Dynamic Enum Lookup
            DocumentType mappedType = switch (rawDoc.getSourceApp().toLowerCase()) {
                case "slack" -> DocumentType.SLACK_MESSAGE;
                case "jira" -> DocumentType.JIRA_TICKET;
                case "gmail" -> DocumentType.EMAIL;
                case "github" -> DocumentType.PR_REVIEW;
                case "fireflies" -> DocumentType.MEETING_NOTES;
                default -> DocumentType.ARCHITECTURE_DOC;
            };

            // Lookup Employee to satisfy constraints
            Employee admin = employeeRepository.findByEmail("ava.chen@redwoodinference.com")
                    .orElseThrow(() -> new ResourceNotFoundException(
                            "Employee", "email", "ava.chen@redwoodinference.com"));

            // Force a direct SQL native insert to bypass Hibernate's state checks
            // completely!
            entityManager
                    .createNativeQuery(
                            """
                                    INSERT INTO documents (id, title, raw_content, source_system, document_type, uploaded_by, cognee_dataset_id, file_path, created_at, updated_at)
                                    VALUES (:id, :title, :content, :source, :type, :user, :datasetId, :filePath, :created, :updated)
                                    """)
                    .setParameter("id", documentUuid)
                    .setParameter("title", rawDoc.getTitle())
                    .setParameter("content", rawDoc.getBody())
                    .setParameter("source", rawDoc.getSourceApp())
                    .setParameter("type", mappedType.name()) // Save enum as string representation
                    .setParameter("user", admin.getId()) // Link via foreign key ID
                    .setParameter("datasetId",
                            rawDoc.getBatchId() == null || rawDoc.getBatchId().isBlank()
                                    ? "corpKRC-bulk-ingestion"
                                    : rawDoc.getBatchId())
                    .setParameter("filePath", rawDoc.getSourceUrl())
                    .setParameter("created", Instant.now())
                    .setParameter("updated", Instant.now())
                    .executeUpdate();

            // Ensure the entity manager clears the context cache for the batch loop
            entityManager.flush();
        }

        // 3. Initialize and save IndexingJob using clean, standard setters
        if (!indexingJobRepository.existsByDocumentId(documentUuid)) {
            UUID jobId = UUID.randomUUID();

            // Force a direct SQL native insert for the indexing job to bypass Hibernate's
            // state engine!
            entityManager.createNativeQuery("""
                    INSERT INTO indexing_jobs (id, document_id, status, retry_count, created_at, updated_at)
                    VALUES (:id, :documentId, :status, :retryCount, :created, :updated)
                    """)
                    .setParameter("id", jobId)
                    .setParameter("documentId", documentUuid)
                    .setParameter("status", "PENDING") // Enum string representation
                    .setParameter("retryCount", 0)
                    .setParameter("created", Instant.now())
                    .setParameter("updated", Instant.now())
                    .executeUpdate();

            entityManager.flush();

            // 4. Trigger your Kafka event loop
            UUID correlationId = UUID.randomUUID();
            DocumentUploadedEvent uploadEvent = DocumentUploadedEvent.builder()
                    .eventId(UUID.randomUUID())
                    .eventType("DOCUMENT_UPLOADED")
                    .correlationId(correlationId)
                    .documentId(documentUuid)
                    .build();

            documentEventProducer.publishDocumentUploaded(uploadEvent);

            log.info("Document successfully translated and published to Kafka cluster with UUID: {}", documentUuid);
        }

        return indexingJobRepository.findByDocumentId(documentUuid)
                .orElseThrow(() -> new ResourceNotFoundException("IndexingJob", "documentId", documentUuid));
    }
}
