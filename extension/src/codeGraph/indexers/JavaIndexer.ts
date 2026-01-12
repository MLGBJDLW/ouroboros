/**
 * Java Indexer
 * Parses Java files using tree-sitter for imports, exports, and entrypoints
 * 
 * Handles:
 * - Standard library and common framework detection
 * - Maven/Gradle project structure (src/main/java, src/test/java)
 * - Static imports
 * - Wildcard imports
 * - Framework detection (Spring Boot, Micronaut, Quarkus, Jakarta EE)
 * - Test detection (JUnit, TestNG)
 * - Annotation processing (@Entity, @Service, @Controller, etc.)
 */

import { TreeSitterIndexer, type TreeSitterIndexerOptions } from './TreeSitterIndexer';
import type { GraphNode, GraphEdge, IndexResult } from '../core/types';
import type { ParsedNode, SupportedLanguage } from '../parsers/TreeSitterManager';

// Java standard library and common external packages to skip
const JAVA_EXTERNAL_PACKAGES = [
    // Java SE
    'java.', 'javax.', 'jdk.', 'sun.', 'com.sun.',
    // Jakarta EE (formerly Java EE)
    'jakarta.',
    // Spring Framework
    'org.springframework.',
    // Testing
    'org.junit.', 'org.testng.', 'org.mockito.', 'org.assertj.', 'org.hamcrest.',
    'org.spockframework.', 'io.cucumber.', 'org.jbehave.',
    // Apache Commons
    'org.apache.commons.', 'org.apache.logging.', 'org.apache.http.',
    'org.apache.kafka.', 'org.apache.camel.', 'org.apache.poi.',
    // Google
    'com.google.common.', 'com.google.gson.', 'com.google.inject.',
    'com.google.protobuf.', 'com.google.cloud.',
    // Jackson
    'com.fasterxml.jackson.',
    // Lombok
    'lombok.',
    // SLF4J/Logback/Log4j
    'org.slf4j.', 'ch.qos.logback.', 'org.apache.log4j.', 'org.apache.logging.log4j.',
    // Hibernate/JPA
    'org.hibernate.', 'javax.persistence.', 'jakarta.persistence.',
    // MyBatis
    'org.mybatis.', 'org.apache.ibatis.',
    // Other common
    'io.netty.', 'io.grpc.', 'io.micrometer.',
    'reactor.', 'rx.', 'io.reactivex.',
    'okhttp3.', 'retrofit2.',
    // Micronaut
    'io.micronaut.',
    // Quarkus
    'io.quarkus.',
    // Vert.x
    'io.vertx.',
    // Helidon
    'io.helidon.',
    // AWS SDK
    'software.amazon.', 'com.amazonaws.',
    // Azure SDK
    'com.azure.', 'com.microsoft.azure.',
    // Validation
    'javax.validation.', 'jakarta.validation.', 'org.hibernate.validator.',
    // Security
    'org.springframework.security.', 'io.jsonwebtoken.',
    // Serialization
    'com.google.protobuf.', 'org.apache.avro.', 'org.apache.thrift.',
    // Metrics/Tracing
    'io.opentelemetry.', 'io.opentracing.', 'io.prometheus.',
    // MapStruct
    'org.mapstruct.',
    // Swagger/OpenAPI
    'io.swagger.', 'org.springdoc.',
];

export class JavaIndexer extends TreeSitterIndexer {
    readonly language: SupportedLanguage = 'java';
    readonly supportedExtensions = ['.java'];

    constructor(options: TreeSitterIndexerOptions) {
        super(options);
    }

    /**
     * Check if import is from an external package
     */
    private isJavaExternalPackage(importPath: string): boolean {
        // Check if it's a workspace package (monorepo internal dependency)
        if (this.isWorkspacePackage(importPath, 'java')) {
            return false;
        }
        
        return JAVA_EXTERNAL_PACKAGES.some(prefix => importPath.startsWith(prefix));
    }

