/**
 * LSP Module
 * Exports LSP-based services for semantic code intelligence
 */

export {
    SymbolService,
    getSymbolService,
    initSymbolService,
    resetSymbolService,
    type SymbolInfo,
    type WorkspaceSymbolInfo,
    type ReferenceInfo,
    type DefinitionInfo,
    type CallHierarchyInfo,
    type CallHierarchyResult,
    type HoverInfo,
} from './SymbolService';

export {
    LspEnhancer,
    initLspEnhancer,
    getLspEnhancer,
    resetLspEnhancer,
    type EnhancedNodeInfo,
    type LspDiagnostic,
    type SymbolReferences,
    type ValidatedIssue,
    type CallHierarchyNode,
} from './LspEnhancer';
