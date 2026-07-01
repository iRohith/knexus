package com.corp_krc.backend.controller;

import com.corp_krc.backend.dto.response.PagedResponse;
import com.corp_krc.backend.dto.response.QueryHistoryResponse;
import com.corp_krc.backend.service.QueryService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@RestController
@RequestMapping("/queries")
@RequiredArgsConstructor
public class QueryController {

    private final QueryService queryService;

    @GetMapping("/history")
    public ResponseEntity<PagedResponse<QueryHistoryResponse>> getQueryHistory(
            Authentication authentication,
            @PageableDefault(size = 20) Pageable pageable) {
        return ResponseEntity.ok(queryService.getQueryHistory(authentication.getName(), pageable));
    }

    @GetMapping("/history/{id}")
    public ResponseEntity<QueryHistoryResponse> getQueryById(@PathVariable UUID id) {
        return ResponseEntity.ok(queryService.getQueryById(id));
    }
}