    /**
     * Resolve Java import path to local file
     */
    protected override resolveImportPath(importPath: string, fromFile: string): string | null {
        // Normalize path separators
        const normalizedFromFile = fromFile.replace(/\\/g, '/');
        
        // Handle static imports: import static com.example.Utils.method
        let cleanPath = importPath;
        if (cleanPath.startsWith('static ')) {
            cleanPath = cleanPath.slice(7).trim();
            // For static imports, we need the class, not the method
            const lastDot = cleanPath.lastIndexOf('.');
            if (lastDot !== -1) {
                // Check if last part is lowercase (method) or uppercase (class constant)
                const lastPart = cleanPath.slice(lastDot + 1);
                if (/^[a-z]/.test(lastPart)) {
                    cleanPath = cleanPath.slice(0, lastDot);
                }
            }
        }
        
        // Skip external packages
        if (this.isJavaExternalPackage(cleanPath)) {
            return null;
        }
        
        // Convert package.Class to package/Class.java
        const parts = cleanPath.split('.');
        
        // Handle wildcard imports (com.example.*)
        if (parts[parts.length - 1] === '*') {
            parts.pop();
            // Return directory path
            return this.findJavaSourcePath(parts.join('/'), normalizedFromFile);
        }
        
        // Regular import
        const relativePath = parts.join('/') + '.java';
        return this.findJavaSourcePath(relativePath, normalizedFromFile);
    }

    /**
     * Find the correct source path for a Java file
     * Handles both Maven (src/main/java) and simple (src/) structures
     */
    private findJavaSourcePath(relativePath: string, fromFile: string): string {
        // Detect project structure from fromFile
        if (fromFile.includes('/src/main/java/')) {
            return `src/main/java/${relativePath}`;
        }
        if (fromFile.includes('/src/test/java/')) {
            return `src/test/java/${relativePath}`;
        }
        if (fromFile.includes('/src/main/kotlin/')) {
            return `src/main/kotlin/${relativePath.replace('.java', '.kt')}`;
        }
        // Simple structure
        if (fromFile.includes('/src/')) {
            return `src/${relativePath}`;
        }
        // Default to Maven structure
        return `src/main/java/${relativePath}`;
    }

