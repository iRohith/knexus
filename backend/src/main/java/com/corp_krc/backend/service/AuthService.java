package com.corp_krc.backend.service;

import com.corp_krc.backend.dto.request.LoginRequest;
import com.corp_krc.backend.dto.request.RegisterRequest;
import com.corp_krc.backend.dto.response.AuthResponse;
import com.corp_krc.backend.entity.Employee;
import com.corp_krc.backend.entity.Role;
import com.corp_krc.backend.exception.DuplicateResourceException;
import com.corp_krc.backend.exception.ResourceNotFoundException;
import com.corp_krc.backend.repository.EmployeeRepository;
import com.corp_krc.backend.repository.RoleRepository;
import com.corp_krc.backend.security.JwtTokenProvider;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Slf4j
@Service
@RequiredArgsConstructor
public class AuthService {

    private final AuthenticationManager authenticationManager;
    private final JwtTokenProvider jwtTokenProvider;
    private final EmployeeRepository employeeRepository;
    private final RoleRepository roleRepository;
    private final PasswordEncoder passwordEncoder;

    public AuthResponse login(LoginRequest request) {
        Authentication authentication = authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(request.getEmail(), request.getPassword()));

        String accessToken = jwtTokenProvider.generateAccessToken(authentication);
        String refreshToken = jwtTokenProvider.generateRefreshToken(request.getEmail());

        Employee employee = employeeRepository.findByEmail(request.getEmail())
                .orElseThrow(() -> new ResourceNotFoundException("Employee", "email", request.getEmail()));

        log.info("Employee logged in: {}", employee.getEmail());

        return buildAuthResponse(accessToken, refreshToken, employee);
    }

    @Transactional
    public AuthResponse register(RegisterRequest request) {
        if (employeeRepository.existsByEmail(request.getEmail())) {
            throw new DuplicateResourceException("Employee", "email", request.getEmail());
        }

        String roleName = "EMPLOYEE";
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

        String accessToken = jwtTokenProvider.generateAccessToken(employee.getEmail());
        String refreshToken = jwtTokenProvider.generateRefreshToken(employee.getEmail());

        log.info("New employee registered: {} with role: {}", employee.getEmail(), roleName);

        return buildAuthResponse(accessToken, refreshToken, employee);
    }

    public AuthResponse refreshToken(String refreshToken) {
        if (!jwtTokenProvider.validateToken(refreshToken)) {
            throw new RuntimeException("Invalid refresh token");
        }

        String email = jwtTokenProvider.getEmailFromToken(refreshToken);
        Employee employee = employeeRepository.findByEmail(email)
                .orElseThrow(() -> new ResourceNotFoundException("Employee", "email", email));

        String newAccessToken = jwtTokenProvider.generateAccessToken(email);
        String newRefreshToken = jwtTokenProvider.generateRefreshToken(email);

        return buildAuthResponse(newAccessToken, newRefreshToken, employee);
    }

    private AuthResponse buildAuthResponse(String accessToken, String refreshToken, Employee employee) {
        return AuthResponse.builder()
                .accessToken(accessToken)
                .refreshToken(refreshToken)
                .tokenType("Bearer")
                .employeeId(employee.getId())
                .email(employee.getEmail())
                .fullName(employee.getFullName())
                .role(employee.getRole().getName())
                .build();
    }
}
