/**
 * Redesigned WorkflowProgress component
 * Reads spec data from .ouroboros/specs folder
 * Layout: Archived on top (collapsible), Active on bottom (selectable)
 */

import { useState } from 'react';
import { useSpecs } from '../../hooks/useSpecs';
import { Card, CardHeader, CardBody } from '../../components/Card';
import { ProgressBar } from '../../components/ProgressBar';
import { Icon } from '../../components/Icon';
import { EmptyState } from '../../components/EmptyState';
import type { SpecInfo, SpecPhase } from '../../types/specs';
import { truncate } from '../../utils/formatters';
import styles from './WorkflowProgress.module.css';

const ARCHIVED_PREVIEW_COUNT = 3;

export function WorkflowProgress() {
    const { activeSpecs, archivedSpecs, isLoading } = useSpecs();
    const [showAllArchived, setShowAllArchived] = useState(false);
    const [selectedSpecPath, setSelectedSpecPath] = useState<string | null>(null);

    if (isLoading) {
        return (
            <div className={styles.loading}>
                <Icon name="sync" className={styles.spinIcon} />
                <span>Scanning specs...</span>
            </div>
        );
    }

    const hasAnySpecs = activeSpecs.length > 0 || archivedSpecs.length > 0;

    if (!hasAnySpecs) {
        return (
            <EmptyState
                icon="folder"
                title="No specs yet"
                description="Create a spec workflow to get started"
            />
        );
    }

    // Get selected spec for detail view
    const selectedSpec = selectedSpecPath
        ? activeSpecs.find(s => s.path === selectedSpecPath)
        : activeSpecs[0];

    // Archived specs to display
    const displayedArchived = showAllArchived
        ? archivedSpecs
        : archivedSpecs.slice(0, ARCHIVED_PREVIEW_COUNT);
    const hasMoreArchived = archivedSpecs.length > ARCHIVED_PREVIEW_COUNT;

    return (
        <div className={styles.container}>
            {/* Archived Specs Section - Top */}
            <section className={styles.section}>
                <h2 className={styles.sectionTitle}>
                    <Icon name="archive" />
                    <span>Archived</span>
                    {archivedSpecs.length > 0 && (
                        <span className={styles.badge}>{archivedSpecs.length}</span>
                    )}
                </h2>
                {archivedSpecs.length === 0 ? (
                    <div className={styles.emptySection}>
                        <span>No archived specs</span>
                    </div>
                ) : (
                    <>
                        <div className={styles.archivedList}>
                            {displayedArchived.map((spec) => (
                                <ArchivedSpecCard key={spec.path} spec={spec} />
                            ))}
                        </div>
                        {hasMoreArchived && (
                            <button
                                className={styles.showMoreBtn}
                                onClick={() => setShowAllArchived(!showAllArchived)}
                            >
                                <Icon name={showAllArchived ? 'chevron-up' : 'chevron-down'} />
                                <span>
                                    {showAllArchived
                                        ? 'Show less'
                                        : `Show ${archivedSpecs.length - ARCHIVED_PREVIEW_COUNT} more`}
                                </span>
                            </button>
                        )}
                    </>
                )}
            </section>

            {/* Divider */}
            <div className={styles.divider} />

            {/* Active Specs Section - Bottom */}
            <section className={styles.section}>
                <h2 className={styles.sectionTitle}>
                    <Icon name="play-circle" />
                    <span>Active Workflows</span>
                    {activeSpecs.length > 0 && (
                        <span className={`${styles.badge} ${styles.activeBadge}`}>
                            {activeSpecs.length}
                        </span>
                    )}
                </h2>
                {activeSpecs.length === 0 ? (
                    <div className={styles.emptySection}>
                        <Icon name="inbox" className={styles.emptyIcon} />
                        <span>No active workflows</span>
                        <span className={styles.emptyHint}>
                            Start a new spec or implement workflow
                        </span>
                    </div>
                ) : (
                    <div className={styles.activeSection}>
                        {/* Spec Selector - if multiple active specs */}
                        {activeSpecs.length > 1 && (
                            <div className={styles.specSelector}>
                                {activeSpecs.map((spec) => (
                                    <button
                                        key={spec.path}
                                        className={`${styles.specTab} ${
                                            spec.path === selectedSpec?.path ? styles.selected : ''
                                        }`}
                                        onClick={() => setSelectedSpecPath(spec.path)}
                                        title={spec.name}
                                    >
                                        <Icon name={spec.type === 'spec' ? 'checklist' : 'gear'} />
                                        <span>{truncate(spec.name, 16)}</span>
                                    </button>
                                ))}
                            </div>
                        )}

                        {/* Selected Spec Detail */}
                        {selectedSpec && <ActiveSpecCard spec={selectedSpec} />}
                    </div>
                )}
            </section>
        </div>
    );
}

interface SpecCardProps {
    spec: SpecInfo;
}

