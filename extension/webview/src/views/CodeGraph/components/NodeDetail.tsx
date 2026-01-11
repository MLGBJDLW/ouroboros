/**
 * NodeDetail Component
 * Shows detailed information about a selected node
 */

import { useState, useEffect } from 'react';
import { Icon } from '../../../components/Icon';
import { Spinner } from '../../../components/Spinner';
import type { GraphNode, ModuleInfo, ImpactResult, GraphIssue } from '../types';
import styles from './NodeDetail.module.css';

interface NodeDetailProps {
    node: GraphNode | null;
    issues: GraphIssue[];
    onClose: () => void;
    onOpenFile: (path: string) => void;
    onAnalyzeImpact: (path: string) => Promise<ImpactResult | null>;
    onGetModule: (path: string) => Promise<ModuleInfo | null>;
    onFixWithCopilot: (issue: GraphIssue) => void;
    onAddToContext: (type: string, data: unknown) => void;
}

type TabType = 'info' | 'issues' | 'impact';

export function NodeDetail({
    node,
    issues,
    onClose,
    onOpenFile,
    onAnalyzeImpact,
    onGetModule,
    onFixWithCopilot,
    onAddToContext,
}: NodeDetailProps) {
    const [activeTab, setActiveTab] = useState<TabType>('info');
    const [moduleInfo, setModuleInfo] = useState<ModuleInfo | null>(null);
    const [impactResult, setImpactResult] = useState<ImpactResult | null>(null);
    const [isLoadingModule, setIsLoadingModule] = useState(false);
    const [isLoadingImpact, setIsLoadingImpact] = useState(false);

    // Filter issues for this node
    const nodeIssues = issues.filter(i => i.file === node?.path);

    // Load module info when node changes
    useEffect(() => {
        if (node) {
            setIsLoadingModule(true);
            setModuleInfo(null);
            setImpactResult(null);
            onGetModule(node.path).then(info => {
                setModuleInfo(info);
                setIsLoadingModule(false);
            });
        }
    }, [node, onGetModule]);

    // Analyze impact
    const handleAnalyzeImpact = async () => {
        if (!node) return;
        setIsLoadingImpact(true);
        setActiveTab('impact');
        const result = await onAnalyzeImpact(node.path);
        setImpactResult(result);
        setIsLoadingImpact(false);
    };

    if (!node) {
        return (
            <div className={styles.empty}>
                <Icon name="info" />
                <span>Select a node to view details</span>
            </div>
        );
    }

    return (
        <div className={styles.container}>
            {/* Header */}
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
                <button className={styles.closeBtn} onClick={onClose}>
                    <Icon name="close" />
                </button>
            </div>

            {/* Quick Stats */}
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
            </div>

            {/* Tabs */}
            <div className={styles.tabs}>
                <button
                    className={`${styles.tab} ${activeTab === 'info' ? styles.active : ''}`}
                    onClick={() => setActiveTab('info')}
                >
                    <Icon name="info" />
                    Info
                </button>
                <button
                    className={`${styles.tab} ${activeTab === 'issues' ? styles.active : ''}`}
                    onClick={() => setActiveTab('issues')}
                >
                    <Icon name="warning" />
                    Issues
                    {nodeIssues.length > 0 && (
                        <span className={styles.tabBadge}>{nodeIssues.length}</span>
                    )}
                </button>
                <button
                    className={`${styles.tab} ${activeTab === 'impact' ? styles.active : ''}`}
                    onClick={handleAnalyzeImpact}
                >
                    <Icon name="pulse" />
                    Impact
                </button>
            </div>

            {/* Content */}
            <div className={styles.content}>
                {activeTab === 'info' && (
                    <InfoTab 
                        node={node} 
                        moduleInfo={moduleInfo} 
                        isLoading={isLoadingModule}
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
                {activeTab === 'impact' && (
                    <ImpactTab 
                        result={impactResult} 
                        isLoading={isLoadingImpact}
                        onOpenFile={onOpenFile}
                        onAddToContext={onAddToContext}
                    />
                )}
            </div>

            {/* Actions */}
            <div className={styles.actions}>
                <button 
                    className={styles.actionBtn}
                    onClick={() => onOpenFile(node.path)}
                >
                    <Icon name="go-to-file" />
                    Open File
                </button>
                <button 
                    className={`${styles.actionBtn} ${styles.primary}`}
                    onClick={() => onAddToContext('module', { path: node.path, ...moduleInfo })}
                >
                    <Icon name="add" />
                    Add to Context
                </button>
            </div>
        </div>
    );
}

// Info Tab
function InfoTab({ 
    node, 
    moduleInfo, 
    isLoading,
    onOpenFile,
}: { 
    node: GraphNode; 
    moduleInfo: ModuleInfo | null;
    isLoading: boolean;
    onOpenFile: (path: string) => void;
}) {
    if (isLoading) {
        return (
            <div className={styles.loading}>
                <Spinner size="small" />
                <span>Loading module info...</span>
            </div>
        );
    }

    return (
        <div className={styles.infoTab}>
            {/* Type badges */}
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
            </div>

            {/* Imports */}
            {moduleInfo?.imports && moduleInfo.imports.length > 0 && (
                <div className={styles.section}>
                    <div className={styles.sectionHeader}>
                        <Icon name="arrow-right" />
                        <span>Imports ({moduleInfo.imports.length})</span>
                    </div>
                    <ul className={styles.fileList}>
                        {moduleInfo.imports.slice(0, 10).map(imp => (
                            <li key={imp} onClick={() => onOpenFile(imp)}>
                                <Icon name="file" />
                                <span>{imp}</span>
                            </li>
                        ))}
                        {moduleInfo.imports.length > 10 && (
                            <li className={styles.more}>+{moduleInfo.imports.length - 10} more</li>
                        )}
                    </ul>
                </div>
            )}

            {/* Dependents */}
            {moduleInfo?.dependents && moduleInfo.dependents.length > 0 && (
                <div className={styles.section}>
                    <div className={styles.sectionHeader}>
                        <Icon name="arrow-left" />
                        <span>Dependents ({moduleInfo.dependents.length})</span>
                    </div>
                    <ul className={styles.fileList}>
                        {moduleInfo.dependents.slice(0, 10).map(dep => (
                            <li key={dep} onClick={() => onOpenFile(dep)}>
                                <Icon name="file" />
                                <span>{dep}</span>
                            </li>
                        ))}
                        {moduleInfo.dependents.length > 10 && (
                            <li className={styles.more}>+{moduleInfo.dependents.length - 10} more</li>
                        )}
                    </ul>
                </div>
            )}

            {/* Exports */}
            {moduleInfo?.exports && moduleInfo.exports.length > 0 && (
                <div className={styles.section}>
                    <div className={styles.sectionHeader}>
                        <Icon name="symbol-method" />
                        <span>Exports ({moduleInfo.exports.length})</span>
                    </div>
                    <ul className={styles.exportList}>
                        {moduleInfo.exports.slice(0, 15).map(exp => (
                            <li key={exp}>
                                <code>{exp}</code>
                            </li>
                        ))}
                        {moduleInfo.exports.length > 15 && (
                            <li className={styles.more}>+{moduleInfo.exports.length - 15} more</li>
                        )}
                    </ul>
                </div>
            )}
        </div>
    );
}

// Issues Tab
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
                        <button 
                            className={styles.issueBtn}
                            onClick={() => onAddToContext('issue', issue)}
                        >
                            <Icon name="add" />
                            Add to Context
                        </button>
                        <button 
                            className={`${styles.issueBtn} ${styles.fixBtn}`}
                            onClick={() => onFixWithCopilot(issue)}
                        >
                            <Icon name="sparkle" />
                            Fix with Copilot
                        </button>
                    </div>
                </div>
            ))}
        </div>
    );
}

