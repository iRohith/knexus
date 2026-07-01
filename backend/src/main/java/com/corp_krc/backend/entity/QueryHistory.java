package com.corp_krc.backend.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Index;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.util.Map;

@Entity
@Table(name = "query_history", indexes = {
        @Index(name = "idx_query_history_employee_id", columnList = "employee_id"),
        @Index(name = "idx_query_history_created_at", columnList = "created_at DESC")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class QueryHistory extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "employee_id", nullable = false)
    private Employee employee;

    @Column(name = "question", nullable = false, columnDefinition = "TEXT")
    private String question;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "cognee_response", columnDefinition = "jsonb")
    private Map<String, Object> cogneeResponse;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "reasoning_path", columnDefinition = "jsonb")
    private Map<String, Object> reasoningPath;

    @Column(name = "response_time_ms")
    private Integer responseTimeMs;
}
