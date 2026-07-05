package com.corp_krc.backend.repository;

import com.corp_krc.backend.entity.PatchBatch;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface PatchBatchRepository extends JpaRepository<PatchBatch, String> {

    List<PatchBatch> findByClientCreatedAtGreaterThanOrderByClientCreatedAtAsc(Long since);

    List<PatchBatch> findAllByOrderByClientCreatedAtAsc();
}
