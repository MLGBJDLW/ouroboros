import { useAppContext } from '../context/AppContext';
import type { WorkflowState, PhaseInfo, WorkflowType } from '../types/workflow';

const SPEC_PHASES: Array<{ number: number; name: string }> = [
    { number: 1, name: 'Research' },
    { number: 2, name: 'Requirements' },
    { number: 3, name: 'Design' },
    { number: 4, name: 'Tasks' },
    { number: 5, name: 'Validation' },
];

/**
 * Hook for accessing workflow state
 */
export function useWorkflow(): WorkflowState {
    const { state } = useAppContext();

    const workspaceState = state.workspaceState;
    const workflowType =
        workspaceState?.workflowType ??
        (workspaceState?.currentSpec ? 'spec' : null);
    const currentPhase = workspaceState?.currentPhase ?? 0;
    const totalPhases =
        workspaceState?.totalPhases ??
        (workflowType === 'spec' ? SPEC_PHASES.length : 0);

    const phases = buildPhases(workflowType, currentPhase, totalPhases);

    return {
        type: workflowType,
        specName: workspaceState?.currentSpec ?? null,
        currentPhase,
        totalPhases,
        phases,
        status: workspaceState?.phaseStatus ?? '',
        executionMode: workspaceState?.executionMode ?? 'task-by-task',
    };
}

function buildPhases(
    workflowType: WorkflowType | null,
    currentPhase: number,
    totalPhases: number
): PhaseInfo[] {
    if (!workflowType || totalPhases <= 0) {
        return [];
    }

    if (workflowType === 'spec') {
        return SPEC_PHASES.map((phase) => ({
            number: phase.number,
            name: phase.name,
            status: getPhaseStatus(phase.number, currentPhase),
        }));
    }

    return Array.from({ length: totalPhases }, (_, index) => {
        const number = index + 1;
        return {
            number,
            name: '',
            status: getPhaseStatus(number, currentPhase),
        };
    });
}

function getPhaseStatus(
    phaseNumber: number,
    currentPhase: number
): 'completed' | 'current' | 'pending' {
    if (phaseNumber < currentPhase) return 'completed';
    if (phaseNumber === currentPhase) return 'current';
    return 'pending';
}
