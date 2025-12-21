#!/usr/bin/env node
/**
 * Build script for webview
 * Builds the React webview and copies output to extension directory
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const webviewDir = path.join(__dirname, '..', 'webview');
const webviewDist = path.join(webviewDir, 'dist');

console.log('Building webview...');

try {
    // Install dependencies if needed
    if (!fs.existsSync(path.join(webviewDir, 'node_modules'))) {
        console.log('Installing webview dependencies...');
        execSync('npm install', { cwd: webviewDir, stdio: 'inherit' });
    }

    // Build webview
    execSync('npm run build', { cwd: webviewDir, stdio: 'inherit' });

    // Verify build output
    if (!fs.existsSync(webviewDist)) {
        throw new Error('Webview build output not found');
    }

    const assets = fs.readdirSync(path.join(webviewDist, 'assets'));
    console.log('Build output:', assets);
    console.log('Webview build complete!');
} catch (error) {
    console.error('Failed to build webview:', error.message);
    process.exit(1);
}
