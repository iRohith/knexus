package com.corp_krc.backend.dto.response;

import com.corp_krc.backend.entity.ProjectStatus;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ProjectResponse {

    private UUID id;
    private String name;
    private String description;
    private UUID teamId;
    private String teamName;
    private ProjectStatus status;
    private Instant createdAt;
    private Instant updatedAt;
}
