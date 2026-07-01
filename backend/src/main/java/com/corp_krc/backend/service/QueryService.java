package com.corp_krc.backend.service;

import com.corp_krc.backend.dto.request.KnowledgeQueryRequest;
import com.corp_krc.backend.dto.response.KnowledgeQueryResponse;
import com.corp_krc.backend.dto.response.PagedResponse;
import com.corp_krc.backend.dto.response.QueryHistoryResponse;
import com.corp_krc.backend.entity.Employee;
import com.corp_krc.backend.entity.QueryHistory;
import com.corp_krc.backend.exception.ResourceNotFoundException;
import com.corp_krc.backend.integration.cognee.CogneeSearchResponse;
import com.corp_krc.backend.mapper.QueryMapper;
import com.corp_krc.backend.repository.EmployeeRepository;
import com.corp_krc.backend.repository.QueryHistoryRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Map;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class QueryService {

    private final CogneeService cogneeService;
    private final QueryHistoryRepository queryHistoryRepository;
    private final EmployeeRepository employeeRepository;
    private final QueryMapper queryMapper;

    @Transactional
    public KnowledgeQueryResponse executeQuery(KnowledgeQueryRequest request, String employeeEmail) {
        Employee employee = employeeRepository.findByEmail(employeeEmail)
                .orElseThrow(() -> new ResourceNotFoundException("Employee", "email", employeeEmail));

        long startTime = System.currentTimeMillis();

        // Call Cognee for search/reasoning
        CogneeSearchResponse cogneeResponse = cogneeService.search(request.getQuestion());

        int responseTimeMs = (int) (System.currentTimeMillis() - startTime);

        Map<String, Object> rawResponse = cogneeResponse.getRawResponse();

        // Save query history
        QueryHistory history = QueryHistory.builder()
                .employee(employee)
                .question(request.getQuestion())
                .cogneeResponse(rawResponse)
                .reasoningPath(rawResponse)
                .responseTimeMs(responseTimeMs)
                .build();

        history = queryHistoryRepository.save(history);

        log.info("Query executed by {} in {}ms: {}", employeeEmail, responseTimeMs, request.getQuestion());

        return KnowledgeQueryResponse.builder()
                .queryId(history.getId())
                .question(request.getQuestion())
                .answer(rawResponse != null ? String.valueOf(rawResponse.getOrDefault("answer", "")) : "")
                .reasoningPath(rawResponse)
                .graphData(rawResponse)
                .responseTimeMs(responseTimeMs)
                .timestamp(history.getCreatedAt())
                .build();
    }

    @Transactional(readOnly = true)
    public PagedResponse<QueryHistoryResponse> getQueryHistory(String employeeEmail, Pageable pageable) {
        Employee employee = employeeRepository.findByEmail(employeeEmail)
                .orElseThrow(() -> new ResourceNotFoundException("Employee", "email", employeeEmail));

        Page<QueryHistory> page = queryHistoryRepository
                .findByEmployeeIdOrderByCreatedAtDesc(employee.getId(), pageable);

        return PagedResponse.<QueryHistoryResponse>builder()
                .data(page.getContent().stream().map(queryMapper::toResponse).toList())
                .page(page.getNumber())
                .size(page.getSize())
                .totalElements(page.getTotalElements())
                .totalPages(page.getTotalPages())
                .build();
    }

    @Transactional(readOnly = true)
    public QueryHistoryResponse getQueryById(UUID queryId) {
        QueryHistory history = queryHistoryRepository.findById(queryId)
                .orElseThrow(() -> new ResourceNotFoundException("QueryHistory", "id", queryId));
        return queryMapper.toResponse(history);
    }
}
