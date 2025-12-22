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

                {/* Phase Indicators */}
                <div className={styles.phaseIndicators}>
                    {spec.phases.map((phase) => (
                        <PhaseCircle key={phase.name} phase={phase} />
                    ))}
                </div>

                {/* Phase Legend */}
                <div className={styles.phaseLegend}>
                    {spec.phases.map((phase) => (
                        <span
                            key={phase.name}
                            className={`${styles.phaseLabel} ${styles[phase.status]}`}
                        >
                            {phase.name.charAt(0)}
                        </span>
                    ))}
                </div>

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

interface PhaseCircleProps {
    phase: SpecPhase;
}

function PhaseCircle({ phase }: PhaseCircleProps) {
    const getIcon = () => {
        switch (phase.status) {
            case 'completed':
                return 'check';
            case 'current':
                return 'sync';
            case 'pending':
                return 'circle-outline';
        }
    };

    return (
        <div
            className={`${styles.phaseCircle} ${styles[phase.status]}`}
            title={`${phase.name}: ${phase.status}`}
        >
            <Icon name={getIcon()} className={styles.phaseIcon} />
        </div>
    );
}
