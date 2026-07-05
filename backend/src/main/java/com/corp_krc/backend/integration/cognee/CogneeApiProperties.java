package com.corp_krc.backend.integration.cognee;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Getter
@Setter
@Component
@ConfigurationProperties(prefix = "cognee")
public class CogneeApiProperties {

    private String baseUrl;
    private String apiKey;
    private boolean enabled = false;
    private int connectTimeoutMs = 5000;
    private int readTimeoutMs = 60000;
}
