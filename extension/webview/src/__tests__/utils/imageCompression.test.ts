/**
 * Tests for imageCompression utility
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
    shouldCompress,
    getBestOutputFormat,
    calculateDimensions,
    compressImage,
} from '../../utils/imageCompression';

describe('imageCompression', () => {
    describe('shouldCompress', () => {
        it('should return false for small files', () => {
            const file = new File(['small'], 'small.jpg', { type: 'image/jpeg' });
            Object.defineProperty(file, 'size', { value: 50 * 1024 }); // 50KB
            expect(shouldCompress(file)).toBe(false);
        });

        it('should return true for large JPEG files', () => {
            const file = new File(['large'], 'large.jpg', { type: 'image/jpeg' });
            Object.defineProperty(file, 'size', { value: 200 * 1024 }); // 200KB
            expect(shouldCompress(file)).toBe(true);
        });

        it('should return true for large PNG files', () => {
            const file = new File(['large'], 'large.png', { type: 'image/png' });
            Object.defineProperty(file, 'size', { value: 500 * 1024 }); // 500KB
            expect(shouldCompress(file)).toBe(true);
        });

        it('should return false for unsupported types', () => {
            const file = new File(['content'], 'doc.pdf', { type: 'application/pdf' });
            Object.defineProperty(file, 'size', { value: 500 * 1024 });
            expect(shouldCompress(file)).toBe(false);
        });

        it('should respect custom minSizeToCompress', () => {
            const file = new File(['medium'], 'medium.jpg', { type: 'image/jpeg' });
            Object.defineProperty(file, 'size', { value: 150 * 1024 }); // 150KB
            expect(shouldCompress(file, { minSizeToCompress: 200 * 1024 })).toBe(false);
            expect(shouldCompress(file, { minSizeToCompress: 100 * 1024 })).toBe(true);
        });
    });

    describe('getBestOutputFormat', () => {
        it('should return JPEG for JPEG files', () => {
            const file = new File([''], 'photo.jpg', { type: 'image/jpeg' });
            expect(getBestOutputFormat(file)).toBe('image/jpeg');
        });

        it('should return PNG for small PNG files (preserve transparency)', () => {
            const file = new File([''], 'icon.png', { type: 'image/png' });
            Object.defineProperty(file, 'size', { value: 100 * 1024 }); // 100KB
            expect(getBestOutputFormat(file)).toBe('image/png');
        });

        it('should return JPEG for large PNG files (likely photos)', () => {
            const file = new File([''], 'photo.png', { type: 'image/png' });
            Object.defineProperty(file, 'size', { value: 600 * 1024 }); // 600KB
            expect(getBestOutputFormat(file)).toBe('image/jpeg');
        });

        it('should return WebP for WebP files', () => {
            const file = new File([''], 'image.webp', { type: 'image/webp' });
            expect(getBestOutputFormat(file)).toBe('image/webp');
        });
    });

    describe('calculateDimensions', () => {
        it('should not scale images within limits', () => {
            const result = calculateDimensions(800, 600, 2048);
            expect(result).toEqual({ width: 800, height: 600 });
        });

        it('should scale down wide images', () => {
            const result = calculateDimensions(4000, 2000, 2048);
            expect(result.width).toBe(2048);
            expect(result.height).toBe(1024);
        });

        it('should scale down tall images', () => {
            const result = calculateDimensions(1500, 3000, 2048);
            expect(result.width).toBe(1024);
            expect(result.height).toBe(2048);
        });

        it('should maintain aspect ratio', () => {
            const result = calculateDimensions(3840, 2160, 1920);
            expect(result.width).toBe(1920);
            expect(result.height).toBe(1080);
        });

        it('should handle square images', () => {
            const result = calculateDimensions(4000, 4000, 2048);
            expect(result.width).toBe(2048);
            expect(result.height).toBe(2048);
        });
    });

    describe('compressImage', () => {
        let mockCanvas: HTMLCanvasElement;
        let mockContext: CanvasRenderingContext2D;
        let mockImage: HTMLImageElement;
        let originalCreateElement: typeof document.createElement;
        let originalURL: typeof URL;

        beforeEach(() => {
            // Mock canvas
            mockContext = {
                drawImage: vi.fn(),
                imageSmoothingEnabled: true,
                imageSmoothingQuality: 'high',
            } as unknown as CanvasRenderingContext2D;

            mockCanvas = {
                width: 0,
                height: 0,
                getContext: vi.fn().mockReturnValue(mockContext),
                toDataURL: vi.fn().mockReturnValue('data:image/jpeg;base64,compressed'),
            } as unknown as HTMLCanvasElement;

            // Mock image
            mockImage = new Image();
            Object.defineProperty(mockImage, 'naturalWidth', { value: 4000 });
            Object.defineProperty(mockImage, 'naturalHeight', { value: 3000 });

            // Mock document.createElement
            originalCreateElement = document.createElement.bind(document);
            document.createElement = vi.fn((tagName: string) => {
                if (tagName === 'canvas') return mockCanvas;
                return originalCreateElement(tagName);
            });

            // Mock URL
            originalURL = globalThis.URL;
            globalThis.URL = {
                ...originalURL,
                createObjectURL: vi.fn().mockReturnValue('blob:mock-url'),
                revokeObjectURL: vi.fn(),
            } as unknown as typeof URL;
        });

        afterEach(() => {
            document.createElement = originalCreateElement;
            globalThis.URL = originalURL;
            vi.restoreAllMocks();
        });

        it('should return original data URL for small files', async () => {
            const smallContent = 'small image content';
            const file = new File([smallContent], 'small.jpg', { type: 'image/jpeg' });
            Object.defineProperty(file, 'size', { value: 50 * 1024 }); // 50KB

            const result = await compressImage(file);
            // Should return base64 data URL (not compressed)
            expect(result.startsWith('data:')).toBe(true);
        });

        it('should return original for unsupported file types', async () => {
            const file = new File(['content'], 'doc.txt', { type: 'text/plain' });
            Object.defineProperty(file, 'size', { value: 200 * 1024 });

            const result = await compressImage(file);
            expect(result.startsWith('data:')).toBe(true);
        });
    });
});