function ActiveSpecCard({ spec }: SpecCardProps) {
    const typeIcon = spec.type === 'spec' ? 'checklist' : 'gear';
    const typeLabel = spec.type.toUpperCase();

    return (
        <Card className={styles.activeCard}>
            <CardHeader>
                <div className={styles.cardHeader}>
                    <div className={styles.typeLabel}>
                        <Icon name={typeIcon} />
                        <span>{typeLabel}</span>
                    </div>
                    <span className={styles.specName} title={spec.name}>
                        {spec.name}
                    </span>
                </div>
            </CardHeader>
            <CardBody>
                <div className={styles.progressSection}>
                    <ProgressBar value={spec.progress} showLabel />
                </div>

                {/* Phase Timeline */}
                <PhaseTimeline phases={spec.phases} />

                {/* Task Summary */}
                {spec.taskSummary && spec.taskSummary.total > 0 && (
                    <div className={styles.taskSummary}>
                        <Icon name="tasklist" />
                        <span>
                            {spec.taskSummary.completed}/{spec.taskSummary.total} tasks
                        </span>
                        {spec.taskSummary.inProgress > 0 && (
                            <span className={styles.inProgress}>
                                ({spec.taskSummary.inProgress} in progress)
                            </span>
                        )}
                    </div>
                )}
            </CardBody>
        </Card>
    );
}

function ArchivedSpecCard({ spec }: SpecCardProps) {
    const specName = truncate(spec.name, 24);
    const date = new Date(spec.modifiedAt).toLocaleDateString();
    const typeIcon = spec.type === 'spec' ? 'checklist' : 'gear';

    return (
        <div className={styles.archivedCard}>
            <div className={styles.archivedInfo}>
                <Icon name={typeIcon} className={styles.archivedIcon} />
                <span className={styles.archivedName} title={spec.name}>
                    {specName}
                </span>
            </div>
            <div className={styles.archivedMeta}>
                <span className={styles.archivedDate}>{date}</span>
                <span className={styles.completeBadge}>
                    <Icon name="check" />
                </span>
            </div>
        </div>
    );
}

// Phase icons as SVG paths
const PHASE_ICONS: Record<string, string> = {
    Research: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 17h-2v-2h2v2zm2.07-7.75l-.9.92C13.45 12.9 13 13.5 13 15h-2v-.5c0-1.1.45-2.1 1.17-2.83l1.24-1.26c.37-.36.59-.86.59-1.41 0-1.1-.9-2-2-2s-2 .9-2 2H8c0-2.21 1.79-4 4-4s4 1.79 4 4c0 .88-.36 1.68-.93 2.25z',
    Requirements: 'M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z',
    Design: 'M12 3c-4.97 0-9 4.03-9 9s4.03 9 9 9c.83 0 1.5-.67 1.5-1.5 0-.39-.15-.74-.39-1.01-.23-.26-.38-.61-.38-.99 0-.83.67-1.5 1.5-1.5H16c2.76 0 5-2.24 5-5 0-4.42-4.03-8-9-8zm-5.5 9c-.83 0-1.5-.67-1.5-1.5S5.67 9 6.5 9 8 9.67 8 10.5 7.33 12 6.5 12zm3-4C8.67 8 8 7.33 8 6.5S8.67 5 9.5 5s1.5.67 1.5 1.5S10.33 8 9.5 8zm5 0c-.83 0-1.5-.67-1.5-1.5S13.67 5 14.5 5s1.5.67 1.5 1.5S15.33 8 14.5 8zm3 4c-.83 0-1.5-.67-1.5-1.5S16.67 9 17.5 9s1.5.67 1.5 1.5-.67 1.5-1.5 1.5z',
    Tasks: 'M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-9 14l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z',
    Validation: 'M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm-2 16l-4-4 1.41-1.41L10 14.17l6.59-6.59L18 9l-8 8z',
};

interface PhaseTimelineProps {
    phases: SpecPhase[];
}

function PhaseTimeline({ phases }: PhaseTimelineProps) {
    return (
        <div className={styles.timeline}>
            {phases.map((phase, index) => (
                <div key={phase.name} className={styles.timelineItem}>
                    {/* Connector line */}
                    {index > 0 && (
                        <div
                            className={`${styles.connector} ${
                                phases[index - 1].status === 'completed' ? styles.connectorCompleted : ''
                            }`}
                        />
                    )}
                    
                    {/* Phase node */}
                    <div
                        className={`${styles.phaseNode} ${styles[phase.status]}`}
                        title={`${phase.name}: ${phase.status}`}
                    >
                        <svg viewBox="0 0 24 24" className={styles.phaseSvg}>
                            {phase.status === 'completed' && (
                                <circle cx="12" cy="12" r="11" className={styles.completedRing} />
                            )}
                            {phase.status === 'current' && (
                                <>
                                    <circle cx="12" cy="12" r="11" className={styles.currentRing} />
                                    <circle cx="12" cy="12" r="11" className={styles.pulseRing} />
                                </>
                            )}
                            <path d={PHASE_ICONS[phase.name]} className={styles.phaseIconPath} />
                        </svg>
                    </div>
                    
                    {/* Phase label */}
                    <span className={`${styles.phaseLabel} ${styles[phase.status]}`}>
                        {phase.name}
                    </span>
                </div>
            ))}
        </div>
    );
}
