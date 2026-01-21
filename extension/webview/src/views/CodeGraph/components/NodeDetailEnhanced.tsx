/**
 * NodeDetailEnhanced Component
 * Enhanced node detail view with LSP integration
 * 
 * Features:
 * - Graph-based info (fast, cached)
 * - LSP symbols with navigation
 * - LSP diagnostics display
 * - Call hierarchy visualization
 * - Reference finding
 */

import { useState, useEffect, useCallback } from 'react';
import { Icon } from '../../../components/Icon';
import { Spinner } from '../../../components/Spinner';
import type { 
    GraphNode, 
    ModuleInfo, 
    ImpactResult, 
    GraphIssue,
    EnhancedNodeInfo,
    LspSymbol,
    LspDiagnostic,
    CallHierarchyNode,
    LspReference,
} from '../types';
import styles from './NodeDetail.module.css';

interface NodeDetailEnhancedProps {
    node: GraphNode | null;
    issues: GraphIssue[];
    onClose: () => void;
    onOpenFile: (path: string, line?: number, column?: number) => void;
    onAnalyzeImpact: (path: string) => Promise<ImpactResult | null>;
    onGetModule: (path: string) => Promise<ModuleInfo | null>;
    onGetEnhancedInfo: (path: string) => Promise<EnhancedNodeInfo | null>;
    onGetCallHierarchy: (path: string, line: number, column: number) => Promise<CallHierarchyNode | null>;
    onFindReferences: (path: string, line: number, column: number) => Promise<LspReference[]>;
    onFixWithCopilot: (issue: GraphIssue) => void;
    onAddToContext: (type: string, data: unknown) => void;
}

type TabType = 'info' | 'symbols' | 'issues' | 'diagnostics' | 'impact' | 'calls';

