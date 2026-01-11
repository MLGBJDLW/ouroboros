/**
 * Code Graph Indexers
 */

// Base
export { BaseIndexer, type IndexerOptions } from './BaseIndexer';
export { TreeSitterIndexer, type TreeSitterIndexerOptions } from './TreeSitterIndexer';

// TypeScript/JavaScript (uses TS Compiler API)
export { TypeScriptIndexer } from './TypeScriptIndexer';

// Tree-sitter based indexers (v0.4)
export { PythonIndexer, type PythonIndexerOptions } from './PythonIndexer';
export { RustIndexer } from './RustIndexer';
export { GoIndexer } from './GoIndexer';
export { JavaIndexer } from './JavaIndexer';

// Fallback
export { GenericIndexer } from './GenericIndexer';

// Utilities
export { EntrypointDetector, type EntrypointPattern } from './EntrypointDetector';
export { BarrelAnalyzer, type BarrelInfo, type ReexportInfo, type BarrelChain } from './BarrelAnalyzer';
