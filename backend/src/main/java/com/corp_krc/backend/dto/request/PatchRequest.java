package com.corp_krc.backend.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.util.Map;

public record PatchRequest(
        @NotBlank String id,
        @NotBlank String app,
        @NotBlank String scope,
        @NotBlank String op,
        @NotBlank String targetId,
        @NotBlank String actorId,
        @NotNull Long occurredAt,
        @NotNull Map<String, Object> payload) {
}
