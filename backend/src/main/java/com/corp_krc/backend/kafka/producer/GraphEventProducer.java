package com.corp_krc.backend.kafka.producer;

import com.corp_krc.backend.config.KafkaConfig;
import com.corp_krc.backend.kafka.event.GraphUpdatedEvent;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Component;

@Slf4j
@Component
@RequiredArgsConstructor
public class GraphEventProducer {

    private final KafkaTemplate<String, Object> kafkaTemplate;

    public void publishGraphUpdated(GraphUpdatedEvent event) {
        log.info("Publishing graph.updated event for document: {}", event.getDocumentId());
        kafkaTemplate.send(KafkaConfig.TOPIC_GRAPH_UPDATED,
                event.getDocumentId().toString(), event);
    }
}
