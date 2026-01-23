/**
 * Image compression utility for reducing vision token consumption
 * Compresses images while preserving maximum quality for AI analysis
 */

export interface CompressionOptions {
    /** Maximum dimension (width or height) in pixels. Default: 2048 */
    maxDimension?: number;
    /** JPEG quality (0-1). Default: 0.92 for high quality */
    quality?: number;
    /** Minimum file size to trigger compression (bytes). Default: 100KB */
    minSizeToCompress?: number;
    /** Force output format. If not set, auto-detects best format */
    outputFormat?: 'image/jpeg' | 'image/png' | 'image/webp';
}

const DEFAULT_OPTIONS: Required<CompressionOptions> = {
    maxDimension: 2048,
    quality: 0.92,
    minSizeToCompress: 100 * 1024, // 100KB
    outputFormat: 'image/jpeg',
};

/**
 * Check if an image should be compressed
 * @param file - The image file
 * @param options - Compression options
 * @returns true if compression should be applied
 */
export function shouldCompress(file: File, options: CompressionOptions = {}): boolean {
    const { minSizeToCompress = DEFAULT_OPTIONS.minSizeToCompress } = options;

    // Skip small files
    if (file.size < minSizeToCompress) {
        return false;
    }

    // Only compress supported image types
    const supportedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/bmp', 'image/gif'];
    if (!supportedTypes.includes(file.type)) {
        return false;
    }

    return true;
}

/**
 * Determine the best output format for an image
 * - PNG for images that might have transparency
 * - JPEG for photos (detected by file type or size)
 */
export function getBestOutputFormat(file: File): 'image/jpeg' | 'image/png' | 'image/webp' {
    // Preserve PNG format for potential transparency
    if (file.type === 'image/png') {
        // Large PNGs are likely photos saved as PNG - convert to JPEG
        // Small PNGs might be screenshots/diagrams with transparency - keep as PNG
        return file.size > 500 * 1024 ? 'image/jpeg' : 'image/png';
    }

    // WebP can have transparency too
    if (file.type === 'image/webp') {
        return 'image/webp';
    }

    // Default to JPEG for best compression
    return 'image/jpeg';
}

/**
 * Compress an image file while preserving quality
 * @param file - The image file to compress
 * @param options - Compression options
 * @returns Compressed image as data URL, or original if compression fails/isn't needed
 */
export async function compressImage(
    file: File,
    options: CompressionOptions = {}
): Promise<string> {
    const {
        maxDimension = DEFAULT_OPTIONS.maxDimension,
        quality = DEFAULT_OPTIONS.quality,
        outputFormat,
    } = options;

    // Return original if compression not needed
    if (!shouldCompress(file, options)) {
        return readFileAsDataURL(file);
    }

    try {
        // Load image
        const img = await loadImage(file);

        // Calculate new dimensions (maintain aspect ratio)
        const { width, height } = calculateDimensions(
            img.naturalWidth,
            img.naturalHeight,
            maxDimension
        );

        // Create canvas and draw scaled image
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
            console.warn('[ImageCompression] Canvas context unavailable, using original');
            return readFileAsDataURL(file);
        }

        // Use high-quality rendering
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, width, height);

        // Determine output format
        const format = outputFormat || getBestOutputFormat(file);

        // Convert to data URL with compression
        const compressedDataUrl = canvas.toDataURL(format, quality);

        // Log compression results
        const originalSize = file.size;
        const compressedSize = Math.round((compressedDataUrl.length * 3) / 4); // Approximate base64 decoded size
        const savings = Math.round((1 - compressedSize / originalSize) * 100);

        console.log(
            `[ImageCompression] ${file.name}: ${formatBytes(originalSize)} → ~${formatBytes(compressedSize)} (${savings}% saved)`
        );

        return compressedDataUrl;
    } catch (error) {
        console.warn('[ImageCompression] Compression failed, using original:', error);
        return readFileAsDataURL(file);
    }
}

/**
 * Load an image from a File object
 */
function loadImage(file: File): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        const url = URL.createObjectURL(file);

        img.onload = () => {
            URL.revokeObjectURL(url);
            resolve(img);
        };

        img.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error(`Failed to load image: ${file.name}`));
        };

        img.src = url;
    });
}

/**
 * Calculate new dimensions maintaining aspect ratio
 */
export function calculateDimensions(
    originalWidth: number,
    originalHeight: number,
    maxDimension: number
): { width: number; height: number } {
    // No scaling needed if already smaller
    if (originalWidth <= maxDimension && originalHeight <= maxDimension) {
        return { width: originalWidth, height: originalHeight };
    }

    // Scale by the larger dimension
    const ratio = Math.min(maxDimension / originalWidth, maxDimension / originalHeight);

    return {
        width: Math.round(originalWidth * ratio),
        height: Math.round(originalHeight * ratio),
    };
}

/**
 * Read a file as data URL
 */
function readFileAsDataURL(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error(`Failed to read file: ${file.name}`));
        reader.readAsDataURL(file);
    });
}

/**
 * Format bytes to human readable string
 */
function formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
