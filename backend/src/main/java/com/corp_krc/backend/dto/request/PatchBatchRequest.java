package com.corp_krc.backend.dto.request;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;

import java.util.List;

public record PatchBatchRequest(
        @NotEmpty List<@Valid PatchBatchUpsertRequest> batches) {
}
