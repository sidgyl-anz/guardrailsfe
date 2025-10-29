# System Diagrams

## Chat Flow Sequence Diagram
```mermaid
sequenceDiagram
    participant User
    participant WebApp
    participant Backend
    participant Model
    participant Database

    User->>WebApp: Send chat message
    WebApp->>Backend: POST /chat message payload
    Backend->>Database: Persist message
    Database-->>Backend: Ack saved message
    Backend->>Model: Request response with context
    Model-->>Backend: AI-generated reply
    Backend->>Database: Store AI reply
    Database-->>Backend: Ack saved reply
    Backend-->>WebApp: Response payload with AI reply
    WebApp-->>User: Render updated conversation
```

## Logon Flow Sequence Diagram
```mermaid
sequenceDiagram
    participant User
    participant WebApp
    participant AuthService
    participant Database

    User->>WebApp: Submit credentials
    WebApp->>AuthService: POST /login (credentials)
    AuthService->>Database: Validate user record
    Database-->>AuthService: User record & password hash
    AuthService->>AuthService: Verify password & generate token
    AuthService-->>WebApp: Auth token & session info
    WebApp-->>User: Set session & redirect to dashboard
```

## Overall Data Flow Diagram (DFD)
```mermaid
flowchart LR
    subgraph Client Layer
        U[User Browser]
    end

    subgraph Presentation Layer
        W[Web Application]
    end

    subgraph Application Layer
        B[Backend API]
        A[Authentication Service]
        M[AI Model Service]
    end

    subgraph Data Layer
        D[(Database)]
        L[(Logs/Analytics)]
    end

    U -- HTTP Requests --> W
    W -- API Calls --> B
    W -- Auth Requests --> A
    B -- Chat Context --> M
    M -- Responses --> B
    B -- Read/Write --> D
    A -- Credential Checks --> D
    B -- Event Streams --> L
    W -- UX Metrics --> L
    U <-- Rendered UI -- W
    W <-- Auth Tokens -- A
    B <-- Stored Responses -- D
```
