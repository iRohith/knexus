package com.corp_krc.backend.integration.cognee;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CogneeAddRequest {

    private String data;
    private String datasetName;
}
