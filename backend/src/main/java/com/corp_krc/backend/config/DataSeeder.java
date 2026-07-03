package com.corp_krc.backend.config;

import com.corp_krc.backend.repository.RoleRepository;
import com.corp_krc.backend.repository.EmployeeRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.crypto.password.PasswordEncoder;
import com.corp_krc.backend.entity.Role;
import com.corp_krc.backend.entity.Employee;
import com.corp_krc.backend.entity.RoleName;

import java.util.Set;
import java.util.UUID;

@Slf4j
@Configuration
@RequiredArgsConstructor
public class DataSeeder {

    private final EmployeeRepository employeeRepository;
    private final RoleRepository roleRepository;
    private final PasswordEncoder passwordEncoder;

    @Bean
    public CommandLineRunner seedAdminUser() {
        return args -> {
            if (!employeeRepository.existsByEmail("admin@corp.com")) {
                log.info("Seeding admin user...");

                // Find or create roles
                Role adminRole = roleRepository.findByName(RoleName.ADMIN.name())
                        .orElseGet(() -> roleRepository.save(Role.builder().name(RoleName.ADMIN.name()).build()));

                Role employeeRole = roleRepository.findByName(RoleName.EMPLOYEE.name())
                        .orElseGet(() -> roleRepository.save(Role.builder().name(RoleName.EMPLOYEE.name()).build()));

                // Role viewerRole = roleRepository.findByName(RoleName.ROLE_VIEWER)
                // .orElseGet(() ->
                // roleRepository.save(Role.builder().name(RoleName.ROLE_VIEWER).build()));

                // Create admin user
                Employee admin = Employee.builder()
                        .fullName("Super Admin")
                        .email("admin@corp.com")
                        .passwordHash(passwordEncoder.encode("admin@123"))
                        .role(adminRole)
                        .build();

                employeeRepository.save(admin);
                log.info("Admin user seeded successfully with email: {}", admin.getEmail());
            } else {
                log.info("Admin user already exists, skipping seed");
            }
        };
    }
}
