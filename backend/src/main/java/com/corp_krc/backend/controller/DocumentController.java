package com.corp_krc.backend.controller;

import com.corp_krc.backend.dto.request.DocumentUploadRequest;
import com.corp_krc.backend.dto.response.DocumentResponse;
import com.corp_krc.backend.dto.response.PagedResponse;
import com.corp_krc.backend.entity.DocumentType;
import com.corp_krc.backend.service.DocumentService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@RestController
@RequestMapping("/documents")
@RequiredArgsConstructor
public class DocumentController {

    private final DocumentService documentService;

    @PostMapping
    public ResponseEntity<DocumentResponse> uploadDocument(
            @Valid @RequestBody DocumentUploadRequest request,
            Authentication authentication) {
        DocumentResponse response = documentService.uploadDocument(request, authentication.getName());
        return ResponseEntity.status(HttpStatus.ACCEPTED).body(response);
    }

    @GetMapping
    public ResponseEntity<PagedResponse<DocumentResponse>> getAllDocuments(
            @RequestParam(required = false) DocumentType type,
            @PageableDefault(size = 20) Pageable pageable) {
        if (type != null) {
            return ResponseEntity.ok(documentService.getDocumentsByType(type, pageable));
        }
        return ResponseEntity.ok(documentService.getAllDocuments(pageable));
    }

    @GetMapping("/{id}")
    public ResponseEntity<DocumentResponse> getDocumentById(@PathVariable UUID id) {
        return ResponseEntity.ok(documentService.getDocumentById(id));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteDocument(@PathVariable UUID id) {
        documentService.deleteDocument(id);
        return ResponseEntity.noContent().build();
    }
}
