#!/usr/bin/env node
/**
 * Copy dependency-cruiser CLI binary into dist so it ships with the extension bundle.
 * 
 * dependency-cruiser is used for JS/TS dependency analysis.
 * We copy the entire node_modules/dependency-cruiser folder and its .bin scripts
 * so the CLI can be invoked at runtime.
 */

const fs = require('fs');
const path = require('path');

const extensionRoot = path.join(__dirname, '..');
const nodeModules = path.join(extensionRoot, 'node_modules');
const distNodeModules = path.join(extensionRoot, 'dist', 'node_modules');

// Files/folders to copy
const toCopy = [
    // The main dependency-cruiser package
    { src: 'dependency-cruiser', dest: 'dependency-cruiser' },
    // Binary scripts in .bin
    { src: '.bin/depcruise', dest: '.bin/depcruise' },
    { src: '.bin/depcruise.cmd', dest: '.bin/depcruise.cmd' },
    { src: '.bin/depcruise.ps1', dest: '.bin/depcruise.ps1' },
    { src: '.bin/dependency-cruiser', dest: '.bin/dependency-cruiser' },
    { src: '.bin/dependency-cruiser.cmd', dest: '.bin/dependency-cruiser.cmd' },
    { src: '.bin/dependency-cruise', dest: '.bin/dependency-cruise' },
    { src: '.bin/dependency-cruise.cmd', dest: '.bin/dependency-cruise.cmd' },
];

/**
 * Recursively copy a directory
 */
function copyDir(src, dest) {
    fs.mkdirSync(dest, { recursive: true });
    const entries = fs.readdirSync(src, { withFileTypes: true });
    
    for (const entry of entries) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);
        
        if (entry.isDirectory()) {
            copyDir(srcPath, destPath);
        } else if (entry.isSymbolicLink()) {
            // For symlinks, copy the target file content
            const realPath = fs.realpathSync(srcPath);
            if (fs.existsSync(realPath)) {
                fs.copyFileSync(realPath, destPath);
            }
        } else {
            fs.copyFileSync(srcPath, destPath);
        }
    }
}

/**
 * Copy a single file, resolving symlinks
 */
function copyFile(src, dest) {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    
    if (fs.lstatSync(src).isSymbolicLink()) {
        // For symlinks, copy the target file content
        const realPath = fs.realpathSync(src);
        if (fs.existsSync(realPath)) {
            fs.copyFileSync(realPath, dest);
        }
    } else {
        fs.copyFileSync(src, dest);
    }
}

try {
    console.log('Copying dependency-cruiser to dist...');
    
    let copiedCount = 0;
    
    for (const item of toCopy) {
        const srcPath = path.join(nodeModules, item.src);
        const destPath = path.join(distNodeModules, item.dest);
        
        if (!fs.existsSync(srcPath)) {
            console.log(`  Skipping ${item.src} (not found)`);
            continue;
        }
        
        const stat = fs.lstatSync(srcPath);
        
        if (stat.isDirectory()) {
            copyDir(srcPath, destPath);
            console.log(`  Copied directory: ${item.src}`);
        } else {
            copyFile(srcPath, destPath);
            console.log(`  Copied file: ${item.src}`);
        }
        
        copiedCount++;
    }
    
    if (copiedCount === 0) {
        throw new Error('No dependency-cruiser files found to copy');
    }
    
    console.log(`Successfully copied dependency-cruiser (${copiedCount} items)`);
} catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Failed to copy dependency-cruiser: ${message}`);
    process.exit(1);
}
