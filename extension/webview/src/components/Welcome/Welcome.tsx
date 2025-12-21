import { Icon } from '../Icon';
import { Button } from '../Button';
import { Card, CardHeader, CardBody } from '../Card';
import { Badge } from '../Badge';
import { Logo } from '../Logo';
import styles from './Welcome.module.css';

interface WelcomeProps {
    onInitialize?: () => void;
    onOpenCopilot?: () => void;
    onUpdatePrompts?: () => void;
    isInitialized?: boolean;
    hasUpdates?: boolean;
    projectName?: string;
}

export function Welcome({
    onInitialize,
    onOpenCopilot,
    onUpdatePrompts,
    isInitialized = false,
    hasUpdates = false,
    projectName,
}: WelcomeProps) {
    return (
        <div className={styles.container}>
            {/* Logo and Title */}
            <div className={styles.header}>
                <Logo size={64} className={styles.logo} />
                <h1 className={styles.title}>Ouroboros</h1>
                <p className={styles.subtitle}>Spec-Driven AI Workflow</p>
            </div>

            {/* Status Card */}
            <Card className={styles.statusCard}>
                <CardHeader>
                    <Icon name="info" />
                    <span>Status</span>
                </CardHeader>
                <CardBody>
                    <div className={styles.statusItem}>
                        <span className={styles.statusLabel}>Workspace:</span>
                        <span className={styles.statusValue}>
                            {projectName || <span className={styles.warning}>No folder open</span>}
                        </span>
                    </div>
                    <div className={styles.statusItem}>
                        <span className={styles.statusLabel}>Ouroboros:</span>
                        <span className={styles.statusValue}>
                            {isInitialized ? (
                                <Badge variant="success" size="small">Initialized</Badge>
                            ) : (
                                <Badge variant="warning" size="small">Not Initialized</Badge>
                            )}
                        </span>
                    </div>
                </CardBody>
            </Card>

            {/* Quick Actions */}
            <Card className={styles.actionsCard}>
                <CardHeader>
                    <Icon name="rocket" />
                    <span>Quick Actions</span>
                </CardHeader>
                <CardBody>
                    {/* Step 1: Initialize Project */}
                    <div className={styles.step}>
                        <div className={styles.stepHeader}>
                            <Badge variant={isInitialized ? 'success' : 'default'} size="small">
                                {isInitialized ? '✓' : '1'}
                            </Badge>
                            <span>Initialize Project</span>
                        </div>
                        <p className={styles.stepDesc}>
                            Copy agents, prompts, and templates to your workspace
                        </p>
                        <Button
                            variant={isInitialized ? 'secondary' : 'primary'}
                            className={styles.actionButton}
                            onClick={onInitialize}
                            disabled={!projectName}
                        >
                            <Icon name="folder-opened" />
                            {isInitialized ? 'Re-initialize' : 'Initialize'}
                        </Button>
                    </div>

                    {/* Step 2: Start Workflow */}
                    <div className={styles.step}>
                        <div className={styles.stepHeader}>
                            <Badge variant={isInitialized ? 'default' : 'info'} size="small">2</Badge>
                            <span>Start Ouroboros</span>
                        </div>
                        <p className={styles.stepDesc}>
                            Open Copilot Chat and type <code>/ouroboros</code>
                        </p>
                        <Button
                            variant="secondary"
                            className={styles.actionButton}
                            onClick={onOpenCopilot}
                            disabled={!isInitialized}
                        >
                            <Icon name="comment-discussion" />
                            Open Copilot Chat
                        </Button>
                    </div>

                    {/* Step 3: Update Prompts */}
                    {isInitialized && (
                        <div className={styles.step}>
                            <div className={styles.stepHeader}>
                                <Badge
                                    variant={hasUpdates ? 'warning' : 'success'}
                                    size="small"
                                >
                                    {hasUpdates ? '!' : '✓'}
                                </Badge>
                                <span>Update Prompts</span>
                            </div>
                            <p className={styles.stepDesc}>
                                Update prompts while keeping your custom tools
                            </p>
                            <Button
                                variant={hasUpdates ? 'primary' : 'secondary'}
                                className={styles.actionButton}
                                onClick={onUpdatePrompts}
                            >
                                <Icon name="sync" />
                                {hasUpdates ? 'Update Available' : 'Check for Updates'}
                            </Button>
                        </div>
                    )}
                </CardBody>
            </Card>

            {/* What Gets Installed */}
            <Card className={styles.infoCard}>
                <CardHeader>
                    <Icon name="package" />
                    <span>What Gets Installed</span>
                </CardHeader>
                <CardBody>
                    <div className={styles.fileList}>
                        <div className={styles.fileItem}>
                            <Icon name="folder" />
                            <code>.github/agents/</code>
                            <span className={styles.fileDesc}>16 agent prompts</span>
                        </div>
                        <div className={styles.fileItem}>
                            <Icon name="folder" />
                            <code>.github/prompts/</code>
                            <span className={styles.fileDesc}>Slash commands</span>
                        </div>
                        <div className={styles.fileItem}>
                            <Icon name="file" />
                            <code>.github/copilot-instructions.md</code>
                            <span className={styles.fileDesc}>CCL rules</span>
                        </div>
                        <div className={styles.fileItem}>
                            <Icon name="folder" />
                            <code>.ouroboros/</code>
                            <span className={styles.fileDesc}>Specs & templates</span>
                        </div>
                    </div>
                </CardBody>
            </Card>

            {/* Keyboard Shortcuts */}
            <Card className={styles.shortcutsCard}>
                <CardHeader>
                    <Icon name="keyboard" />
                    <span>Shortcuts</span>
                </CardHeader>
                <CardBody>
                    <div className={styles.shortcutGrid}>
                        <div className={styles.shortcut}><kbd>0</kbd> Home</div>
                        <div className={styles.shortcut}><kbd>1</kbd> Pending</div>
                        <div className={styles.shortcut}><kbd>2</kbd> Workflow</div>
                        <div className={styles.shortcut}><kbd>3</kbd> Agents</div>
                        <div className={styles.shortcut}><kbd>4</kbd> History</div>
                    </div>
                </CardBody>
            </Card>

            {/* Footer */}
            <div className={styles.footer}>
                <span>♾️ The Loop Never Ends</span>
            </div>
        </div>
    );
}
