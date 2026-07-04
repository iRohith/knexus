package com.corp_krc.backend.kafka.consumer;

import com.corp_krc.backend.config.KafkaConfig;
import com.corp_krc.backend.kafka.event.DocumentUploadedEvent;
import com.corp_krc.backend.service.IndexingService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;

@Slf4j
@Component
@RequiredArgsConstructor
public class DocumentIndexingConsumer {

    private final IndexingService indexingService;

    @KafkaListener(topics = KafkaConfig.TOPIC_DOCUMENT_UPLOADED, groupId = "knowledge-nexus-indexing-group-v5", properties = {
            "auto.offset.reset=latest" })
    public void handleDocumentUploaded(DocumentUploadedEvent event) {
        log.info("Consumed document.uploaded event: documentId={}, correlationId={}",
                event.getDocumentId(), event.getCorrelationId());

        indexingService.processIndexing(event.getDocumentId(), event.getCorrelationId());
    }
}
