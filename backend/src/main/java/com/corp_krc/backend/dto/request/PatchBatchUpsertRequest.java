package com.corp_krc.backend.dto.request;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;

import java.util.List;

public record PatchBatchUpsertRequest(
        @NotBlank String id,
        @NotNull Long createdAt,
        @NotEmpty List<@Valid PatchRequest> patches,
        String status) {
}
