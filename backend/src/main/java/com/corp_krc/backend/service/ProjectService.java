package com.corp_krc.backend.service;

import com.corp_krc.backend.dto.request.ProjectCreateRequest;
import com.corp_krc.backend.dto.response.PagedResponse;
import com.corp_krc.backend.dto.response.ProjectResponse;
import com.corp_krc.backend.entity.Project;
import com.corp_krc.backend.entity.Team;
import com.corp_krc.backend.exception.ResourceNotFoundException;
import com.corp_krc.backend.mapper.ProjectMapper;
import com.corp_krc.backend.repository.ProjectRepository;
import com.corp_krc.backend.repository.TeamRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class ProjectService {

    private final ProjectRepository projectRepository;
    private final TeamRepository teamRepository;
    private final ProjectMapper projectMapper;

    @Transactional(readOnly = true)
    public PagedResponse<ProjectResponse> getAllProjects(Pageable pageable) {
        Page<Project> page = projectRepository.findAll(pageable);
        return toPagedResponse(page);
    }

    @Transactional(readOnly = true)
    public ProjectResponse getProjectById(UUID id) {
        Project project = findProjectOrThrow(id);
        return projectMapper.toResponse(project);
    }

    @Transactional
    public ProjectResponse createProject(ProjectCreateRequest request) {
        Team team = null;
        if (request.getTeamId() != null) {
            team = teamRepository.findById(request.getTeamId())
                    .orElseThrow(() -> new ResourceNotFoundException("Team", "id", request.getTeamId()));
        }

        Project project = Project.builder()
                .name(request.getName())
                .description(request.getDescription())
                .team(team)
                .build();

        project = projectRepository.save(project);
        log.info("Created project: {}", project.getName());
        return projectMapper.toResponse(project);
    }

    @Transactional
    public ProjectResponse updateProject(UUID id, ProjectCreateRequest request) {
        Project project = findProjectOrThrow(id);
        project.setName(request.getName());
        project.setDescription(request.getDescription());

        if (request.getTeamId() != null) {
            Team team = teamRepository.findById(request.getTeamId())
                    .orElseThrow(() -> new ResourceNotFoundException("Team", "id", request.getTeamId()));
            project.setTeam(team);
        }

        project = projectRepository.save(project);
        log.info("Updated project: {}", project.getName());
        return projectMapper.toResponse(project);
    }

    private Project findProjectOrThrow(UUID id) {
        return projectRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Project", "id", id));
    }

    private PagedResponse<ProjectResponse> toPagedResponse(Page<Project> page) {
        return PagedResponse.<ProjectResponse>builder()
                .data(page.getContent().stream().map(projectMapper::toResponse).toList())
                .page(page.getNumber())
                .size(page.getSize())
                .totalElements(page.getTotalElements())
                .totalPages(page.getTotalPages())
                .build();
    }
}
