/**
 * Framework Adapters
 */

export { AdapterRegistry, getAdapterRegistry, resetAdapterRegistry } from './AdapterRegistry';
export type { FrameworkAdapter, PackageJson, FrameworkDetection, RouteInfo, CommandInfo } from './types';

// JS/TS Adapters
export { ExpressAdapter } from './js/ExpressAdapter';
export { NextjsAdapter } from './js/NextjsAdapter';
export { NestjsAdapter } from './js/NestjsAdapter';
export { CliAdapter } from './js/CliAdapter';

// External Tool Adapters
export { 
    DependencyCruiserAdapter, 
    shouldRecommendDependencyCruiser,
    type DependencyCruiserConfig,
} from './DependencyCruiserAdapter';

export {
    GoModGraphAdapter,
    shouldRecommendGoModGraph,
    type GoModGraphConfig,
} from './GoModGraphAdapter';

export {
    JdepsAdapter,
    shouldRecommendJdeps,
    type JdepsConfig,
} from './JdepsAdapter';

/**
 * Register all built-in adapters
 */
import { getAdapterRegistry } from './AdapterRegistry';
import { ExpressAdapter } from './js/ExpressAdapter';
import { NextjsAdapter } from './js/NextjsAdapter';
import { NestjsAdapter } from './js/NestjsAdapter';
import { CliAdapter } from './js/CliAdapter';

export function registerBuiltinAdapters(): void {
    const registry = getAdapterRegistry();
    
    // JS/TS frameworks
    registry.register(new ExpressAdapter());
    registry.register(new NextjsAdapter());
    registry.register(new NestjsAdapter());
    registry.register(new CliAdapter());
}
