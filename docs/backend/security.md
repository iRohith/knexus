# Security Architecture

## Overview
The security architecture for Knowledge Nexus (corp-KRC) is built on Spring Security, utilizing a stateless, JWT-based authentication model. Because the platform deals with sensitive enterprise knowledge, a strict perimeter is maintained around all API endpoints, ensuring that only authenticated and authorized personnel can access the system.

## JWT Lifecycle

1. **Generation:** A JWT is generated only after a successful login attempt (verifying email and password against the database). The payload (claims) contains the user's `email`, internal `id`, and their `role`.
2. **Transmission:** The token is returned to the client and must be included in the `Authorization` header as a Bearer token (`Bearer <token>`) on all subsequent requests.
3. **Validation:** On every request, a custom security filter intercepts the call, extracts the token, and mathematically verifies its signature using the server's secret key.
4. **Expiration:** Tokens are short-lived. Once expired, the client must re-authenticate. (Note: A refresh token strategy can be implemented here if session longevity becomes a requirement).
5. **Statelessness:** The backend does not store active tokens in a session or database. Revocation requires token expiration or implementing a JWT blacklist (if required in the future).

## Authentication Flow

Authentication is the process of verifying *who* the user is.

1. **Login Request:** The client sends credentials to the `/auth/login` endpoint.
2. **Database Lookup:** The `AuthService` queries PostgreSQL for the employee record.
3. **Password Verification:** The provided password is hashed and compared against the stored hash.
4. **Token Issuance:** If verified, a JWT is signed and returned. If it fails, a `401 Unauthorized` is returned immediately.

## Authorization Flow

Authorization is the process of verifying *what* the user is allowed to do.

1. **Token Interception:** The `JwtAuthenticationFilter` catches all incoming requests (except public endpoints like `/auth/login`).
2. **Claim Extraction:** The filter extracts the user's role from the JWT payload.
3. **Security Context:** Spring's `SecurityContext` is populated with the user's details and granted authorities (roles).
4. **Method Security:** When the request reaches a Controller or Service annotated with role restrictions (e.g., `@PreAuthorize("hasRole('ADMIN')")`), Spring Security evaluates the `SecurityContext`. If the user lacks the required role, a `403 Forbidden` is thrown.

## Role Hierarchy & Permissions

The platform uses a flattened, strictly tiered Role-Based Access Control (RBAC) model. 

- **Implicit Hierarchy:** The `ADMIN` role implicitly holds all the capabilities of the `EMPLOYEE` role.

### ADMIN Permissions
Admins manage the system and curate the knowledge base.
- **Documents:** Upload, delete, and view all enterprise documents.
- **Indexing:** Trigger, retry, and monitor Cognee AI indexing jobs.
- **Organization:** Create and manage Projects and Teams.
- **Users:** Create, update, and deactivate Employee accounts.
- **Global Visibility:** Can view the query history of the entire organization for auditing purposes.

### EMPLOYEE Permissions
Employees are the primary consumers of the knowledge graph.
- **Querying:** Ask natural language questions to the Knowledge Graph.
- **Graph Traversal:** Explore reasoning paths returned by Cognee.
- **Self-Management:** View their own query history.
- **Restriction:** Cannot upload documents, trigger AI indexing, or manage other users.

## Security Filters & Request Lifecycle

```text
[Incoming HTTP Request]
          |
          v
+-------------------------------+
|     CorsFilter (Preflight)    | -> Rejects invalid origins
+-------------------------------+
          |
          v
+-------------------------------+
|  JwtAuthenticationFilter      | -> Extracts & Validates JWT
+-------------------------------+
          |
          | (If token invalid/missing) -> Throws AuthenticationException -> 401 Unauthorized
          |
          v (If token valid)
+-------------------------------+
|   AuthorizationFilter         | -> Checks endpoint role requirements
+-------------------------------+
          |
          | (If unauthorized) -> Throws AccessDeniedException -> 403 Forbidden
          |
          v (If authorized)
   [Controller Endpoint]
```

## Password Handling
- **Hashing:** Passwords are never stored in plaintext. They are hashed using BCrypt (`BCryptPasswordEncoder`) with a strong work factor before being persisted to PostgreSQL.
- **Comparison:** Spring Security automatically handles the secure, timing-attack resistant comparison of the plaintext input against the stored BCrypt hash.

## Threat Considerations

1. **Token Theft (XSS):** If the React frontend stores the JWT in `localStorage`, it is vulnerable to Cross-Site Scripting (XSS). *Mitigation:* Ensure strict Content Security Policies (CSP) on the frontend, or transition to `HttpOnly` cookies.
2. **Brute Force:** The `/auth/login` endpoint is exposed. *Mitigation:* Implement rate limiting at the API Gateway or Nginx layer.
3. **Data Segregation:** The `EMPLOYEE` role must not be able to query documents restricted to specific `ADMIN` projects. *Mitigation:* Rely on Cognee's internal permission mapping (if supported) or filter results at the Service layer before returning them to the client.

## Future Extensibility

### Future OAuth / SSO Compatibility
Because the backend uses standard JWTs and Spring Security's filter chain, integrating Enterprise SSO (e.g., Okta, Azure AD, Google Workspace) is straightforward. 
- The `/auth/login` endpoint would be replaced or supplemented by an OAuth2 redirect flow.
- The `JwtAuthenticationFilter` would be swapped to validate tokens issued by the external Identity Provider (IdP) rather than tokens signed internally.

### Future RBAC Expansion
If the enterprise requires granular permissions (e.g., `PROJECT_MANAGER`, `HR_READER`), the current enum-based role system can be expanded into a relational `Role` and `Permission` table structure in PostgreSQL. 
- Roles would become collections of specific `Authorities`.
- Method security would shift from `@PreAuthorize("hasRole('ADMIN')")` to `@PreAuthorize("hasAuthority('DOCUMENT_UPLOAD')")`.
