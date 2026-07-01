package com.corp_krc.backend.dto.request;

import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class TeamCreateRequest {

    @NotBlank(message = "Team name is required")
    private String name;

    private String description;
}