    protected parseTree(rootNode: ParsedNode, filePath: string, content: string): IndexResult {
        const nodes: GraphNode[] = [];
        const edges: GraphEdge[] = [];
        const exports: string[] = [];
        const isTestFile = this.isTestFile(filePath);
        const fileName = this.getFileName(filePath);
        const isPackageInfo = fileName === 'package-info.java';
        const isModuleInfo = fileName === 'module-info.java';

        this.walkTree(rootNode, (node) => {
            // import statements (including static imports)
            if (node.type === 'import_declaration') {
                const isStatic = node.text.includes('static ');
                const pathNode = this.findDescendant(node, 'scoped_identifier');
                if (pathNode) {
                    const importPath = isStatic ? `static ${pathNode.text}` : pathNode.text;
                    const isExternal = this.isJavaExternalPackage(pathNode.text);
                    edges.push(this.createTsImportEdge(
                        filePath,
                        importPath,
                        node.startPosition.row + 1,
                        isExternal ? 'low' : 'high'
                    ));
                    
                    // Static wildcard imports can be considered re-exports in some contexts
                    if (isStatic && pathNode.text.endsWith('.*') && !isExternal) {
                        const reexportEdge = this.createJavaReexportEdge(
                            filePath,
                            pathNode.text,
                            node.startPosition.row + 1,
                            'static-wildcard'
                        );
                        if (reexportEdge) {
                            edges.push(reexportEdge);
                        }
                    }
                }
            }

            // Public classes
            if (node.type === 'class_declaration') {
                const modifiers = this.findChild(node, 'modifiers');
                if (modifiers?.text.includes('public')) {
                    const nameNode = this.findChild(node, 'identifier');
                    if (nameNode) {
                        exports.push(nameNode.text);
                    }
                }
            }

            // Public interfaces
            if (node.type === 'interface_declaration') {
                const modifiers = this.findChild(node, 'modifiers');
                if (modifiers?.text.includes('public')) {
                    const nameNode = this.findChild(node, 'identifier');
                    if (nameNode) {
                        exports.push(nameNode.text);
                    }
                }
            }

            // Public enums
            if (node.type === 'enum_declaration') {
                const modifiers = this.findChild(node, 'modifiers');
                if (modifiers?.text.includes('public')) {
                    const nameNode = this.findChild(node, 'identifier');
                    if (nameNode) {
                        exports.push(nameNode.text);
                    }
                }
            }

            // Public records (Java 14+)
            if (node.type === 'record_declaration') {
                const modifiers = this.findChild(node, 'modifiers');
                if (modifiers?.text.includes('public')) {
                    const nameNode = this.findChild(node, 'identifier');
                    if (nameNode) {
                        exports.push(nameNode.text);
                    }
                }
            }

            // Module declarations (Java 9+) - exports and requires
            if (node.type === 'module_declaration') {
                // exports package.name;
                const exportsDirectives = this.findAllDescendants(node, 'exports_module_directive');
                for (const directive of exportsDirectives) {
                    const packageNode = this.findDescendant(directive, 'scoped_identifier');
                    if (packageNode) {
                        // This is a module-level export/re-export
                        edges.push({
                            id: `edge:${filePath}:reexports:${packageNode.text}`,
                            from: `file:${filePath}`,
                            to: `package:${packageNode.text}`,
                            kind: 'reexports',
                            confidence: 'high',
                            reason: 'java module exports',
                            meta: {
                                importPath: packageNode.text,
                                reexportType: 'module-exports',
                                loc: { line: directive.startPosition.row + 1, column: 0 },
                                language: 'java',
                            },
                        });
                    }
                }

                // requires package.name;
                const requiresDirectives = this.findAllDescendants(node, 'requires_module_directive');
                for (const directive of requiresDirectives) {
                    const moduleNode = this.findDescendant(directive, 'scoped_identifier') ||
                                       this.findDescendant(directive, 'identifier');
                    if (moduleNode) {
                        const isTransitive = directive.text.includes('transitive');
                        edges.push(this.createTsImportEdge(
                            filePath,
                            moduleNode.text,
                            directive.startPosition.row + 1,
                            'high'
                        ));
                        
                        // transitive requires is a re-export
                        if (isTransitive) {
                            edges.push({
                                id: `edge:${filePath}:reexports:${moduleNode.text}`,
                                from: `file:${filePath}`,
                                to: `module:${moduleNode.text}`,
                                kind: 'reexports',
                                confidence: 'high',
                                reason: 'java module requires transitive',
                                meta: {
                                    importPath: moduleNode.text,
                                    reexportType: 'transitive',
                                    loc: { line: directive.startPosition.row + 1, column: 0 },
                                    language: 'java',
                                },
                            });
                        }
                    }
                }
            }
        });

        // Create file node
        const fileNode = this.createTsFileNode(filePath, exports);
        if (isPackageInfo) {
            fileNode.meta = { ...fileNode.meta, isPackageInfo: true };
        }
        if (isModuleInfo) {
            fileNode.meta = { ...fileNode.meta, isModuleInfo: true };
        }
        nodes.push(fileNode);

        // Detect entrypoints
        const entrypoint = this.detectEntrypoint(rootNode, content, filePath, isTestFile);
        if (entrypoint) {
            nodes.push(entrypoint);
        }

        return { nodes, edges };
    }

    /**
     * Create a Java re-export edge
     */
    private createJavaReexportEdge(
        fromFile: string,
        toPackage: string,
        line: number,
        reexportType: 'static-wildcard' | 'module-exports' | 'transitive'
    ): GraphEdge | null {
        const resolvedPath = this.resolveImportPath(toPackage.replace('.*', ''), fromFile);
        if (resolvedPath) {
            return {
                id: `edge:${fromFile}:reexports:${resolvedPath}`,
                from: `file:${fromFile}`,
                to: `file:${resolvedPath}`,
                kind: 'reexports',
                confidence: 'medium',
                reason: `java ${reexportType}`,
                meta: {
                    importPath: toPackage,
                    reexportType,
                    loc: { line, column: 0 },
                    language: 'java',
                },
            };
        }
        return null;
    }

