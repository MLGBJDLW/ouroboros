/**
 * Redesigned WorkflowProgress component
 * Reads spec data from .ouroboros/specs folder
 */

import { useSpecs } from '../../hooks/useSpecs';
import { Card, CardHeader, CardBody } from '../../components/Card';
import { ProgressBar } from '../../components/ProgressBar';
import { Icon } from '../../components/Icon';
import { EmptyState } from '../../components/EmptyState';
import type { SpecInfo, SpecPhase } from '../../types/specs';
import { truncate } from '../../utils/formatters';
import styles from './WorkflowProgress.module.css';

export function WorkflowProgress() {
    const { activeSpecs, archivedSpecs, isLoading } = useSpecs();

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

    return (
        <div className={styles.container}>
            {/* Active Specs Section */}
            <section className={styles.section}>
                <h2 className={styles.sectionTitle}>
                    <Icon name="play-circle" />
                    <span>Active Specs</span>
                    {activeSpecs.length > 0 && (
                        <span className={styles.badge}>{activeSpecs.length}</span>
                    )}
                </h2>
                {activeSpecs.length === 0 ? (
                    <div className={styles.emptySection}>
                        <span>No active workflows</span>
                    </div>
                ) : (
                    <div className={styles.specList}>
                        {activeSpecs.map((spec) => (
                            <ActiveSpecCard key={spec.path} spec={spec} />
                        ))}
                    </div>
                )}
            </section>

            {/* Archived Specs Section */}
            {archivedSpecs.length > 0 && (
                <section className={styles.section}>
                    <h2 className={styles.sectionTitle}>
                        <Icon name="archive" />
                        <span>Recent Archives</span>
                    </h2>
                    <div className={styles.archivedList}>
                        {archivedSpecs.slice(0, 5).map((spec) => (
                            <ArchivedSpecCard key={spec.path} spec={spec} />
                        ))}
                    </div>
                </section>
            )}
        </div>
    );
}

interface SpecCardProps {
    spec: SpecInfo;
}

function ActiveSpecCard({ spec }: SpecCardProps) {
    const specName = truncate(spec.name, 24);
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
                        {specName}
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
    const specName = truncate(spec.name, 20);
    const date = new Date(spec.modifiedAt).toLocaleDateString();

    return (
        <div className={styles.archivedCard}>
            <div className={styles.archivedInfo}>
                <Icon name="archive" className={styles.archivedIcon} />
                <span className={styles.archivedName} title={spec.name}>
                    {specName}
                </span>
            </div>
            <div className={styles.archivedMeta}>
                <span className={styles.archivedDate}>{date}</span>
                <span className={styles.completeBadge}>100%</span>
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
