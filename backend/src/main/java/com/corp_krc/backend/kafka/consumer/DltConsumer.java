package com.corp_krc.backend.kafka.consumer;

import com.corp_krc.backend.config.KafkaConfig;
import lombok.extern.slf4j.Slf4j;
import org.apache.kafka.clients.consumer.ConsumerRecord;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;

@Slf4j
@Component
public class DltConsumer {

    @KafkaListener(
            topics = KafkaConfig.TOPIC_DOCUMENT_UPLOADED_DLT,
            groupId = "knowledge-nexus-dlt-group"
    )
    public void handleDltMessage(ConsumerRecord<String, Object> record) {
        log.error("DLT message received - topic: {}, key: {}, value: {}",
                record.topic(), record.key(), record.value());
        // In production: persist to a failed_events table or alert via Slack/PagerDuty
    }
}
