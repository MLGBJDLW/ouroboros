/**
 * Version Service
 * Checks for prompt updates by comparing local vs remote versions
 */

import * as vscode from 'vscode';
import { createLogger } from './logger';

const logger = createLogger('VersionService');

// GitHub API endpoint for latest release
const GITHUB_API_RELEASE =
    'https://api.github.com/repos/MLGBJDLW/ouroboros/releases/latest';

// Version marker embedded in transformed files
const VERSION_MARKER_REGEX = /Ouroboros v([\d.]+)/;

export interface VersionInfo {
    /** Local version from extension or null if not detectable */
    localVersion: string | null;
    /** Remote version from GitHub */
    remoteVersion: string;
    /** Whether local is outdated compared to remote */
    isOutdated: boolean;
}

/**
 * Get the current extension version from package.json
 */
export function getExtensionVersion(): string {
    // Note: VS Code normalizes publisher to lowercase
    const extension = vscode.extensions.getExtension('mlgbjdlw.ouroboros-ai');
    if (extension) {
        return extension.packageJSON.version;
    }
    // Fallback: read from local package.json during development
    return '0.0.0';
}

/**
 * Fetch the latest release version from GitHub
 */
export async function getRemoteVersion(): Promise<string> {
    try {
        const response = await fetch(GITHUB_API_RELEASE, {
            headers: {
                Accept: 'application/vnd.github.v3+json',
                'User-Agent': 'Ouroboros-VSCode-Extension',
            },
        });

        if (!response.ok) {
            logger.warn(`Failed to fetch remote version: ${response.status}`);
            return '0.0.0';
        }

        const data = (await response.json()) as { tag_name?: string };
        const tagName = data.tag_name || 'v0.0.0';

        // Remove 'v' prefix if present
        const version = tagName.startsWith('v') ? tagName.slice(1) : tagName;
        logger.info(`Remote version: ${version}`);
        return version;
    } catch (error) {
        logger.error('Error fetching remote version:', error);
        return '0.0.0';
    }
}

/**
 * Compare two semantic version strings
 * Returns: 1 if a > b, -1 if a < b, 0 if equal
 */
export function compareVersions(a: string, b: string): number {
    const partsA = a.split('.').map((n) => parseInt(n, 10) || 0);
    const partsB = b.split('.').map((n) => parseInt(n, 10) || 0);

    const maxLen = Math.max(partsA.length, partsB.length);

    for (let i = 0; i < maxLen; i++) {
        const numA = partsA[i] || 0;
        const numB = partsB[i] || 0;

        if (numA > numB) return 1;
        if (numA < numB) return -1;
    }

    return 0;
}

/**
 * Check if prompts need updating
 */
export async function checkPromptsVersion(): Promise<VersionInfo> {
    const localVersion = getExtensionVersion();
    const remoteVersion = await getRemoteVersion();
    const isOutdated = compareVersions(localVersion, remoteVersion) < 0;

    logger.info(
        `Version check: local=${localVersion}, remote=${remoteVersion}, outdated=${isOutdated}`
    );

    return {
        localVersion,
        remoteVersion,
        isOutdated,
    };
}

/**
 * Extract version from a transformed prompt file content
 * Looks for version marker in the extension mode header
 */
export function extractVersionFromContent(content: string): string | null {
    const match = content.match(VERSION_MARKER_REGEX);
    return match ? match[1] : null;
}
