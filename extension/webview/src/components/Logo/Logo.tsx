// Simplified Ouroboros Logo SVG Component
// Based on the main icon but optimized for small display

interface LogoProps {
    size?: number;
    className?: string;
}

export function Logo({ size = 64, className }: LogoProps) {
    const logoSrc = typeof window !== 'undefined' ? window.logoUri : undefined;

    if (logoSrc) {
        return (
            <img
                src={logoSrc}
                width={size}
                height={size}
                className={className}
                alt="Ouroboros Logo"
                aria-label="Ouroboros Logo"
                draggable={false}
            />
        );
    }

    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 128 128"
            className={className}
            aria-label="Ouroboros Logo"
        >
            <defs>
                <linearGradient id="ouroGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#2196F3" />
                    <stop offset="50%" stopColor="#9C27B0" />
                    <stop offset="100%" stopColor="#00BCD4" />
                </linearGradient>
            </defs>
            {/* Infinity symbol / Ouroboros */}
            <path
                d="M32 64c0-12 8-22 20-22s18 8 22 14c4-6 10-14 22-14s20 10 20 22-8 22-20 22-18-8-22-14c-4 6-10 14-22 14s-20-10-20-22zm20-10c-6 0-10 5-10 10s4 10 10 10 10-5 12-10c-2-5-6-10-12-10zm44 0c-6 0-10 5-12 10 2 5 6 10 12 10s10-5 10-10-4-10-10-10z"
                fill="url(#ouroGrad)"
            />
        </svg>
    );
}
