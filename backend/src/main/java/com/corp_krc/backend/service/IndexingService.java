package com.corp_krc.backend.service;

import com.corp_krc.backend.entity.Document;
import com.corp_krc.backend.entity.IndexingJob;
import com.corp_krc.backend.entity.IndexingStatus;
import com.corp_krc.backend.exception.ResourceNotFoundException;
import com.corp_krc.backend.kafka.event.GraphUpdatedEvent;
import com.corp_krc.backend.kafka.event.IndexingCompletedEvent;
import com.corp_krc.backend.kafka.event.IndexingFailedEvent;
import com.corp_krc.backend.kafka.event.IndexingStartedEvent;
import com.corp_krc.backend.kafka.producer.DocumentEventProducer;
import com.corp_krc.backend.kafka.producer.GraphEventProducer;
import com.corp_krc.backend.repository.DocumentRepository;
import com.corp_krc.backend.repository.IndexingJobRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
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
}
