package com.corp_krc.backend.repository;

import com.corp_krc.backend.entity.Document;
import com.corp_krc.backend.entity.DocumentType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.UUID;

@Repository
public interface DocumentRepository extends JpaRepository<Document, UUID> {

    Page<Document> findByDocumentType(DocumentType documentType, Pageable pageable);

    Page<Document> findByProjectId(UUID projectId, Pageable pageable);

    Page<Document> findByUploadedById(UUID employeeId, Pageable pageable);

    Page<Document> findByDocumentTypeAndProjectId(DocumentType documentType, UUID projectId, Pageable pageable);
}
