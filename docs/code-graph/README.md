# Code Graph System

> A queryable truth layer for codebase structure, enabling token-efficient Copilot interactions and visual dependency exploration.

## Overview

The Code Graph system provides:

1. **Structural Analysis** - Parse and index code dependencies across multiple languages
2. **Missing Links Detection** - Identify disconnected features, unreachable handlers, broken exports
3. **Impact Analysis** - Trace how changes propagate through the codebase
4. **Token-Efficient Tools** - LM Tools designed for minimal token consumption
5. **Synchronized Views** - Users and Copilot see the same prioritized information

## Core Principle

> **Never feed the full graph to Copilot.**

Copilot only receives:
- **Digests** - Compressed summaries (~500 tokens)
- **Query Results** - On-demand, scoped responses

This keeps token usage stable and predictable.

## Supported Languages

| Language | Parser | Confidence |
|----------|--------|------------|
| TypeScript/JavaScript | TS Compiler API | High |
| Python | tree-sitter | High |
| Rust | tree-sitter | High |
| Go | tree-sitter | Medium |
| Java | tree-sitter | Medium |
| C# | tree-sitter | Medium |
| Ruby | tree-sitter | Medium |
| PHP | tree-sitter | Medium |
| Other | Regex fallback | Low |

## Supported Frameworks

**JS/TS**: Express, Koa, Fastify, Hono, Next.js, Nuxt, SvelteKit, Remix, Astro, NestJS
**Python**: FastAPI, Flask, Django, Click
**Rust**: Actix-web, Axum, Rocket, Clap
**Go**: Gin, Echo, Cobra
**Java**: Spring Boot
**Ruby**: Rails
**PHP**: Laravel

## Documentation Index

| Document | Purpose |
|----------|---------|
| [MVP Specification](./MVP.md) | Minimum viable implementation |
| [Architecture](./ARCHITECTURE.md) | System design and data structures |
| [Tools Reference](./TOOLS.md) | LM Tools API specification |
| [Issue Taxonomy](./ISSUES.md) | Missing Links classification |
| [Upgrade Path](./UPGRADE_PATH.md) | Roadmap from MVP to full system |

## Quick Start (After Implementation)

```typescript
// Copilot's typical workflow
1. Call graph.digest() → Get overview (~500 tokens)
2. Identify area of interest
3. Call graph.issues.list({ scope: "src/api" }) → Get specific issues
4. Call graph.impact({ target: "src/api/users.ts" }) → Understand blast radius
5. Fix with full context, minimal tokens
```

## Key Differentiators

- **Issue Taxonomy** - Standardized classification of "what's broken"
- **Confidence Levels** - Honest about uncertainty (high/medium/low/unknown)
- **Annotations** - User-provided hints for dynamic edges
- **Framework Adapters** - Pluggable support for 25+ frameworks across 8 languages

---

**The Graph is the Truth. Query it, don't dump it.**