export function NodeDetailEnhanced({
    node,
    issues,
    onClose,
    onOpenFile,
    onAnalyzeImpact,
    onGetModule,
    onGetEnhancedInfo,
    onGetCallHierarchy,
    onFindReferences,
    onFixWithCopilot,
    onAddToContext,
}: NodeDetailEnhancedProps) {
    const [activeTab, setActiveTab] = useState<TabType>('info');
    const [moduleInfo, setModuleInfo] = useState<ModuleInfo | null>(null);
    const [enhancedInfo, setEnhancedInfo] = useState<EnhancedNodeInfo | null>(null);
    const [impactResult, setImpactResult] = useState<ImpactResult | null>(null);
    const [callHierarchy, setCallHierarchy] = useState<CallHierarchyNode | null>(null);
    const [selectedSymbol, setSelectedSymbol] = useState<LspSymbol | null>(null);
    const [symbolReferences, setSymbolReferences] = useState<LspReference[]>([]);
    const [isLoadingModule, setIsLoadingModule] = useState(false);
    const [isLoadingEnhanced, setIsLoadingEnhanced] = useState(false);
    const [isLoadingImpact, setIsLoadingImpact] = useState(false);
    const [isLoadingCalls, setIsLoadingCalls] = useState(false);
    const [isLoadingRefs, setIsLoadingRefs] = useState(false);

    const nodeIssues = issues.filter(i => i.file === node?.path);

    useEffect(() => {
        if (node) {
            setIsLoadingModule(true);
            setIsLoadingEnhanced(true);
            setModuleInfo(null);
            setEnhancedInfo(null);
            setImpactResult(null);
            setCallHierarchy(null);
            setSelectedSymbol(null);
            setSymbolReferences([]);

            onGetModule(node.path).then(info => {
                setModuleInfo(info);
                setIsLoadingModule(false);
            });

            onGetEnhancedInfo(node.path).then(info => {
                setEnhancedInfo(info);
                setIsLoadingEnhanced(false);
            });
        }
    }, [node, onGetModule, onGetEnhancedInfo]);

    const handleAnalyzeImpact = useCallback(async () => {
        if (!node) return;
        setIsLoadingImpact(true);
        setActiveTab('impact');
        const result = await onAnalyzeImpact(node.path);
        setImpactResult(result);
        setIsLoadingImpact(false);
    }, [node, onAnalyzeImpact]);

    const handleGetCallHierarchy = useCallback(async (symbol: LspSymbol) => {
        if (!node) return;
        setIsLoadingCalls(true);
        setActiveTab('calls');
        setSelectedSymbol(symbol);
        const result = await onGetCallHierarchy(
            node.path,
            symbol.selectionRange.startLine,
            symbol.selectionRange.startColumn
        );
        setCallHierarchy(result);
        setIsLoadingCalls(false);
    }, [node, onGetCallHierarchy]);

    const handleFindReferences = useCallback(async (symbol: LspSymbol) => {
        if (!node) return;
        setIsLoadingRefs(true);
        setSelectedSymbol(symbol);
        const refs = await onFindReferences(
            node.path,
            symbol.selectionRange.startLine,
            symbol.selectionRange.startColumn
        );
        setSymbolReferences(refs);
        setIsLoadingRefs(false);
    }, [node, onFindReferences]);

    if (!node) {
        return (
            <div className={styles.empty}>
                <Icon name="info" />
                <span>Select a node to view details</span>
            </div>
        );
    }

    const lspAvailable = enhancedInfo?.lsp.available ?? false;
    const diagnostics = enhancedInfo?.lsp.diagnostics ?? [];
    const symbols = enhancedInfo?.lsp.symbols ?? [];

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <div className={styles.headerInfo}>
                    <Icon 
                        name={node.isEntrypoint ? 'rocket' : node.isHotspot ? 'flame' : 'file-code'} 
                        className={`${styles.headerIcon} ${node.isEntrypoint ? styles.entrypoint : ''} ${node.isHotspot ? styles.hotspot : ''}`}
                    />
                    <div className={styles.headerText}>
                        <span className={styles.fileName}>{node.name}</span>
                        <span className={styles.filePath}>{node.path}</span>
                    </div>
                </div>
                <div className={styles.headerActions}>
                    {lspAvailable && (
                        <span className={styles.lspBadge} title="LSP active">
                            <Icon name="symbol-misc" />
                            LSP
                        </span>
                    )}
                    <button className={styles.closeBtn} onClick={onClose}>
                        <Icon name="close" />
                    </button>
                </div>
            </div>

            <div className={styles.quickStats}>
                <div className={styles.stat}>
                    <span className={styles.statValue}>{node.importers}</span>
                    <span className={styles.statLabel}>Importers</span>
                </div>
                <div className={styles.stat}>
                    <span className={styles.statValue}>{node.exports}</span>
                    <span className={styles.statLabel}>Exports</span>
                </div>
                <div className={`${styles.stat} ${nodeIssues.length > 0 ? styles.hasIssues : ''}`}>
                    <span className={styles.statValue}>{nodeIssues.length}</span>
                    <span className={styles.statLabel}>Issues</span>
                </div>
                {lspAvailable && (
                    <div className={`${styles.stat} ${diagnostics.length > 0 ? styles.hasDiagnostics : ''}`}>
                        <span className={styles.statValue}>{diagnostics.length}</span>
                        <span className={styles.statLabel}>Diagnostics</span>
                    </div>
                )}
            </div>

            <div className={styles.tabs}>
                <button
                    className={`${styles.tab} ${activeTab === 'info' ? styles.active : ''}`}
                    onClick={() => setActiveTab('info')}
                >
                    <Icon name="info" />
                    Info
                </button>
                {lspAvailable && (
                    <button
                        className={`${styles.tab} ${activeTab === 'symbols' ? styles.active : ''}`}
                        onClick={() => setActiveTab('symbols')}
                    >
                        <Icon name="symbol-class" />
                        Symbols
                        {symbols.length > 0 && <span className={styles.tabBadge}>{symbols.length}</span>}
                    </button>
                )}
                <button
                    className={`${styles.tab} ${activeTab === 'issues' ? styles.active : ''}`}
                    onClick={() => setActiveTab('issues')}
                >
                    <Icon name="warning" />
                    Issues
                    {nodeIssues.length > 0 && <span className={styles.tabBadge}>{nodeIssues.length}</span>}
                </button>
                {lspAvailable && diagnostics.length > 0 && (
                    <button
                        className={`${styles.tab} ${activeTab === 'diagnostics' ? styles.active : ''}`}
                        onClick={() => setActiveTab('diagnostics')}
                    >
                        <Icon name="error" />
                        Diag
                        <span className={styles.tabBadge}>{diagnostics.length}</span>
                    </button>
                )}
                <button
                    className={`${styles.tab} ${activeTab === 'impact' ? styles.active : ''}`}
                    onClick={handleAnalyzeImpact}
                >
                    <Icon name="pulse" />
                    Impact
                </button>
                {lspAvailable && (
                    <button
                        className={`${styles.tab} ${activeTab === 'calls' ? styles.active : ''}`}
                        onClick={() => setActiveTab('calls')}
                    >
                        <Icon name="type-hierarchy" />
                        Calls
                    </button>
                )}
            </div>

            <div className={styles.content}>
                {activeTab === 'info' && (
                    <InfoTab 
                        node={node} 
                        moduleInfo={moduleInfo}
                        enhancedInfo={enhancedInfo}
                        isLoading={isLoadingModule || isLoadingEnhanced}
                        onOpenFile={onOpenFile}
                    />
                )}
                {activeTab === 'symbols' && (
                    <SymbolsTab
                        symbols={symbols}
                        selectedSymbol={selectedSymbol}
                        references={symbolReferences}
                        isLoadingRefs={isLoadingRefs}
                        nodePath={node.path}
                        onSymbolClick={(symbol) => onOpenFile(node.path, symbol.selectionRange.startLine, symbol.selectionRange.startColumn)}
                        onFindReferences={handleFindReferences}
                        onGetCallHierarchy={handleGetCallHierarchy}
                        onOpenFile={onOpenFile}
                    />
                )}
                {activeTab === 'issues' && (
                    <IssuesTab 
                        issues={nodeIssues} 
                        onFixWithCopilot={onFixWithCopilot}
                        onAddToContext={onAddToContext}
                    />
                )}
                {activeTab === 'diagnostics' && (
                    <DiagnosticsTab
                        diagnostics={diagnostics}
                        onOpenFile={(line, col) => onOpenFile(node.path, line, col)}
                    />
                )}
                {activeTab === 'impact' && (
                    <ImpactTab 
                        result={impactResult} 
                        isLoading={isLoadingImpact}
                        onOpenFile={onOpenFile}
                        onAddToContext={onAddToContext}
                    />
                )}
                {activeTab === 'calls' && (
                    <CallsTab
                        hierarchy={callHierarchy}
                        selectedSymbol={selectedSymbol}
                        isLoading={isLoadingCalls}
                        onOpenFile={onOpenFile}
                        onSelectSymbol={handleGetCallHierarchy}
                        symbols={symbols}
                    />
                )}
            </div>

            <div className={styles.actions}>
                <button className={styles.actionBtn} onClick={() => onOpenFile(node.path)}>
                    <Icon name="go-to-file" />
                    Open File
                </button>
                <button 
                    className={`${styles.actionBtn} ${styles.primary}`}
                    onClick={() => onAddToContext('module', { 
                        path: node.path, 
                        ...moduleInfo,
                        lspSymbols: symbols.length,
                        lspDiagnostics: diagnostics.length,
                    })}
                >
                    <Icon name="add" />
                    Add to Context
                </button>
            </div>
        </div>
    );
}


