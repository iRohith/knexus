package com.corp_krc.backend.config;

import com.corp_krc.backend.repository.RoleRepository;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.corp_krc.backend.repository.EmployeeRepository;
import com.corp_krc.backend.repository.IngestedDocumentRepository;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.io.support.PathMatchingResourcePatternResolver;
import org.springframework.security.crypto.password.PasswordEncoder;
import com.corp_krc.backend.entity.Role;
import com.corp_krc.backend.dto.ingestion.JsonInboundPayload;
import com.corp_krc.backend.entity.Employee;
import com.corp_krc.backend.entity.IngestedDocument;
import com.corp_krc.backend.entity.RoleName;
import org.springframework.core.io.Resource;

import java.io.InputStream;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.UUID;

@Slf4j
@Configuration
@RequiredArgsConstructor
public class DataSeeder {

    private final EmployeeRepository employeeRepository;
    private final RoleRepository roleRepository;
    private final PasswordEncoder passwordEncoder;

    private final IngestedDocumentRepository ingestedDocumentRepository;
    private final ObjectMapper objectMapper;

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

    @Bean
    public CommandLineRunner seedCorporateData() {
        return args -> {
            log.info("Starting dynamic corporate knowledge base extraction window...");

            PathMatchingResourcePatternResolver resolver = new PathMatchingResourcePatternResolver();

            try {
                Resource[] resources = resolver.getResources("classpath:corp-os-data/**/*.json");
                log.info("Identified {} data source payload vectors for ingestion processing.", resources.length);

                List<IngestedDocument> batchToSave = new ArrayList<>();

                for (Resource resource : resources) {
                    log.info("Processing ingestion data grid target: [{}]", resource.getFilename());

                    try (InputStream inputStream = resource.getInputStream()) {
                        List<JsonInboundPayload> payloads = objectMapper.readValue(
                                inputStream,
                                new TypeReference<List<JsonInboundPayload>>() {
                                });

                        for (JsonInboundPayload payload : payloads) {
                            if (!ingestedDocumentRepository.existsById(payload.getId())) {
                                IngestedDocument document = IngestedDocument.builder()
                                        .id(payload.getId())
                                        .sourceApp(payload.getSourceApp())
                                        .actorId(payload.getActorId())
                                        .occurredAt(Instant.ofEpochMilli(payload.getOccurredAt()))
                                        .type(payload.getType())
                                        .action(payload.getAction())
                                        .title(payload.getTitle())
                                        .body(payload.getBody())
                                        .sourceEntityId(payload.getSourceEntityId())
                                        .sourceEntityType(payload.getSourceEntityType())
                                        .sourceUrl(payload.getSourceUrl())
                                        .build();

                                batchToSave.add(document);
                            }
                        }
                    } catch (Exception e) {
                        log.error("Failed to extract data mapping sequence from file: {}", resource.getFilename(), e);
                    }
                }

                if (!batchToSave.isEmpty()) {
                    ingestedDocumentRepository.saveAll(batchToSave);
                    log.info("Ingestion completed successfully. Saved {} new records to Postgres.", batchToSave.size());
                } else {
                    log.info("No new ingestion signatures found. Knowledge baseline is up to date.");
                }

            } catch (Exception e) {
                log.error("Fatal system trap encountered during seeder execution routing", e);
            }
        };
    }
}
