import { useCallback, type ChangeEvent } from 'react';
import { useWorkflow } from '../../hooks/useWorkflow';
import { Card, CardHeader, CardBody } from '../../components/Card';
import { ProgressBar } from '../../components/ProgressBar';
import { Icon } from '../../components/Icon';
import { EmptyState } from '../../components/EmptyState';
import { useVSCode } from '../../context/VSCodeContext';
import type { ExecutionMode, PhaseInfo } from '../../types/workflow';
import { truncate } from '../../utils/formatters';
import styles from './WorkflowProgress.module.css';

export function WorkflowProgress() {
    const workflow = useWorkflow();
    const vscode = useVSCode();

    if (!workflow.type || !workflow.specName) {
        return (
            <EmptyState
                icon="pulse"
                title="No active workflow"
                description="Start a spec or implement workflow"
            />
        );
    }

    const progress =
        workflow.totalPhases > 0
            ? (workflow.currentPhase / workflow.totalPhases) * 100
            : 0;
    const specName = truncate(workflow.specName, 32);

    const handleExecutionModeChange = useCallback(
        (event: ChangeEvent<HTMLSelectElement>) => {
            const mode = event.target.value as ExecutionMode;
            vscode.postMessage({
                type: 'updateExecutionMode',
                payload: { mode },
            });
        },
        [vscode]
    );

    return (
        <div className={styles.container}>
            <Card>
                <CardHeader>
                    <div className={styles.header}>
                        <Icon
                            name={workflow.type === 'spec' ? 'checklist' : 'gear'}
                        />
                        <span className={styles.workflowType}>
                            {workflow.type?.toUpperCase()}
                        </span>
                        <span
                            className={styles.specName}
                            title={workflow.specName}
                        >
                            {specName}
                        </span>
                    </div>
                </CardHeader>
                <CardBody>
                    <div className={styles.progressSection}>
                        <ProgressBar value={progress} showLabel />
                    </div>

                    {workflow.status && (
                        <div className={styles.statusText}>{workflow.status}</div>
                    )}

                    {workflow.phases.length > 0 && (
                        <div className={styles.phases}>
                            {workflow.phases.map((phase) => (
                                <PhaseItem key={phase.number} phase={phase} />
                            ))}
                        </div>
                    )}

                    <div className={styles.modeSection}>
                        <span className={styles.modeLabel}>Mode:</span>
                        <select
                            className={styles.modeSelect}
                            value={workflow.executionMode}
                            onChange={handleExecutionModeChange}
                        >
                            <option value="task-by-task">Task-by-Task</option>
                            <option value="phase-by-phase">Phase-by-Phase</option>
                            <option value="auto-run">Auto-Run</option>
                        </select>
                    </div>
                </CardBody>
            </Card>
        </div>
    );
}

interface PhaseItemProps {
    phase: PhaseInfo;
}

function PhaseItem({ phase }: PhaseItemProps) {
    const statusIcon = getStatusIcon(phase.status);

    return (
        <div className={`${styles.phase} ${styles[phase.status]}`}>
            <Icon name={statusIcon} className={styles.statusIcon} />
            <span className={styles.phaseName}>
                {getPhaseLabel(phase)}
            </span>
        </div>
    );
}

function getPhaseLabel(phase: PhaseInfo): string {
    if (!phase.name) {
        return `Phase ${phase.number}`;
    }
    return `Phase ${phase.number}: ${phase.name}`;
}

function getStatusIcon(status: PhaseInfo['status']): string {
    switch (status) {
        case 'completed':
            return 'check';
        case 'current':
            return 'sync';
        case 'pending':
            return 'circle-outline';
    }
}
