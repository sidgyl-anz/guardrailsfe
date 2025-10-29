# System Diagrams

## Chat Flow Sequence Diagram
```mermaid
sequenceDiagram
    participant User
    participant Chatbot
    participant Backend
    participant Guardrails
    participant LLM
    participant ChatHistoryDB

    User->>Chatbot: Send chat message
    Chatbot->>Backend: POST /chat message payload
    Backend->>Guardrails: Submit message for policy validation
    Guardrails-->>Backend: Validation result (allow)
    Backend->>ChatHistoryDB: Persist user message
    ChatHistoryDB-->>Backend: Ack saved message
    Backend->>LLM: Request LLM response
    LLM-->>Backend: AI-generated reply
    Backend->>Guardrails: Submit message for policy validation
    Guardrails-->>Backend: Guarded response payload
    Backend->>ChatHistoryDB: Store AI reply
    ChatHistoryDB-->>Backend: Ack saved reply
    Backend-->>Chatbot: Response payload with AI reply
    Chatbot-->>User: Render updated conversation
```

## Logon Flow Sequence Diagram
```mermaid
sequenceDiagram
    participant User
    participant Chatbot
    participant AuthService
    participant ChatHistoryDB

    User->>Chatbot: Submit credentials
    Chatbot->>AuthService: POST /login (credentials)
    AuthService->>ChatHistoryDB: Validate user record
    ChatHistoryDB-->>AuthService: User record & password hash
    AuthService->>AuthService: Verify password & generate token
    AuthService-->>Chatbot: Auth token & session info
    Chatbot-->>User: Set session & redirect to dashboard
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
        G[Guardrails Middleware]
        M[AI Model Service]
        A[Authentication Service]
    end

    subgraph Data Layer
        D[(ChatHistoryDB)]
        L[(Logs/Analytics)]
    end

    U -- HTTP Requests --> W
    W -- API Calls --> B
    W -- Auth Requests --> A
    B -- Policy Checks --> G
    G -- Prompt Orchestration --> M
    M -- Responses --> G
    G -- Validated Replies --> B
    B -- Read/Write --> D
    A -- Credential Checks --> D
    B -- Event Streams --> L
    W -- UX Metrics --> L
    U <-- Rendered UI -- W
    W <-- Auth Tokens -- A
    B <-- Stored Responses -- D
```
