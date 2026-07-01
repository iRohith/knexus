package com.corp_krc.backend.repository;

import com.corp_krc.backend.entity.QueryHistory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.UUID;

@Repository
public interface QueryHistoryRepository extends JpaRepository<QueryHistory, UUID> {

    Page<QueryHistory> findByEmployeeIdOrderByCreatedAtDesc(UUID employeeId, Pageable pageable);
}
