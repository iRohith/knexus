package com.corp_krc.backend.integration.cognee;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

import java.util.Map;

@Slf4j
@Component
@RequiredArgsConstructor
public class CogneeClient {

    private final RestClient cogneeRestClient;

    public void addDocument(CogneeAddRequest request) {
        try {
            log.debug("Calling Cognee /api/v1/add with dataset: {}", request.getDatasetName());
            cogneeRestClient.post()
                    .uri("/api/v1/add")
                    .body(request)
                    .retrieve()
                    .toBodilessEntity();
            log.info("Successfully added document to Cognee");
        } catch (RestClientException e) {
            throw new CogneeException("Failed to add document to Cognee: " + e.getMessage(), e);
        }
    }

    public void triggerCognify() {
        try {
            log.debug("Calling Cognee /api/v1/cognify");
            cogneeRestClient.post()
                    .uri("/api/v1/cognify")
                    .retrieve()
                    .toBodilessEntity();
            log.info("Successfully triggered Cognee cognify");
        } catch (RestClientException e) {
            throw new CogneeException("Failed to trigger Cognee cognify: " + e.getMessage(), e);
        }
    }

    public CogneeStatusResponse checkCognifyStatus() {
        try {
            log.debug("Checking Cognee cognify status");
            return cogneeRestClient.post()
                    .uri("/api/v1/cognify_status")
                    .retrieve()
                    .body(CogneeStatusResponse.class);
        } catch (RestClientException e) {
            throw new CogneeException("Failed to check Cognee status: " + e.getMessage(), e);
        }
    }

    @SuppressWarnings("unchecked")
    public CogneeSearchResponse search(CogneeSearchRequest request) {
        try {
            log.debug("Calling Cognee /api/v1/search with query: {}", request.getQuery());
            Map<String, Object> response = cogneeRestClient.post()
                    .uri("/api/v1/search")
                    .body(request)
                    .retrieve()
                    .body(Map.class);

            CogneeSearchResponse searchResponse = new CogneeSearchResponse();
            searchResponse.setRawResponse(response);
            log.info("Cognee search completed successfully");
            return searchResponse;
        } catch (RestClientException e) {
            throw new CogneeException("Failed to search Cognee: " + e.getMessage(), e);
        }
    }
}
