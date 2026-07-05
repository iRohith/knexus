package com.corp_krc.backend.config;

import com.corp_krc.backend.repository.EmployeeRepository;
import com.corp_krc.backend.repository.RoleRepository;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.crypto.password.PasswordEncoder;
import com.corp_krc.backend.entity.Role;
import com.corp_krc.backend.entity.Employee;
import com.corp_krc.backend.entity.RoleName;

import java.util.HashSet;
import java.util.List;
import java.util.Set;

@Slf4j
@Configuration
@RequiredArgsConstructor
public class DataSeeder {

    private static final List<SeedEmployee> SEED_EMPLOYEES = List.of(
            new SeedEmployee("Ava Chen", "ava.chen@redwoodinference.com", RoleName.ADMIN),
            new SeedEmployee("Ethan Park", "ethan.park@redwoodinference.com", RoleName.EMPLOYEE),
            new SeedEmployee("Priya Natarajan", "priya.natarajan@redwoodinference.com", RoleName.EMPLOYEE),
            new SeedEmployee("Sean Gallagher", "sean.gallagher@redwoodinference.com", RoleName.EMPLOYEE),
            new SeedEmployee("Logan Wright", "logan.wright@redwoodinference.com", RoleName.EMPLOYEE),
            new SeedEmployee("Rafael Mendes", "rafael.mendes@redwoodinference.com", RoleName.EMPLOYEE),
            new SeedEmployee("Marcus Lin", "marcus.lin@redwoodinference.com", RoleName.EMPLOYEE),
            new SeedEmployee("Jordan Blake", "jordan.blake@redwoodinference.com", RoleName.EMPLOYEE),
            new SeedEmployee("Ben Carter", "ben.carter@redwoodinference.com", RoleName.EMPLOYEE),
            new SeedEmployee("Mateo Alvarez", "mateo.alvarez@redwoodinference.com", RoleName.EMPLOYEE));

    private final EmployeeRepository employeeRepository;
    private final RoleRepository roleRepository;
    private final PasswordEncoder passwordEncoder;

    @Value("${app.seed.user-password-template}")
    private String userPasswordTemplate;

    @Bean
    public CommandLineRunner seedAuthUsers() {
        return args -> {
            log.info("Seeding fixed auth users...");

            Role adminRole = roleRepository.findByName(RoleName.ADMIN.name())
                    .orElseGet(() -> roleRepository.save(Role.builder().name(RoleName.ADMIN.name()).build()));
            Role employeeRole = roleRepository.findByName(RoleName.EMPLOYEE.name())
                    .orElseGet(() -> roleRepository.save(Role.builder().name(RoleName.EMPLOYEE.name()).build()));

            Set<String> activeSeedEmails = new HashSet<>();

            for (SeedEmployee seedEmployee : SEED_EMPLOYEES) {
                activeSeedEmails.add(seedEmployee.email());
                Role role = seedEmployee.roleName() == RoleName.ADMIN ? adminRole : employeeRole;
                String password = seedPasswordFor(seedEmployee);

                Employee employee = employeeRepository.findByEmail(seedEmployee.email())
                        .orElseGet(Employee::new);
                employee.setFullName(seedEmployee.fullName());
                employee.setEmail(seedEmployee.email());
                employee.setPasswordHash(passwordEncoder.encode(password));
                employee.setRole(role);
                employee.setIsActive(true);

                employeeRepository.save(employee);
            }

            List<Employee> employees = employeeRepository.findAll();
            for (Employee employee : employees) {
                if (activeSeedEmails.contains(employee.getEmail())) {
                    continue;
                }
                if (Boolean.TRUE.equals(employee.getIsActive())) {
                    employee.setIsActive(false);
                    employeeRepository.save(employee);
                }
            }

            log.info("Seeded {} auth users. Ava Chen is the only ADMIN.", SEED_EMPLOYEES.size());
        };
    }

    private record SeedEmployee(String fullName, String email, RoleName roleName) {

        private String firstName() {
            return fullName.split(" ")[0];
        }
    }

    private String seedPasswordFor(SeedEmployee seedEmployee) {
        return userPasswordTemplate
                .replace("{first}", seedEmployee.firstName().toLowerCase())
                .replace("{email}", seedEmployee.email());
    }
}
