package com.corp_krc.backend.controller;

import com.corp_krc.backend.dto.request.PatchBatchRequest;
import com.corp_krc.backend.dto.response.PatchBatchResponse;
import com.corp_krc.backend.service.PatchBatchService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/patches")
@RequiredArgsConstructor
public class PatchBatchController {

    private final PatchBatchService patchBatchService;

    @GetMapping
    public ResponseEntity<List<PatchBatchResponse>> getPatchBatches(
            @RequestParam(required = false) Long since) {
        return ResponseEntity.ok(patchBatchService.getPatchBatches(since));
    }

    @PostMapping("/batches")
    public ResponseEntity<List<PatchBatchResponse>> savePatchBatches(
            @Valid @RequestBody PatchBatchRequest request,
            Authentication authentication) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(patchBatchService.savePatchBatches(request, authentication.getName()));
    }
}
