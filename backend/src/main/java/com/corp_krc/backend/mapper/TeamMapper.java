package com.corp_krc.backend.mapper;

import com.corp_krc.backend.dto.response.TeamResponse;
import com.corp_krc.backend.entity.Team;
import com.corp_krc.backend.entity.TeamMembership;
import org.springframework.stereotype.Component;

import java.util.Collections;
import java.util.List;

@Component
public class TeamMapper {

    public TeamResponse toResponse(Team team, List<TeamMembership> memberships) {
        List<TeamResponse.MemberInfo> members = memberships != null
                ? memberships.stream()
                    .map(m -> TeamResponse.MemberInfo.builder()
                            .employeeId(m.getEmployee().getId())
                            .fullName(m.getEmployee().getFullName())
                            .email(m.getEmployee().getEmail())
                            .roleInTeam(m.getRoleInTeam())
                            .build())
                    .toList()
                : Collections.emptyList();

        return TeamResponse.builder()
                .id(team.getId())
                .name(team.getName())
                .description(team.getDescription())
                .members(members)
                .createdAt(team.getCreatedAt())
                .build();
    }

    public TeamResponse toResponse(Team team) {
        return toResponse(team, null);
    }
}