// ============================================
// Info Tab
// ============================================

function InfoTab({ 
    node, 
    moduleInfo: _moduleInfo,
    enhancedInfo,
    isLoading,
    onOpenFile,
}: { 
    node: GraphNode; 
    moduleInfo: ModuleInfo | null;
    enhancedInfo: EnhancedNodeInfo | null;
    isLoading: boolean;
    onOpenFile: (path: string, line?: number, column?: number) => void;
}) {
    // Note: moduleInfo is available for fallback but we prefer enhancedInfo.graph
    void _moduleInfo;
    
    if (isLoading) {
        return (
            <div className={styles.loading}>
                <Spinner size="small" />
                <span>Loading module info...</span>
            </div>
        );
    }

    const graphInfo = enhancedInfo?.graph;

    return (
        <div className={styles.infoTab}>
            <div className={styles.typeBadges}>
                {node.isEntrypoint && (
                    <span className={`${styles.typeBadge} ${styles.entrypoint}`}>
                        <Icon name="rocket" /> Entrypoint
                    </span>
                )}
                {node.isHotspot && (
                    <span className={`${styles.typeBadge} ${styles.hotspot}`}>
                        <Icon name="flame" /> Hotspot
                    </span>
                )}
                {enhancedInfo?.lsp.available && (
                    <span className={`${styles.typeBadge} ${styles.lsp}`}>
                        <Icon name="symbol-misc" /> LSP Active
                    </span>
                )}
            </div>

            {(graphInfo?.imports?.length ?? 0) > 0 && (
                <div className={styles.section}>
                    <div className={styles.sectionHeader}>
                        <Icon name="arrow-right" />
                        <span>Imports ({graphInfo?.imports.length})</span>
                    </div>
                    <ul className={styles.fileList}>
                        {graphInfo?.imports.slice(0, 10).map(imp => (
                            <li key={imp} onClick={() => onOpenFile(imp)}>
                                <Icon name="file" />
                                <span>{imp}</span>
                            </li>
                        ))}
                        {(graphInfo?.imports.length ?? 0) > 10 && (
                            <li className={styles.more}>+{(graphInfo?.imports.length ?? 0) - 10} more</li>
                        )}
                    </ul>
                </div>
            )}

            {(graphInfo?.importedBy?.length ?? 0) > 0 && (
                <div className={styles.section}>
                    <div className={styles.sectionHeader}>
                        <Icon name="arrow-left" />
                        <span>Imported By ({graphInfo?.importedBy.length})</span>
                    </div>
                    <ul className={styles.fileList}>
                        {graphInfo?.importedBy.slice(0, 10).map(dep => (
                            <li key={dep} onClick={() => onOpenFile(dep)}>
                                <Icon name="file" />
                                <span>{dep}</span>
                            </li>
                        ))}
                        {(graphInfo?.importedBy.length ?? 0) > 10 && (
                            <li className={styles.more}>+{(graphInfo?.importedBy.length ?? 0) - 10} more</li>
                        )}
                    </ul>
                </div>
            )}

            {(graphInfo?.exports?.length ?? 0) > 0 && (
                <div className={styles.section}>
                    <div className={styles.sectionHeader}>
                        <Icon name="symbol-method" />
                        <span>Exports ({graphInfo?.exports.length})</span>
                    </div>
                    <ul className={styles.exportList}>
                        {graphInfo?.exports.slice(0, 15).map(exp => (
                            <li key={exp}><code>{exp}</code></li>
                        ))}
                        {(graphInfo?.exports.length ?? 0) > 15 && (
                            <li className={styles.more}>+{(graphInfo?.exports.length ?? 0) - 15} more</li>
                        )}
                    </ul>
                </div>
            )}
        </div>
    );
}

