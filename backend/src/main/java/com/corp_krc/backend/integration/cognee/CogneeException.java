package com.corp_krc.backend.integration.cognee;

import com.corp_krc.backend.exception.CogneeIntegrationException;

public class CogneeException extends CogneeIntegrationException {

    public CogneeException(String message) {
        super(message);
    }

    public CogneeException(String message, Throwable cause) {
        super(message, cause);
    }
}
