package com.corp_krc.backend.entity;

/**
 * Defines the fixed set of security roles used throughout the application.
 * <p>
 * These values correspond to the role names stored in the {@code roles} table
 * and are used by {@link com.corp_krc.backend.security.SecurityConfig} for
 * authorization checks (e.g., {@code hasRole("ADMIN")}).
 */
public enum RoleName {

    ADMIN,
    EMPLOYEE;

    /**
     * Returns the role name as stored in the database.
     * Example: {@code RoleName.ADMIN.getValue()} → {@code "ADMIN"}
     */
    public String getValue() {
        return this.name();
    }
}