// ============================================
// Symbols Tab (LSP)
// ============================================

function SymbolsTab({
    symbols,
    selectedSymbol,
    references,
    isLoadingRefs,
    nodePath,
    onSymbolClick,
    onFindReferences,
    onGetCallHierarchy,
    onOpenFile,
}: {
    symbols: LspSymbol[];
    selectedSymbol: LspSymbol | null;
    references: LspReference[];
    isLoadingRefs: boolean;
    nodePath: string;
    onSymbolClick: (symbol: LspSymbol) => void;
    onFindReferences: (symbol: LspSymbol) => void;
    onGetCallHierarchy: (symbol: LspSymbol) => void;
    onOpenFile: (path: string, line?: number, column?: number) => void;
}) {
    if (symbols.length === 0) {
        return (
            <div className={styles.emptyTab}>
                <Icon name="symbol-class" />
                <span>No symbols found</span>
            </div>
        );
    }

    const getSymbolIcon = (kind: string): string => {
        const iconMap: Record<string, string> = {
            'class': 'symbol-class',
            'function': 'symbol-method',
            'method': 'symbol-method',
            'property': 'symbol-property',
            'variable': 'symbol-variable',
            'constant': 'symbol-constant',
            'interface': 'symbol-interface',
            'enum': 'symbol-enum',
            'constructor': 'symbol-constructor',
            'field': 'symbol-field',
            'module': 'symbol-namespace',
            'namespace': 'symbol-namespace',
        };
        return iconMap[kind] ?? 'symbol-misc';
    };

    const renderSymbol = (symbol: LspSymbol, depth: number = 0) => {
        const isSelected = selectedSymbol?.name === symbol.name;
        return (
            <div key={`${symbol.name}-${symbol.range.startLine}`}>
                <div 
                    className={`${styles.symbolItem} ${isSelected ? styles.selected : ''}`}
                    style={{ paddingLeft: `${depth * 16 + 8}px` }}
                    onClick={() => onSymbolClick(symbol)}
                >
                    <Icon name={getSymbolIcon(symbol.kind)} className={styles.symbolIcon} />
                    <span className={styles.symbolName}>{symbol.name}</span>
                    <span className={styles.symbolKind}>{symbol.kind}</span>
                    <div className={styles.symbolActions}>
                        <button 
                            className={styles.symbolBtn}
                            onClick={(e) => { e.stopPropagation(); onFindReferences(symbol); }}
                            title="Find References"
                        >
                            <Icon name="references" />
                        </button>
                        {(symbol.kind === 'function' || symbol.kind === 'method') && (
                            <button 
                                className={styles.symbolBtn}
                                onClick={(e) => { e.stopPropagation(); onGetCallHierarchy(symbol); }}
                                title="Call Hierarchy"
                            >
                                <Icon name="type-hierarchy" />
                            </button>
                        )}
                    </div>
                </div>
                {symbol.children?.map(child => renderSymbol(child, depth + 1))}
            </div>
        );
    };

    return (
        <div className={styles.symbolsTab}>
            <div className={styles.symbolList}>
                {symbols.map(symbol => renderSymbol(symbol))}
            </div>
            
            {selectedSymbol && (
                <div className={styles.referencesPanel}>
                    <div className={styles.referencesPanelHeader}>
                        <Icon name="references" />
                        <span>References for {selectedSymbol.name}</span>
                    </div>
                    {isLoadingRefs ? (
                        <div className={styles.loading}>
                            <Spinner size="small" />
                        </div>
                    ) : references.length === 0 ? (
                        <div className={styles.emptyRefs}>No references found</div>
                    ) : (
                        <ul className={styles.referenceList}>
                            {references.map((ref, idx) => (
                                <li 
                                    key={idx}
                                    onClick={() => onOpenFile(ref.path, ref.line, ref.column)}
                                    className={ref.isDefinition ? styles.definition : ''}
                                >
                                    <span className={styles.refPath}>
                                        {ref.path === nodePath ? '(this file)' : ref.path.split('/').pop()}
                                    </span>
                                    <span className={styles.refLine}>:{ref.line}</span>
                                    {ref.isDefinition && <span className={styles.defBadge}>def</span>}
                                    <code className={styles.refText}>{ref.lineText}</code>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            )}
        </div>
    );
}

// ============================================
// Issues Tab
// ============================================

function IssuesTab({ 
    issues,
    onFixWithCopilot,
    onAddToContext,
}: { 
    issues: GraphIssue[];
    onFixWithCopilot: (issue: GraphIssue) => void;
    onAddToContext: (type: string, data: unknown) => void;
}) {
    if (issues.length === 0) {
        return (
            <div className={styles.emptyTab}>
                <Icon name="check-all" />
                <span>No issues in this file</span>
            </div>
        );
    }

    return (
        <div className={styles.issuesTab}>
            {issues.map(issue => (
                <div key={issue.id} className={`${styles.issueCard} ${styles[issue.severity]}`}>
                    <div className={styles.issueHeader}>
                        <Icon name={issue.severity === 'error' ? 'error' : issue.severity === 'warning' ? 'warning' : 'info'} />
                        <span className={styles.issueKind}>{formatIssueKind(issue.kind)}</span>
                    </div>
                    <p className={styles.issueSummary}>{issue.summary}</p>
                    {issue.suggestedFix.length > 0 && (
                        <div className={styles.issueFix}>
                            <Icon name="lightbulb" />
                            <span>{issue.suggestedFix[0]}</span>
                        </div>
                    )}
                    <div className={styles.issueActions}>
                        <button className={styles.issueBtn} onClick={() => onAddToContext('issue', issue)}>
                            <Icon name="add" /> Add to Context
                        </button>
                        <button className={`${styles.issueBtn} ${styles.fixBtn}`} onClick={() => onFixWithCopilot(issue)}>
                            <Icon name="sparkle" /> Fix with Copilot
                        </button>
                    </div>
                </div>
            ))}
        </div>
    );
}

// ============================================
// Diagnostics Tab (LSP)
// ============================================

function DiagnosticsTab({
    diagnostics,
    onOpenFile,
}: {
    diagnostics: LspDiagnostic[];
    onOpenFile: (line: number, column: number) => void;
}) {
    if (diagnostics.length === 0) {
        return (
            <div className={styles.emptyTab}>
                <Icon name="check-all" />
                <span>No diagnostics</span>
            </div>
        );
    }

    const getSeverityIcon = (severity: string): string => {
        switch (severity) {
            case 'error': return 'error';
            case 'warning': return 'warning';
            case 'info': return 'info';
            case 'hint': return 'lightbulb';
            default: return 'info';
        }
    };

    return (
        <div className={styles.diagnosticsTab}>
            {diagnostics.map((diag, idx) => (
                <div 
                    key={idx} 
                    className={`${styles.diagnosticItem} ${styles[diag.severity]}`}
                    onClick={() => onOpenFile(diag.line, diag.column)}
                >
                    <div className={styles.diagnosticHeader}>
                        <Icon name={getSeverityIcon(diag.severity)} />
                        <span className={styles.diagnosticSource}>{diag.source ?? 'Diagnostic'}</span>
                        <span className={styles.diagnosticLocation}>:{diag.line}:{diag.column}</span>
                        {diag.code && <span className={styles.diagnosticCode}>[{diag.code}]</span>}
                    </div>
                    <p className={styles.diagnosticMessage}>{diag.message}</p>
                </div>
            ))}
        </div>
    );
}

// ============================================
// Impact Tab
// ============================================

function ImpactTab({ 
    result, 
    isLoading,
    onOpenFile,
    onAddToContext,
}: { 
    result: ImpactResult | null;
    isLoading: boolean;
    onOpenFile: (path: string, line?: number, column?: number) => void;
    onAddToContext: (type: string, data: unknown) => void;
}) {
    if (isLoading) {
        return (
            <div className={styles.loading}>
                <Spinner size="small" />
                <span>Analyzing impact...</span>
            </div>
        );
    }

    if (!result) {
        return (
            <div className={styles.emptyTab}>
                <Icon name="pulse" />
                <span>Click to analyze impact</span>
            </div>
        );
    }

    const riskColors: Record<string, string> = {
        low: 'var(--success)',
        medium: 'var(--warning)',
        high: 'var(--error)',
        critical: '#d32f2f',
    };

    return (
        <div className={styles.impactTab}>
            <div className={styles.riskLevel} style={{ borderColor: riskColors[result.riskLevel] }}>
                <span className={styles.riskLabel}>Risk Level</span>
                <span className={styles.riskValue} style={{ color: riskColors[result.riskLevel] }}>
                    {result.riskLevel.toUpperCase()}
                </span>
            </div>
            <p className={styles.impactSummary}>{result.summary}</p>
            <div className={styles.section}>
                <div className={styles.sectionHeader}>
                    <Icon name="references" />
                    <span>Affected Files ({result.affectedFiles.length})</span>
                </div>
                <ul className={styles.affectedList}>
                    {result.affectedFiles.slice(0, 15).map(file => (
                        <li key={file.path} onClick={() => onOpenFile(file.path)}>
                            <div className={styles.affectedInfo}>
                                <Icon name={file.isEntrypoint ? 'rocket' : 'file'} />
                                <span className={styles.affectedPath}>{file.path}</span>
                            </div>
                            <span className={styles.affectedDistance}>
                                {file.distance === 1 ? 'Direct' : `${file.distance} hops`}
                            </span>
                        </li>
                    ))}
                    {result.affectedFiles.length > 15 && (
                        <li className={styles.more}>+{result.affectedFiles.length - 15} more</li>
                    )}
                </ul>
            </div>
            <button className={styles.addContextBtn} onClick={() => onAddToContext('impact', result)}>
                <Icon name="add" /> Add Impact Analysis to Context
            </button>
        </div>
    );
}

// ============================================
// Calls Tab (LSP Call Hierarchy)
// ============================================

function CallsTab({
    hierarchy,
    selectedSymbol: _selectedSymbol,
    isLoading,
    onOpenFile,
    onSelectSymbol,
    symbols,
}: {
    hierarchy: CallHierarchyNode | null;
    selectedSymbol: LspSymbol | null;
    isLoading: boolean;
    onOpenFile: (path: string, line?: number, column?: number) => void;
    onSelectSymbol: (symbol: LspSymbol) => void;
    symbols: LspSymbol[];
}) {
    // Note: selectedSymbol available for future use (e.g., highlighting)
    void _selectedSymbol;
    
    if (isLoading) {
        return (
            <div className={styles.loading}>
                <Spinner size="small" />
                <span>Loading call hierarchy...</span>
            </div>
        );
    }

    const callableSymbols = symbols.filter(s => 
        s.kind === 'function' || s.kind === 'method' || s.kind === 'constructor'
    );

    if (!hierarchy && callableSymbols.length === 0) {
        return (
            <div className={styles.emptyTab}>
                <Icon name="type-hierarchy" />
                <span>No callable symbols found</span>
            </div>
        );
    }

    if (!hierarchy) {
        return (
            <div className={styles.callsTab}>
                <p className={styles.callsHint}>Select a function to view its call hierarchy:</p>
                <ul className={styles.callableList}>
                    {callableSymbols.map(symbol => (
                        <li key={`${symbol.name}-${symbol.range.startLine}`} onClick={() => onSelectSymbol(symbol)}>
                            <Icon name="symbol-method" />
                            <span>{symbol.name}</span>
                            <span className={styles.symbolKind}>{symbol.kind}</span>
                        </li>
                    ))}
                </ul>
            </div>
        );
    }

    const renderCallNode = (node: CallHierarchyNode, type: 'caller' | 'callee') => (
        <li 
            key={`${node.path}-${node.line}`}
            onClick={() => onOpenFile(node.path, node.line)}
            className={styles.callNode}
        >
            <Icon name={type === 'caller' ? 'arrow-left' : 'arrow-right'} />
            <span className={styles.callName}>{node.name}</span>
            <span className={styles.callPath}>{node.path.split('/').pop()}:{node.line}</span>
        </li>
    );

    return (
        <div className={styles.callsTab}>
            <div className={styles.callHierarchyRoot}>
                <Icon name="symbol-method" />
                <span className={styles.callRootName}>{hierarchy.name}</span>
                <span className={styles.callRootKind}>{hierarchy.kind}</span>
            </div>

            {hierarchy.callers.length > 0 && (
                <div className={styles.callSection}>
                    <div className={styles.callSectionHeader}>
                        <Icon name="arrow-left" />
                        <span>Callers ({hierarchy.callers.length})</span>
                    </div>
                    <ul className={styles.callList}>
                        {hierarchy.callers.map(caller => renderCallNode(caller, 'caller'))}
                    </ul>
                </div>
            )}

            {hierarchy.callees.length > 0 && (
                <div className={styles.callSection}>
                    <div className={styles.callSectionHeader}>
                        <Icon name="arrow-right" />
                        <span>Callees ({hierarchy.callees.length})</span>
                    </div>
                    <ul className={styles.callList}>
                        {hierarchy.callees.map(callee => renderCallNode(callee, 'callee'))}
                    </ul>
                </div>
            )}

            {hierarchy.callers.length === 0 && hierarchy.callees.length === 0 && (
                <div className={styles.emptyRefs}>No callers or callees found</div>
            )}
        </div>
    );
}

// ============================================
// Helpers
// ============================================

function formatIssueKind(kind: string): string {
    return kind.split('_').map(word => 
        word.charAt(0) + word.slice(1).toLowerCase()
    ).join(' ');
}
