package com.corp_krc.backend.service;

import com.corp_krc.backend.entity.Document;
import com.corp_krc.backend.integration.cognee.CogneeAddRequest;
import com.corp_krc.backend.integration.cognee.CogneeClient;
import com.corp_krc.backend.integration.cognee.CogneeApiProperties;
import com.corp_krc.backend.integration.cognee.CogneeSearchRequest;
import com.corp_krc.backend.integration.cognee.CogneeSearchResponse;
import com.corp_krc.backend.integration.cognee.CogneeStatusResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

@Slf4j
@Service
@RequiredArgsConstructor
public class CogneeService {

    private final CogneeClient cogneeClient;
    private final CogneeApiProperties cogneeApiProperties;

    private static final int MAX_STATUS_POLLS = 30;
    private static final long POLL_INTERVAL_MS = 2000;

    public void indexDocument(Document document) {
        log.info("Starting Cognee indexing for document: {}", document.getId());

        if (!cogneeApiProperties.isEnabled()) {
            log.info("Cognee is disabled; skipping external indexing for document: {}", document.getId());
            return;
        }

        // Step 1: Add document to Cognee
        CogneeAddRequest addRequest = CogneeAddRequest.builder()
                .data(document.getRawContent())
                .datasetName("knowledge-nexus")
                .build();

        cogneeClient.addDocument(addRequest);

        // Step 2: Trigger cognify
        cogneeClient.triggerCognify();

        // Step 3: Poll for completion
        pollUntilComplete();

        log.info("Cognee indexing completed for document: {}", document.getId());
    }

    public CogneeSearchResponse search(String query) {
        log.info("Searching Cognee for: {}", query);

        CogneeSearchRequest request = CogneeSearchRequest.builder()
                .query(query)
                .build();

        return cogneeClient.search(request);
    }

    private void pollUntilComplete() {
        for (int i = 0; i < MAX_STATUS_POLLS; i++) {
            CogneeStatusResponse status = cogneeClient.checkCognifyStatus();

            if ("completed".equalsIgnoreCase(status.getStatus())) {
                return;
            }

            if ("failed".equalsIgnoreCase(status.getStatus())) {
                throw new com.corp_krc.backend.integration.cognee.CogneeException(
                        "Cognee cognify pipeline failed");
            }

            try {
                Thread.sleep(POLL_INTERVAL_MS);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                throw new com.corp_krc.backend.integration.cognee.CogneeException(
                        "Cognee polling interrupted", e);
            }
        }

        throw new com.corp_krc.backend.integration.cognee.CogneeException(
                "Cognee cognify timed out after " + (MAX_STATUS_POLLS * POLL_INTERVAL_MS / 1000) + " seconds");
    }
}
