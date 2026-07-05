package com.corp_krc.backend.repository;

import com.corp_krc.backend.entity.IndexingJob;
import com.corp_krc.backend.entity.IndexingStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface IndexingJobRepository extends JpaRepository<IndexingJob, UUID> {

    @EntityGraph(attributePaths = "document")
    Optional<IndexingJob> findByDocumentId(UUID documentId);

    boolean existsByDocumentId(UUID documentId);

    @EntityGraph(attributePaths = "document")
    Page<IndexingJob> findByStatus(IndexingStatus status, Pageable pageable);

    @Override
    @EntityGraph(attributePaths = "document")
    Page<IndexingJob> findAll(Pageable pageable);

    @Override
    @EntityGraph(attributePaths = "document")
    Optional<IndexingJob> findById(UUID id);

    long countByStatus(IndexingStatus status);

    @Query("SELECT j FROM IndexingJob j WHERE j.status = 'FAILED' AND j.retryCount < :maxRetries")
    Page<IndexingJob> findRetryableJobs(int maxRetries, Pageable pageable);
}
