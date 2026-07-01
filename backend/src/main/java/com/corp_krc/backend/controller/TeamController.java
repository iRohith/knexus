package com.corp_krc.backend.controller;

import com.corp_krc.backend.dto.request.TeamCreateRequest;
import com.corp_krc.backend.dto.response.PagedResponse;
import com.corp_krc.backend.dto.response.TeamResponse;
import com.corp_krc.backend.service.TeamService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@RestController
@RequestMapping("/teams")
@RequiredArgsConstructor
public class TeamController {

    private final TeamService teamService;

    @GetMapping
    public ResponseEntity<PagedResponse<TeamResponse>> getAllTeams(
            @PageableDefault(size = 20) Pageable pageable) {
        return ResponseEntity.ok(teamService.getAllTeams(pageable));
    }

    @GetMapping("/{id}")
    public ResponseEntity<TeamResponse> getTeamById(@PathVariable UUID id) {
        return ResponseEntity.ok(teamService.getTeamById(id));
    }

    @PostMapping
    public ResponseEntity<TeamResponse> createTeam(@Valid @RequestBody TeamCreateRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(teamService.createTeam(request));
    }

    @PutMapping("/{id}")
    public ResponseEntity<TeamResponse> updateTeam(
            @PathVariable UUID id,
            @Valid @RequestBody TeamCreateRequest request) {
        return ResponseEntity.ok(teamService.updateTeam(id, request));
    }

    @PostMapping("/{teamId}/members")
    public ResponseEntity<Void> addMember(
            @PathVariable UUID teamId,
            @RequestParam UUID employeeId,
            @RequestParam(required = false) String roleInTeam) {
        teamService.addMember(teamId, employeeId, roleInTeam);
        return ResponseEntity.status(HttpStatus.CREATED).build();
    }

    @DeleteMapping("/{teamId}/members/{employeeId}")
    public ResponseEntity<Void> removeMember(
            @PathVariable UUID teamId,
            @PathVariable UUID employeeId) {
        teamService.removeMember(teamId, employeeId);
        return ResponseEntity.noContent().build();
    }
}