    /**
     * Check if file is a test file
     */
    private isTestFile(filePath: string): boolean {
        const normalizedPath = filePath.replace(/\\/g, '/');
        return normalizedPath.includes('/test/') ||
               normalizedPath.includes('/tests/') ||
               normalizedPath.includes('Test.java') ||
               normalizedPath.includes('Tests.java') ||
               normalizedPath.includes('IT.java') ||  // Integration tests
               normalizedPath.includes('Spec.java');
    }

    /**
     * Detect Java entrypoints
     */
    private detectEntrypoint(rootNode: ParsedNode, content: string, filePath: string, isTestFile: boolean): GraphNode | null {
        let hasMain = false;
        let framework: string | null = null;
        let hasTestAnnotations = false;
        let isModuleInfo = false;
        const annotations: string[] = [];
        const fileName = this.getFileName(filePath);

        // Check for module-info.java (Java 9+ modules)
        if (fileName === 'module-info.java') {
            isModuleInfo = true;
        }

        this.walkTree(rootNode, (node) => {
            // public static void main(String[] args)
            if (node.type === 'method_declaration') {
                const nameNode = this.findChild(node, 'identifier');
                if (nameNode?.text === 'main') {
                    const modifiers = this.findChild(node, 'modifiers');
                    if (modifiers?.text.includes('public') && modifiers?.text.includes('static')) {
                        hasMain = true;
                    }
                }
            }

            // Collect annotations
            if (node.type === 'marker_annotation' || node.type === 'annotation') {
                const annotationText = node.text;
                annotations.push(annotationText);
                
                // Spring Boot
                if (annotationText.includes('SpringBootApplication')) {
                    framework = 'spring-boot';
                }
                // Spring MVC/REST
                if (annotationText.includes('RestController') || annotationText.includes('Controller')) {
                    framework = framework || 'spring';
                }
                // Spring request mappings
                if (/@(Request|Get|Post|Put|Delete|Patch)Mapping/.test(annotationText)) {
                    framework = framework || 'spring';
                }
                // Spring WebFlux
                if (annotationText.includes('RouterFunction') || annotationText.includes('WebFluxTest')) {
                    framework = framework || 'spring-webflux';
                }
                // Micronaut
                if (annotationText.includes('MicronautApplication')) {
                    framework = 'micronaut';
                }
                if (annotationText.includes('@Controller') && !framework) {
                    // Could be Micronaut or Spring
                    framework = framework || 'micronaut';
                }
                // Quarkus
                if (annotationText.includes('QuarkusMain')) {
                    framework = 'quarkus';
                }
                if (annotationText.includes('@Path') && !framework) {
                    framework = framework || 'quarkus';
                }
                // Jakarta/JAX-RS
                if (/@(Path|GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS)/.test(annotationText)) {
                    framework = framework || 'jakarta';
                }
                // Vert.x
                if (annotationText.includes('Verticle') || content.includes('io.vertx')) {
                    framework = framework || 'vertx';
                }
                // Helidon
                if (content.includes('io.helidon')) {
                    framework = framework || 'helidon';
                }
                // Test annotations - JUnit 5
                if (/@(Test|ParameterizedTest|RepeatedTest|BeforeEach|AfterEach|BeforeAll|AfterAll|Nested|DisplayName)/.test(annotationText)) {
                    hasTestAnnotations = true;
                }
                // Test annotations - JUnit 4
                if (/@(Test|Before|After|BeforeClass|AfterClass|Ignore|RunWith)/.test(annotationText)) {
                    hasTestAnnotations = true;
                }
                // TestNG
                if (/@(Test|BeforeMethod|AfterMethod|BeforeClass|AfterClass|BeforeSuite|AfterSuite|DataProvider)/.test(annotationText)) {
                    hasTestAnnotations = true;
                }
                // Spock
                if (content.includes('spock.lang.Specification')) {
                    hasTestAnnotations = true;
                }
                // Cucumber
                if (/@(Given|When|Then|And|But|Before|After)/.test(annotationText)) {
                    hasTestAnnotations = true;
                }
                // Scheduled tasks
                if (annotationText.includes('Scheduled')) {
                    framework = framework || 'spring-scheduled';
                }
                // Message listeners - Kafka
                if (annotationText.includes('KafkaListener')) {
                    framework = framework || 'kafka';
                }
                // Message listeners - JMS
                if (annotationText.includes('JmsListener')) {
                    framework = framework || 'jms';
                }
                // Message listeners - RabbitMQ
                if (annotationText.includes('RabbitListener')) {
                    framework = framework || 'rabbitmq';
                }
                // Message listeners - SQS
                if (annotationText.includes('SqsListener')) {
                    framework = framework || 'sqs';
                }
                // Batch processing
                if (annotationText.includes('EnableBatchProcessing') || annotationText.includes('@Job')) {
                    framework = framework || 'spring-batch';
                }
                // gRPC
                if (annotationText.includes('GrpcService') || content.includes('io.grpc')) {
                    framework = framework || 'grpc';
                }
                // GraphQL
                if (/@(QueryMapping|MutationMapping|SubscriptionMapping|SchemaMapping)/.test(annotationText)) {
                    framework = framework || 'spring-graphql';
                }
                // Entity/Repository (JPA)
                if (annotationText.includes('@Entity') || annotationText.includes('@Repository')) {
                    // Don't set framework, but note it's a data class
                }
                // Lombok annotations (informational)
                if (/@(Data|Getter|Setter|Builder|NoArgsConstructor|AllArgsConstructor|Value|Slf4j|Log4j2)/.test(annotationText)) {
                    // Lombok - informational only
                }
                // MapStruct
                if (annotationText.includes('@Mapper')) {
                    // MapStruct mapper
                }
                // AWS Lambda
                if (content.includes('com.amazonaws.services.lambda') || content.includes('RequestHandler')) {
                    framework = framework || 'lambda';
                }
                // Azure Functions
                if (annotationText.includes('@FunctionName')) {
                    framework = framework || 'azure-functions';
                }
            }
        });

        // Module info file
        if (isModuleInfo) {
            return this.createEntrypointNode(filePath, 'main', 'java-module');
        }

        // Test files
        if (isTestFile || hasTestAnnotations) {
            let testFramework = 'junit';
            if (content.includes('org.testng')) {
                testFramework = 'testng';
            } else if (content.includes('spock.lang')) {
                testFramework = 'spock';
            } else if (content.includes('io.cucumber')) {
                testFramework = 'cucumber';
            }
            return this.createEntrypointNode(filePath, 'test', testFramework);
        }

        if (hasMain) {
            if (framework) {
                if (framework === 'lambda' || framework === 'azure-functions') {
                    return this.createEntrypointNode(filePath, 'api', framework);
                }
                return this.createEntrypointNode(filePath, 'api', framework);
            }
            return this.createEntrypointNode(filePath, 'main');
        }

        if (framework) {
            // Scheduled/batch jobs
            if (framework === 'spring-scheduled' || framework === 'spring-batch') {
                return this.createEntrypointNode(filePath, 'job', 'spring');
            }
            // Message listeners
            if (['kafka', 'jms', 'rabbitmq', 'sqs'].includes(framework)) {
                return this.createEntrypointNode(filePath, 'job', framework);
            }
            // API frameworks
            return this.createEntrypointNode(filePath, 'api', framework);
        }

        return null;
    }

    protected fallbackParse(filePath: string, content: string): IndexResult {
        const nodes: GraphNode[] = [];
        const edges: GraphEdge[] = [];
        const lines = content.split('\n');

        // Simple regex-based parsing
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();

            // import package.Class;
            const importMatch = line.match(/^import\s+([a-zA-Z_][a-zA-Z0-9_.]*);/);
            if (importMatch) {
                edges.push(this.createTsImportEdge(filePath, importMatch[1], i + 1, 'low'));
            }
        }

        nodes.push(this.createTsFileNode(filePath));

        // Check for main method
        if (content.includes('public static void main')) {
            nodes.push(this.createEntrypointNode(filePath, 'main'));
        }

        // Check for Spring annotations
        if (content.includes('@SpringBootApplication')) {
            nodes.push(this.createEntrypointNode(filePath, 'api', 'spring-boot'));
        } else if (content.includes('@RestController') || content.includes('@Controller')) {
            nodes.push(this.createEntrypointNode(filePath, 'api', 'spring'));
        }

        return { nodes, edges };
    }
}
