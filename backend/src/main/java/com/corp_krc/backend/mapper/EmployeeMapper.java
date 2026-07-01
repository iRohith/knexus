package com.corp_krc.backend.mapper;

import com.corp_krc.backend.dto.response.EmployeeResponse;
import com.corp_krc.backend.entity.Employee;
import org.springframework.stereotype.Component;

@Component
public class EmployeeMapper {

    public EmployeeResponse toResponse(Employee employee) {
        return EmployeeResponse.builder()
                .id(employee.getId())
                .email(employee.getEmail())
                .fullName(employee.getFullName())
                .role(employee.getRole().getName())
                .isActive(employee.getIsActive())
                .createdAt(employee.getCreatedAt())
                .build();
    }
}
