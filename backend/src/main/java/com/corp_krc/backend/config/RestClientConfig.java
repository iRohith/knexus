package com.corp_krc.backend.config;

import com.corp_krc.backend.integration.cognee.CogneeApiProperties;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.web.client.ClientHttpRequestFactories;
import org.springframework.boot.web.client.ClientHttpRequestFactorySettings;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.client.ClientHttpRequestFactory;
import org.springframework.web.client.RestClient;

import java.time.Duration;

@Configuration
@RequiredArgsConstructor
public class RestClientConfig {

    private final CogneeApiProperties cogneeApiProperties;

    @Bean
    public RestClient cogneeRestClient() {
        ClientHttpRequestFactorySettings settings = ClientHttpRequestFactorySettings.DEFAULTS
                .withConnectTimeout(Duration.ofMillis(cogneeApiProperties.getConnectTimeoutMs()))
                .withReadTimeout(Duration.ofMillis(cogneeApiProperties.getReadTimeoutMs()));

        ClientHttpRequestFactory requestFactory = ClientHttpRequestFactories.get(settings);

        return RestClient.builder()
                .baseUrl(cogneeApiProperties.getBaseUrl())
                .defaultHeader("X-Api-Key", cogneeApiProperties.getApiKey())
                .defaultHeader("Content-Type", "application/json")
                .requestFactory(requestFactory)
                .build();
    }
}
