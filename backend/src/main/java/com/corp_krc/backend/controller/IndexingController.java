package com.corp_krc.backend.controller;

import com.corp_krc.backend.dto.response.IndexingJobStatusResponse;
import com.corp_krc.backend.entity.IndexingJob;
import com.corp_krc.backend.entity.IndexingStatus;
import com.corp_krc.backend.exception.ResourceNotFoundException;
import com.corp_krc.backend.repository.IndexingJobRepository;
import com.corp_krc.backend.service.IndexingService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/indexing")
@RequiredArgsConstructor
public class IndexingController {

    private final IndexingJobRepository indexingJobRepository;
    private final IndexingService indexingService;

    @GetMapping("/jobs")
    public ResponseEntity<?> getIndexingJobs(
            @RequestParam(required = false) IndexingStatus status,
            @PageableDefault(size = 20) Pageable pageable) {
        Page<IndexingJob> page;
        if (status != null) {
            page = indexingJobRepository.findByStatus(status, pageable);
        } else {
            page = indexingJobRepository.findAll(pageable);
        }

        var responses = page.getContent().stream()
                .map(this::toStatusResponse)
                .toList();

        return ResponseEntity.ok(Map.of(
                "data", responses,
                "page", page.getNumber(),
                "size", page.getSize(),
                "totalElements", page.getTotalElements(),
                "totalPages", page.getTotalPages()
        ));
    }

    @GetMapping("/jobs/{id}")
    public ResponseEntity<IndexingJobStatusResponse> getJobById(@PathVariable UUID id) {
        IndexingJob job = indexingJobRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("IndexingJob", "id", id));
        return ResponseEntity.ok(toStatusResponse(job));
    }

    @PostMapping("/jobs/{id}/retry")
    public ResponseEntity<Void> retryJob(@PathVariable UUID id) {
        indexingService.retryFailedJob(id);
        return ResponseEntity.accepted().build();
    }

    @GetMapping("/stats")
    public ResponseEntity<Map<String, Long>> getStats() {
        Map<String, Long> stats = Map.of(
                "pending", indexingJobRepository.countByStatus(IndexingStatus.PENDING),
                "inProgress", indexingJobRepository.countByStatus(IndexingStatus.IN_PROGRESS),
                "completed", indexingJobRepository.countByStatus(IndexingStatus.COMPLETED),
                "failed", indexingJobRepository.countByStatus(IndexingStatus.FAILED)
        );
        return ResponseEntity.ok(stats);
    }

    private IndexingJobStatusResponse toStatusResponse(IndexingJob job) {
        return IndexingJobStatusResponse.builder()
                .id(job.getId())
                .documentId(job.getDocument().getId())
                .documentTitle(job.getDocument().getTitle())
                .status(job.getStatus())
                .retryCount(job.getRetryCount())
                .errorMessage(job.getErrorMessage())
                .startedAt(job.getStartedAt())
                .completedAt(job.getCompletedAt())
                .createdAt(job.getCreatedAt())
                .build();
    }
}
