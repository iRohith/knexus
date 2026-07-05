package com.corp_krc.backend.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.*;
import java.time.Instant;

@Entity
@Table(name = "ingested_documents")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class IngestedDocument {

    @Id
    @Column(name = "id", nullable = false, updatable = false)
    private String id;

    @Column(name = "source_app")
    private String sourceApp;

    @Column(name = "actor_id")
    private String actorId;

    @Column(name = "occurred_at")
    private java.time.Instant occurredAt;

    @Column(name = "type")
    private String type;

    @Column(name = "action")
    private String action;

    @Column(name = "batch_id")
    private String batchId;

    @Column(name = "title", length = 1000)
    private String title;

    @Column(name = "body", columnDefinition = "TEXT")
    private String body;

    @Column(name = "source_entity_id")
    private String sourceEntityId;

    @Column(name = "source_entity_type")
    private String sourceEntityType;

    @Column(name = "source_url", length = 2000)
    private String sourceUrl;
}
