package com.corp_krc.backend.service;

import com.corp_krc.backend.dto.request.TeamCreateRequest;
import com.corp_krc.backend.dto.response.PagedResponse;
import com.corp_krc.backend.dto.response.TeamResponse;
import com.corp_krc.backend.entity.Employee;
import com.corp_krc.backend.entity.Team;
import com.corp_krc.backend.entity.TeamMembership;
import com.corp_krc.backend.exception.DuplicateResourceException;
import com.corp_krc.backend.exception.ResourceNotFoundException;
import com.corp_krc.backend.mapper.TeamMapper;
import com.corp_krc.backend.repository.EmployeeRepository;
import com.corp_krc.backend.repository.TeamMembershipRepository;
import com.corp_krc.backend.repository.TeamRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class TeamService {

    private final TeamRepository teamRepository;
    private final TeamMembershipRepository teamMembershipRepository;
    private final EmployeeRepository employeeRepository;
    private final TeamMapper teamMapper;

    @Transactional(readOnly = true)
    public PagedResponse<TeamResponse> getAllTeams(Pageable pageable) {
        Page<Team> page = teamRepository.findAll(pageable);
        return PagedResponse.<TeamResponse>builder()
                .data(page.getContent().stream().map(teamMapper::toResponse).toList())
                .page(page.getNumber())
                .size(page.getSize())
                .totalElements(page.getTotalElements())
                .totalPages(page.getTotalPages())
                .build();
    }

    @Transactional(readOnly = true)
    public TeamResponse getTeamById(UUID id) {
        Team team = findTeamOrThrow(id);
        List<TeamMembership> memberships = teamMembershipRepository.findByTeamId(id);
        return teamMapper.toResponse(team, memberships);
    }

    @Transactional
    public TeamResponse createTeam(TeamCreateRequest request) {
        if (teamRepository.existsByName(request.getName())) {
            throw new DuplicateResourceException("Team", "name", request.getName());
        }

        Team team = Team.builder()
                .name(request.getName())
                .description(request.getDescription())
                .build();

        team = teamRepository.save(team);
        log.info("Created team: {}", team.getName());
        return teamMapper.toResponse(team);
    }

    @Transactional
    public TeamResponse updateTeam(UUID id, TeamCreateRequest request) {
        Team team = findTeamOrThrow(id);
        team.setName(request.getName());
        team.setDescription(request.getDescription());
        team = teamRepository.save(team);
        log.info("Updated team: {}", team.getName());
        List<TeamMembership> memberships = teamMembershipRepository.findByTeamId(id);
        return teamMapper.toResponse(team, memberships);
    }

    @Transactional
    public void addMember(UUID teamId, UUID employeeId, String roleInTeam) {
        Team team = findTeamOrThrow(teamId);
        Employee employee = employeeRepository.findById(employeeId)
                .orElseThrow(() -> new ResourceNotFoundException("Employee", "id", employeeId));

        if (teamMembershipRepository.existsByEmployeeIdAndTeamId(employeeId, teamId)) {
            throw new DuplicateResourceException("TeamMembership", "employee+team",
                    employeeId + "+" + teamId);
        }

        TeamMembership membership = TeamMembership.builder()
                .team(team)
                .employee(employee)
                .roleInTeam(roleInTeam != null ? roleInTeam : "MEMBER")
                .joinedAt(Instant.now())
                .build();

        teamMembershipRepository.save(membership);
        log.info("Added employee {} to team {}", employee.getEmail(), team.getName());
    }

    @Transactional
    public void removeMember(UUID teamId, UUID employeeId) {
        if (!teamMembershipRepository.existsByEmployeeIdAndTeamId(employeeId, teamId)) {
            throw new ResourceNotFoundException("TeamMembership", "employee+team",
                    employeeId + "+" + teamId);
        }
        teamMembershipRepository.deleteByEmployeeIdAndTeamId(employeeId, teamId);
        log.info("Removed employee {} from team {}", employeeId, teamId);
    }

    private Team findTeamOrThrow(UUID id) {
        return teamRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Team", "id", id));
    }
}
