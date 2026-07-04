package com.corp_krc.backend.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import com.corp_krc.backend.entity.IngestedDocument;

@Repository
public interface IngestedDocumentRepository extends JpaRepository<IngestedDocument, String> {
}
