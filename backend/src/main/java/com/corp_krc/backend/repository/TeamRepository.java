package com.corp_krc.backend.repository;

import com.corp_krc.backend.entity.Team;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface TeamRepository extends JpaRepository<Team, UUID> {

    Optional<Team> findByName(String name);

    boolean existsByName(String name);
}
