#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports, no-undef */
/**
 * Copy tree-sitter WASM into dist so it ships with the extension bundle.
 */

const fs = require('fs');
const path = require('path');

const extensionRoot = path.join(__dirname, '..');
const wasmCandidates = [
    path.join(extensionRoot, 'node_modules', 'web-tree-sitter', 'tree-sitter.wasm'),
    path.join(extensionRoot, 'node_modules', 'web-tree-sitter', 'web-tree-sitter.wasm'),
    path.join(extensionRoot, 'node_modules', 'web-tree-sitter', 'debug', 'web-tree-sitter.wasm'),
];
const destWasm = path.join(extensionRoot, 'dist', 'tree-sitter.wasm');

try {
    const sourceWasm = wasmCandidates.find((candidate) => fs.existsSync(candidate));
    if (!sourceWasm) {
        throw new Error(`Missing tree-sitter wasm, checked: ${wasmCandidates.join(', ')}`);
    }

    fs.mkdirSync(path.dirname(destWasm), { recursive: true });
    fs.copyFileSync(sourceWasm, destWasm);
    console.log(`Copied tree-sitter.wasm from ${sourceWasm} to ${destWasm}`);
} catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Failed to copy tree-sitter.wasm: ${message}`);
    process.exit(1);
}
