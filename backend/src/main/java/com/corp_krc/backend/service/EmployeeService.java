package com.corp_krc.backend.service;

import com.corp_krc.backend.dto.request.EmployeeCreateRequest;
import com.corp_krc.backend.dto.request.EmployeeUpdateRequest;
import com.corp_krc.backend.dto.response.EmployeeResponse;
import com.corp_krc.backend.dto.response.PagedResponse;
import com.corp_krc.backend.entity.Employee;
import com.corp_krc.backend.entity.Role;
import com.corp_krc.backend.exception.DuplicateResourceException;
import com.corp_krc.backend.exception.ResourceNotFoundException;
import com.corp_krc.backend.mapper.EmployeeMapper;
import com.corp_krc.backend.repository.EmployeeRepository;
import com.corp_krc.backend.repository.RoleRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class EmployeeService {

    private final EmployeeRepository employeeRepository;
    private final RoleRepository roleRepository;
    private final PasswordEncoder passwordEncoder;
    private final EmployeeMapper employeeMapper;

    @Transactional(readOnly = true)
    public PagedResponse<EmployeeResponse> getAllEmployees(Pageable pageable) {
        Page<Employee> page = employeeRepository.findAll(pageable);
        return toPagedResponse(page);
    }

    @Transactional(readOnly = true)
    public EmployeeResponse getEmployeeById(UUID id) {
        Employee employee = findEmployeeOrThrow(id);
        return employeeMapper.toResponse(employee);
    }

    @Transactional(readOnly = true)
    public EmployeeResponse getEmployeeByEmail(String email) {
        Employee employee = employeeRepository.findByEmail(email)
                .orElseThrow(() -> new ResourceNotFoundException("Employee", "email", email));
        return employeeMapper.toResponse(employee);
    }

    @Transactional
    public EmployeeResponse createEmployee(EmployeeCreateRequest request) {
        if (employeeRepository.existsByEmail(request.getEmail())) {
            throw new DuplicateResourceException("Employee", "email", request.getEmail());
        }

        String roleName = request.getRoleName() != null ? request.getRoleName() : "EMPLOYEE";
        Role role = roleRepository.findByName(roleName)
                .orElseThrow(() -> new ResourceNotFoundException("Role", "name", roleName));

        Employee employee = Employee.builder()
                .email(request.getEmail())
                .passwordHash(passwordEncoder.encode(request.getPassword()))
                .fullName(request.getFullName())
                .role(role)
                .isActive(true)
                .build();

        employee = employeeRepository.save(employee);
        log.info("Created employee: {}", employee.getEmail());
        return employeeMapper.toResponse(employee);
    }

    @Transactional
    public EmployeeResponse updateEmployee(UUID id, EmployeeUpdateRequest request) {
        Employee employee = findEmployeeOrThrow(id);

        if (request.getFullName() != null) {
            employee.setFullName(request.getFullName());
        }
        if (request.getRoleName() != null) {
            Role role = roleRepository.findByName(request.getRoleName())
                    .orElseThrow(() -> new ResourceNotFoundException("Role", "name", request.getRoleName()));
            employee.setRole(role);
        }

        employee = employeeRepository.save(employee);
        log.info("Updated employee: {}", employee.getEmail());
        return employeeMapper.toResponse(employee);
    }

    @Transactional
    public void deactivateEmployee(UUID id) {
        Employee employee = findEmployeeOrThrow(id);
        employee.setIsActive(false);
        employeeRepository.save(employee);
        log.info("Deactivated employee: {}", employee.getEmail());
    }

    private Employee findEmployeeOrThrow(UUID id) {
        return employeeRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Employee", "id", id));
    }

    private PagedResponse<EmployeeResponse> toPagedResponse(Page<Employee> page) {
        return PagedResponse.<EmployeeResponse>builder()
                .data(page.getContent().stream().map(employeeMapper::toResponse).toList())
                .page(page.getNumber())
                .size(page.getSize())
                .totalElements(page.getTotalElements())
                .totalPages(page.getTotalPages())
                .build();
    }
}
