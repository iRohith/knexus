package com.corp_krc.backend.dto.response;

import java.util.List;
import java.util.Map;

public record PatchBatchResponse(
        String id,
        Long createdAt,
        List<Map<String, Object>> patches,
        String status) {
}
