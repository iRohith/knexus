package com.corp_krc.backend.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.util.List;
import java.util.Map;

@Entity
@Table(name = "patch_batches")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PatchBatch {

    @Id
    @Column(name = "id", nullable = false, updatable = false, length = 128)
    private String id;

    @Column(name = "client_created_at", nullable = false)
    private Long clientCreatedAt;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "patches", nullable = false, columnDefinition = "jsonb")
    private List<Map<String, Object>> patches;

    @Column(name = "created_by", nullable = false)
    private String createdBy;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;
}
