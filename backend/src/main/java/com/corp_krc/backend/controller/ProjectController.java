package com.corp_krc.backend.controller;

import com.corp_krc.backend.dto.request.ProjectCreateRequest;
import com.corp_krc.backend.dto.response.DocumentResponse;
import com.corp_krc.backend.dto.response.PagedResponse;
import com.corp_krc.backend.dto.response.ProjectResponse;
import com.corp_krc.backend.service.DocumentService;
import com.corp_krc.backend.service.ProjectService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@RestController
@RequestMapping("/projects")
@RequiredArgsConstructor
public class ProjectController {

    private final ProjectService projectService;
    private final DocumentService documentService;

    @GetMapping
    public ResponseEntity<PagedResponse<ProjectResponse>> getAllProjects(
            @PageableDefault(size = 20) Pageable pageable) {
        return ResponseEntity.ok(projectService.getAllProjects(pageable));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ProjectResponse> getProjectById(@PathVariable UUID id) {
        return ResponseEntity.ok(projectService.getProjectById(id));
    }

    @PostMapping
    public ResponseEntity<ProjectResponse> createProject(
            @Valid @RequestBody ProjectCreateRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(projectService.createProject(request));
    }

    @PutMapping("/{id}")
    public ResponseEntity<ProjectResponse> updateProject(
            @PathVariable UUID id,
            @Valid @RequestBody ProjectCreateRequest request) {
        return ResponseEntity.ok(projectService.updateProject(id, request));
    }

    @GetMapping("/{id}/documents")
    public ResponseEntity<PagedResponse<DocumentResponse>> getProjectDocuments(
            @PathVariable UUID id,
            @PageableDefault(size = 20) Pageable pageable) {
        return ResponseEntity.ok(documentService.getDocumentsByProject(id, pageable));
    }
}
