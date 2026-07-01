package com.corp_krc.backend.kafka.producer;

import com.corp_krc.backend.config.KafkaConfig;
import com.corp_krc.backend.kafka.event.DocumentUploadedEvent;
import com.corp_krc.backend.kafka.event.IndexingCompletedEvent;
import com.corp_krc.backend.kafka.event.IndexingFailedEvent;
import com.corp_krc.backend.kafka.event.IndexingStartedEvent;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Component;

@Slf4j
@Component
@RequiredArgsConstructor
public class DocumentEventProducer {

    private final KafkaTemplate<String, Object> kafkaTemplate;

    public void publishDocumentUploaded(DocumentUploadedEvent event) {
        log.info("Publishing document.uploaded event for document: {}", event.getDocumentId());
        kafkaTemplate.send(KafkaConfig.TOPIC_DOCUMENT_UPLOADED,
                event.getDocumentId().toString(), event);
    }

    public void publishIndexingStarted(IndexingStartedEvent event) {
        log.info("Publishing indexing.started event for document: {}", event.getDocumentId());
        kafkaTemplate.send(KafkaConfig.TOPIC_INDEXING_STARTED,
                event.getDocumentId().toString(), event);
    }

    public void publishIndexingCompleted(IndexingCompletedEvent event) {
        log.info("Publishing indexing.completed event for document: {}", event.getDocumentId());
        kafkaTemplate.send(KafkaConfig.TOPIC_INDEXING_COMPLETED,
                event.getDocumentId().toString(), event);
    }

    public void publishIndexingFailed(IndexingFailedEvent event) {
        log.warn("Publishing indexing.failed event for document: {}, retry: {}",
                event.getDocumentId(), event.getRetryCount());
        kafkaTemplate.send(KafkaConfig.TOPIC_INDEXING_FAILED,
                event.getDocumentId().toString(), event);
    }
}
