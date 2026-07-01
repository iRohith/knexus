package com.corp_krc.backend.config;

import org.apache.kafka.clients.admin.NewTopic;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.kafka.config.TopicBuilder;

@Configuration
public class KafkaConfig {

    public static final String TOPIC_DOCUMENT_UPLOADED = "document.uploaded";
    public static final String TOPIC_INDEXING_STARTED = "document.indexing.started";
    public static final String TOPIC_INDEXING_COMPLETED = "document.indexing.completed";
    public static final String TOPIC_INDEXING_FAILED = "document.indexing.failed";
    public static final String TOPIC_GRAPH_UPDATED = "graph.updated";
    public static final String TOPIC_DOCUMENT_UPLOADED_DLT = "document.uploaded.dlt";

    @Bean
    public NewTopic documentUploadedTopic() {
        return TopicBuilder.name(TOPIC_DOCUMENT_UPLOADED).partitions(3).replicas(1).build();
    }

    @Bean
    public NewTopic indexingStartedTopic() {
        return TopicBuilder.name(TOPIC_INDEXING_STARTED).partitions(3).replicas(1).build();
    }

    @Bean
    public NewTopic indexingCompletedTopic() {
        return TopicBuilder.name(TOPIC_INDEXING_COMPLETED).partitions(3).replicas(1).build();
    }

    @Bean
    public NewTopic indexingFailedTopic() {
        return TopicBuilder.name(TOPIC_INDEXING_FAILED).partitions(3).replicas(1).build();
    }

    @Bean
    public NewTopic graphUpdatedTopic() {
        return TopicBuilder.name(TOPIC_GRAPH_UPDATED).partitions(3).replicas(1).build();
    }

    @Bean
    public NewTopic documentUploadedDltTopic() {
        return TopicBuilder.name(TOPIC_DOCUMENT_UPLOADED_DLT).partitions(1).replicas(1).build();
    }
}
