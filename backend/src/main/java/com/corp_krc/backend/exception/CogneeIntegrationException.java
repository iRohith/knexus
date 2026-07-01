package com.corp_krc.backend.exception;

public class CogneeIntegrationException extends RuntimeException {

    public CogneeIntegrationException(String message) {
        super(message);
    }

    public CogneeIntegrationException(String message, Throwable cause) {
        super(message, cause);
    }
}
