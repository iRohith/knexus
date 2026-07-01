package com.corp_krc.backend.security;

import com.corp_krc.backend.entity.Employee;
import com.corp_krc.backend.repository.EmployeeRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class CustomUserDetailsService implements UserDetailsService {

    private final EmployeeRepository employeeRepository;

    @Override
    @Transactional(readOnly = true)
    public UserDetails loadUserByUsername(String email) throws UsernameNotFoundException {
        Employee employee = employeeRepository.findByEmail(email)
                .orElseThrow(() -> new UsernameNotFoundException(
                        "Employee not found with email: " + email));

        if (!employee.getIsActive()) {
            throw new UsernameNotFoundException("Employee account is deactivated: " + email);
        }

        return new User(
                employee.getEmail(),
                employee.getPasswordHash(),
                List.of(new SimpleGrantedAuthority("ROLE_" + employee.getRole().getName()))
        );
    }
}
