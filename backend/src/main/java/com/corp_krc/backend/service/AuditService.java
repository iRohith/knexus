package com.corp_krc.backend.service;

import com.corp_krc.backend.entity.AuditLog;
import com.corp_krc.backend.entity.Employee;
import com.corp_krc.backend.repository.AuditLogRepository;
import com.corp_krc.backend.repository.EmployeeRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.util.Map;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class AuditService {

    private final AuditLogRepository auditLogRepository;
    private final EmployeeRepository employeeRepository;

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void logAction(String action, String entityType, UUID entityId, Map<String, Object> changes) {
        Employee actor = getCurrentEmployee();

        AuditLog auditLog = AuditLog.builder()
                .actor(actor)
                .action(action)
                .entityType(entityType)
                .entityId(entityId)
                .changes(changes)
                .build();

        auditLogRepository.save(auditLog);
        log.debug("Audit log created: {} on {} {}", action, entityType, entityId);
    }

    private Employee getCurrentEmployee() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication != null && authentication.getName() != null) {
            return employeeRepository.findByEmail(authentication.getName()).orElse(null);
        }
        return null;
    }
}
