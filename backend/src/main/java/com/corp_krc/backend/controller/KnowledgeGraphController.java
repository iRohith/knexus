package com.corp_krc.backend.controller;

import com.corp_krc.backend.dto.request.KnowledgeQueryRequest;
import com.corp_krc.backend.dto.response.KnowledgeQueryResponse;
import com.corp_krc.backend.dto.response.PagedResponse;
import com.corp_krc.backend.dto.response.QueryHistoryResponse;
import com.corp_krc.backend.service.QueryService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@RestController
@RequestMapping("/knowledge")
@RequiredArgsConstructor
public class KnowledgeGraphController {

    private final QueryService queryService;

    @PostMapping("/query")
    public ResponseEntity<KnowledgeQueryResponse> query(
            @Valid @RequestBody KnowledgeQueryRequest request,
            Authentication authentication) {
        KnowledgeQueryResponse response = queryService.executeQuery(request, authentication.getName());
        return ResponseEntity.ok(response);
    }

    @GetMapping("/search")
    public ResponseEntity<KnowledgeQueryResponse> search(
            @org.springframework.web.bind.annotation.RequestParam String q,
            Authentication authentication) {
        KnowledgeQueryRequest request = new KnowledgeQueryRequest(q);
        KnowledgeQueryResponse response = queryService.executeQuery(request, authentication.getName());
        return ResponseEntity.ok(response);
    }
}