// Impact Tab
function ImpactTab({ 
    result, 
    isLoading,
    onOpenFile,
    onAddToContext,
}: { 
    result: ImpactResult | null;
    isLoading: boolean;
    onOpenFile: (path: string) => void;
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

    const riskColors = {
        low: 'var(--success)',
        medium: 'var(--warning)',
        high: 'var(--error)',
        critical: '#d32f2f',
    };

    return (
        <div className={styles.impactTab}>
            {/* Risk Level */}
            <div className={styles.riskLevel} style={{ borderColor: riskColors[result.riskLevel] }}>
                <span className={styles.riskLabel}>Risk Level</span>
                <span className={styles.riskValue} style={{ color: riskColors[result.riskLevel] }}>
                    {result.riskLevel.toUpperCase()}
                </span>
            </div>

            {/* Summary */}
            <p className={styles.impactSummary}>{result.summary}</p>

            {/* Affected Files */}
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

            {/* Add to context */}
            <button 
                className={styles.addContextBtn}
                onClick={() => onAddToContext('impact', result)}
            >
                <Icon name="add" />
                Add Impact Analysis to Context
            </button>
        </div>
    );
}

// Helper: Format issue kind
function formatIssueKind(kind: string): string {
    return kind.split('_').map(word => 
        word.charAt(0) + word.slice(1).toLowerCase()
    ).join(' ');
}
