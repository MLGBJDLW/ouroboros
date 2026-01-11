# Code Graph Tool Response Envelope

> Unified response format for all Code Graph LM Tools

## Overview

All Code Graph tools return responses wrapped in a standardized envelope format. This ensures:

- **Predictable structure** — Copilot/agents can reliably parse responses
- **Token efficiency** — Metadata helps agents decide when to paginate or narrow queries
- **Actionable guidance** — `nextQuerySuggestion` tells agents what to do next
- **Error consistency** — Errors follow the same structure as successes

## Envelope Structure

### Success Response

```typescript
interface SuccessEnvelope<T> {
    success: true;
    data: {
        tool: string;           // e.g., "ouroborosai_graph_digest"
        version: string;        // "1.0"
        requestId: string;      // Short unique ID
        generatedAt: string;    // ISO timestamp
        workspace: {
            root: string;       // Workspace root path
            repoName: string;   // Repository name
            rev?: string;       // Git revision (optional)
        };
        result: T;              // Tool-specific business output
        meta: {
            approxTokens: number;
            truncated: boolean;
            limits: {
                maxItems?: number;
                maxDepth?: number;
            };
            nextQuerySuggestion?: Array<{
                tool: string;
                args: Record<string, unknown>;
                reason?: string;
            }>;
            page?: {
                cursor?: string;
                hasMore: boolean;
                total?: number;
            };
        };
    };
}
```

### Error Response

```typescript
interface ErrorEnvelope {
    success: false;
    data: {
        tool: string;
        version: string;
        requestId: string;
        generatedAt: string;
        workspace: WorkspaceContext;
        result: {
            error: {
                code: string;       // e.g., "INVALID_INPUT", "INTERNAL_ERROR"
                message: string;    // Human-readable message
                details?: Record<string, unknown>;
            };
        };
        meta: ResponseMeta;
    };
}
```

## Error Codes

| Code | Description |
|------|-------------|
| `INVALID_INPUT` | Input validation failed |
| `INTERNAL_ERROR` | Unexpected error during execution |
| `NOT_AVAILABLE` | Required component not initialized |
| `MISSING_PARAMS` | Required parameters not provided |
| `UNKNOWN_ACTION` | Invalid action specified |

## Example Responses

### graph.digest Success

```json
{
    "success": true,
    "data": {
        "tool": "ouroborosai_graph_digest",
        "version": "1.0",
        "requestId": "a1b2c3d4",
        "generatedAt": "2026-01-10T12:00:00.000Z",
        "workspace": {
            "root": "/home/user/project",
            "repoName": "project"
        },
        "result": {
            "summary": { "files": 142, "modules": 38, "entrypoints": 12, "edges": 487 },
            "entrypoints": { "routes": ["GET /api/users"], "commands": [], "pages": [], "jobs": [] },
            "hotspots": [{ "path": "src/core/engine.ts", "importers": 24, "exports": 8 }],
            "issues": { "HANDLER_UNREACHABLE": 3, "DYNAMIC_EDGE_UNKNOWN": 7 },
            "meta": { "lastIndexed": "2026-01-10T12:00:00Z", "tokensEstimate": 480 }
        },
        "meta": {
            "approxTokens": 520,
            "truncated": false,
            "limits": { "maxItems": 10 },
            "nextQuerySuggestion": [
                {
                    "tool": "ouroborosai_graph_issues",
                    "args": { "severity": "error", "limit": 20 },
                    "reason": "Issues detected - review errors first"
                }
            ]
        }
    }
}
```

### graph.issues Error

```json
{
    "success": false,
    "data": {
        "tool": "ouroborosai_graph_issues",
        "version": "1.0",
        "requestId": "x9y8z7w6",
        "generatedAt": "2026-01-10T12:00:00.000Z",
        "workspace": {
            "root": "/home/user/project",
            "repoName": "project"
        },
        "result": {
            "error": {
                "code": "INVALID_INPUT",
                "message": "Invalid input: kind must be one of HANDLER_UNREACHABLE, DYNAMIC_EDGE_UNKNOWN, BROKEN_EXPORT_CHAIN",
                "details": { "errors": [{ "path": ["kind"], "message": "Invalid enum value" }] }
            }
        },
        "meta": {
            "approxTokens": 150,
            "truncated": false,
            "limits": {}
        }
    }
}
```

## Usage Guidelines

### For Copilot/Agents

1. **Always check `success`** before accessing `result`
2. **Respect `truncated`** — if true, narrow your query or paginate
3. **Follow `nextQuerySuggestion`** — it guides optimal query flow
4. **Use `approxTokens`** to track token budget

### For Tool Implementers

```typescript
import {
    createSuccessEnvelope,
    createErrorEnvelope,
    envelopeToResult,
    getWorkspaceContext,
} from './envelope';

// Success case
const envelope = createSuccessEnvelope(
    TOOLS.GRAPH_DIGEST,
    result,
    getWorkspaceContext(),
    {
        truncated: false,
        limits: { maxItems: 10 },
        nextQuerySuggestion: [{ tool: TOOLS.GRAPH_ISSUES, args: { severity: 'error' } }],
    }
);
return envelopeToResult(envelope);

// Error case
const envelope = createErrorEnvelope(
    TOOLS.GRAPH_DIGEST,
    'INVALID_INPUT',
    'Invalid scope parameter',
    getWorkspaceContext(),
    { scope: input.scope }
);
return envelopeToResult(envelope);
```

## Token Estimation

Tokens are estimated as `Math.ceil(JSON.stringify(envelope).length / 4)`.

This is a rough approximation (4 characters ≈ 1 token) suitable for budget tracking.

---

**All 8 Code Graph tools use this envelope format.**
