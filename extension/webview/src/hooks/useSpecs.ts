/**
 * Hook for accessing specs data from file system
 */

import { useAppContext } from '../context/AppContext';
import type { SpecInfo } from '../types/specs';

export interface UseSpecsResult {
    activeSpecs: SpecInfo[];
    archivedSpecs: SpecInfo[];
    isLoading: boolean;
}

/**
 * Hook for accessing file-based specs data
 */
export function useSpecs(): UseSpecsResult {
    const { state } = useAppContext();

    const workspaceState = state.workspaceState;

    return {
        activeSpecs: workspaceState?.activeSpecs ?? [],
        archivedSpecs: workspaceState?.archivedSpecs ?? [],
        isLoading: state.isLoading,
    };
}
