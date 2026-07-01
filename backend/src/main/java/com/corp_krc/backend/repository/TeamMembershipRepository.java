package com.corp_krc.backend.repository;

import com.corp_krc.backend.entity.TeamMembership;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface TeamMembershipRepository extends JpaRepository<TeamMembership, UUID> {

    List<TeamMembership> findByTeamId(UUID teamId);

    List<TeamMembership> findByEmployeeId(UUID employeeId);

    Optional<TeamMembership> findByEmployeeIdAndTeamId(UUID employeeId, UUID teamId);

    boolean existsByEmployeeIdAndTeamId(UUID employeeId, UUID teamId);

    void deleteByEmployeeIdAndTeamId(UUID employeeId, UUID teamId);
}
