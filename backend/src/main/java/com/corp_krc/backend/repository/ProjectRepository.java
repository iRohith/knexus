package com.corp_krc.backend.repository;

import com.corp_krc.backend.entity.Project;
import com.corp_krc.backend.entity.ProjectStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.UUID;

@Repository
public interface ProjectRepository extends JpaRepository<Project, UUID> {

    Page<Project> findByTeamId(UUID teamId, Pageable pageable);

    Page<Project> findByStatus(ProjectStatus status, Pageable pageable);
}
