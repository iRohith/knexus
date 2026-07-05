package com.corp_krc.backend.service;

import com.corp_krc.backend.dto.request.PatchBatchRequest;
import com.corp_krc.backend.dto.request.PatchBatchUpsertRequest;
import com.corp_krc.backend.dto.request.PatchRequest;
import com.corp_krc.backend.dto.response.PatchBatchResponse;
import com.corp_krc.backend.entity.PatchBatch;
import com.corp_krc.backend.repository.PatchBatchRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class PatchBatchService {

    private final PatchBatchRepository patchBatchRepository;

    @Transactional(readOnly = true)
    public List<PatchBatchResponse> getPatchBatches(Long since) {
        List<PatchBatch> batches = since == null
                ? patchBatchRepository.findAllByOrderByClientCreatedAtAsc()
                : patchBatchRepository.findByClientCreatedAtGreaterThanOrderByClientCreatedAtAsc(since);

        return batches.stream().map(this::toResponse).toList();
    }

    @Transactional
    public List<PatchBatchResponse> savePatchBatches(PatchBatchRequest request, String createdBy) {
        return request.batches().stream()
                .map(batch -> savePatchBatch(batch, createdBy))
                .map(this::toResponse)
                .toList();
    }

    private PatchBatch savePatchBatch(PatchBatchUpsertRequest request, String createdBy) {
        return patchBatchRepository.findById(request.id())
                .orElseGet(() -> patchBatchRepository.save(PatchBatch.builder()
                        .id(request.id())
                        .clientCreatedAt(request.createdAt())
                        .patches(request.patches().stream().map(this::patchToMap).toList())
                        .createdBy(createdBy)
                        .createdAt(Instant.now())
                        .build()));
    }

    private Map<String, Object> patchToMap(PatchRequest patch) {
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("id", patch.id());
        data.put("app", patch.app());
        data.put("scope", patch.scope());
        data.put("op", patch.op());
        data.put("targetId", patch.targetId());
        data.put("actorId", patch.actorId());
        data.put("occurredAt", patch.occurredAt());
        data.put("payload", patch.payload());
        return data;
    }

    private PatchBatchResponse toResponse(PatchBatch batch) {
        return new PatchBatchResponse(
                batch.getId(),
                batch.getClientCreatedAt(),
                batch.getPatches(),
                "flushed");
    }
}
