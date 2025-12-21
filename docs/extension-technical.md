# Extension Technical Documentation

Technical reference for the Ouroboros VS Code Extension.

## Architecture

```
extension/
├── src/                    # Extension source code
│   ├── extension.ts        # Entry point, activation
│   ├── constants.ts        # Configuration constants
│   ├── tools/              # LM Tools implementations
│   │   ├── ask.ts          # ouroboros_ask tool
│   │   ├── menu.ts         # ouroboros_menu tool
│   │   ├── confirm.ts      # ouroboros_confirm tool
│   │   ├── planReview.ts   # ouroboros_plan_review tool
│   │   ├── phaseProgress.ts# ouroboros_phase_progress tool
│   │   ├── handoff.ts      # ouroboros_agent_handoff tool
│   │   ├── schemas.ts      # Zod validation schemas
│   │   └── types.ts        # TypeScript interfaces
│   ├── webview/            # Sidebar provider
│   │   └── SidebarProvider.ts
│   ├── storage/            # State management
│   │   └── stateManager.ts
│   ├── commands/           # VS Code commands
│   │   └── initializeProject.ts
│   └── utils/              # Utilities
│       ├── promptTransformer.ts  # CCL → LM Tools transform
│       ├── logger.ts
│       └── disposable.ts
├── webview/                # React UI
│   ├── src/
│   │   ├── App.tsx         # Main component
│   │   ├── views/          # Tab views
│   │   ├── components/     # Reusable UI components
│   │   └── context/        # React contexts
│   └── dist/               # Built webview assets
└── dist/                   # Built extension bundle
```

## LM Tools

| Tool | Purpose | Key Parameters |
|------|---------|----------------|
| `ouroboros_ask` | Get user input | `type`, `question`, `inputLabel` |
| `ouroboros_menu` | Multiple choice | `question`, `options`, `allowCustom` |
| `ouroboros_confirm` | Yes/No dialog | `question`, `yesLabel`, `noLabel` |
| `ouroboros_plan_review` | Document review | `plan`, `title`, `mode` |
| `ouroboros_phase_progress` | Progress update | `workflow`, `currentPhase`, `totalPhases` |
| `ouroboros_agent_handoff` | Agent switch | `from`, `to`, `fromLevel`, `toLevel` |

## Build Commands

```bash
# Install dependencies
npm install
cd webview && npm install

# Development
npm run compile        # Build once
npm run watch          # Watch mode

# Testing
npm run test           # Run vitest
npm run test -- --coverage  # With coverage

# Linting
npm run lint           # ESLint

# Package
npm run package        # Production build
```

## Key Files

| File | Purpose |
|------|---------|
| `package.json` | Extension manifest, tool definitions |
| `vitest.config.ts` | Test configuration |
| `eslint.config.js` | Linting rules |
| `tsconfig.json` | TypeScript config |

## Webview Communication

```
Extension (Node.js)          Webview (React)
       │                           │
       │──── newRequest ──────────>│
       │                           │
       │<─── respond ──────────────│
       │                           │
       │──── pendingRequestsUpdate>│
```

**Message Types:**
- `newRequest` - New tool invocation
- `respond` - User response
- `cancel` - Cancel request
- `pendingRequestsUpdate` - Full state sync
- `stateUpdate` - Workspace state change

## Prompt Transformation

The `promptTransformer.ts` converts Python CCL commands to LM Tool calls:

```
Before (Python CCL):
python -c "task = input('[Ouroboros] > ')"

After (LM Tool):
Use the ouroboros_ask tool with: { "type": "task" }
```

## Testing

- **Framework**: Vitest
- **Coverage Target**: 70%
- **Test Files**: `*.test.ts` co-located with source

```bash
npm run test -- --run     # Single run
npm run test              # Watch mode
```

## CI/CD

Extension is part of the main CI workflow:
1. `npm run lint` - ESLint check
2. `npm run test` - Unit tests
3. `npm run compile` - Build verification

Release workflow publishes to VS Code Marketplace via `vsce publish`.
