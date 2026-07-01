package com.corp_krc.backend.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TeamResponse {

    private UUID id;
    private String name;
    private String description;
    private List<MemberInfo> members;
    private Instant createdAt;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class MemberInfo {
        private UUID employeeId;
        private String fullName;
        private String email;
        private String roleInTeam;
    }
}
