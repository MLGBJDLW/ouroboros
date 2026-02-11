import { useState, useEffect, useCallback, useRef } from 'react';
import { usePendingRequests } from '../../hooks/usePendingRequests';
import { useAppContext } from '../../context/AppContext';
import { useInputHistory } from '../../hooks/useInputHistory';
import { useSlashCommands } from '../../hooks/useSlashCommands';
import { useFileMentions } from '../../hooks/useFileMentions';
import { useFormattedPaste } from '../../hooks/useFormattedPaste';
import { Button } from '../../components/Button';
import { Badge } from '../../components/Badge';
import { Icon } from '../../components/Icon';
import { Logo } from '../../components/Logo';
import { Markdown } from '../../components/Markdown';
import { AttachmentsList, DragOverlay, AttachmentActions } from '../../components/AttachmentInput';
import { SlashCommandDropdown } from '../../components/SlashCommandDropdown';
import { FileMentionDropdown } from '../../components/FileMentionDropdown';
import { formatRelativeTime, formatRequestType } from '../../utils/formatters';
import { AGENT_DISPLAY_NAMES } from '../../types/agent';
import { serializeAttachments } from '../../types/requests';
import type { Attachment } from '../../types/attachments';
import { generateAttachmentId, isImageType, detectLanguage, formatFileSize } from '../../types/attachments';
import { compressImage } from '../../utils/imageCompression';
import type { PendingRequest, AskRequestData, MenuRequestData, ConfirmRequestData, PlanReviewRequestData } from '../../types/requests';
import styles from './PendingRequests.module.css';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const MAX_ATTACHMENTS = 10;

/** Parse escaped newlines in text */
function parseNewlines(text: string): string {
    return text.replace(/\\n/g, '\n');
}

interface SentMessage {
    id: string;
    text: string;
    type: 'ask' | 'menu' | 'confirm' | 'plan_review';
    timestamp: number;
    attachmentCount?: number;
}

export function PendingRequests() {
    const { requests, respond, cancel } = usePendingRequests();
    const { state } = useAppContext();
    const [sentMessage, setSentMessage] = useState<SentMessage | null>(null);
    const [showAllActivity, setShowAllActivity] = useState(false);
    const graphContextCount = state.graphContextCount;

    useEffect(() => {
        if (sentMessage) {
            const timer = setTimeout(() => setSentMessage(null), 4000);
            return () => clearTimeout(timer);
        }
    }, [sentMessage]);

    const handleRespond = useCallback((id: string, response: unknown) => {
        const request = requests.find(r => r.id === id);
        const displayText = extractDisplayText(response);
        const attachmentCount = (response as { attachments?: unknown[] })?.attachments?.length;
        if (displayText && request) {
            setSentMessage({
                id: `sent-${Date.now()}`,
                text: displayText,
                type: request.type,
                timestamp: Date.now(),
                attachmentCount,
            });
        }
        respond(id, response);
    }, [requests, respond]);

    if (requests.length === 0) {
        return (
            <div className={styles.empty}>
                <AgentActivityBox
                    currentAgent={state.currentAgent}
                    handoffHistory={state.handoffHistory}
                    showAllActivity={showAllActivity}
                    onToggle={() => setShowAllActivity(!showAllActivity)}
                />
                {sentMessage ? (
                    <SentMessageBubble message={sentMessage} />
                ) : (
                    <div className={styles.emptyContent}>
                        <Icon name="comment-discussion" className={styles.emptyIcon} />
                        <h3>No pending requests</h3>
                        <p className={styles.emptyHint}>Waiting for agent input...</p>
                        {graphContextCount > 0 && (
                            <div className={styles.contextBadge}>
                                <Icon name="graph" />
                                <span>{graphContextCount} item{graphContextCount > 1 ? 's' : ''} in context</span>
                            </div>
                        )}
                    </div>
                )}
            </div>
        );
    }

    const currentRequest = requests[requests.length - 1];
    const isPlanReview = currentRequest.type === 'plan_review';

    return (
        <div className={`${styles.container} ${isPlanReview ? styles.containerFullWidth : ''}`}>
            <AgentActivityBox
                currentAgent={state.currentAgent}
                handoffHistory={state.handoffHistory}
                showAllActivity={showAllActivity}
                onToggle={() => setShowAllActivity(!showAllActivity)}
            />
            {graphContextCount > 0 && (
                <div className={styles.contextBadgeFloating}>
                    <Icon name="graph" />
                    <span>{graphContextCount}</span>
                </div>
            )}
            <div className={`${styles.listItem} ${isPlanReview ? styles.listItemFullWidth : ''}`}>
                <RequestChatBubble
                    request={currentRequest}
                    onRespond={handleRespond}
                    onCancel={cancel}
                />
            </div>
        </div>
    );
}

// ============================================================================
// Agent Activity Box
// ============================================================================

interface AgentActivityBoxProps {
    currentAgent: { name: string; level: 0 | 1 | 2 } | null;
    handoffHistory: Array<{ from: { name: string; level: 0 | 1 | 2 }; to: { name: string; level: 0 | 1 | 2 }; reason?: string }>;
    showAllActivity: boolean;
    onToggle: () => void;
}

const AGENT_ICONS: Record<string, string> = {
    // Level 0 (Core)
    'ouroboros': 'hubot',

    // Level 1 (Leads)
    'ouroboros-init': 'rocket',
    'ouroboros-spec': 'book',
    'ouroboros-implement': 'tools',
    'ouroboros-archive': 'archive',

    // Level 2 (Specialists)
    'ouroboros-coder': 'code',
    'ouroboros-architect': 'circuit-board',
    'ouroboros-devops': 'server-process',

    'ouroboros-qa': 'beaker',
    'ouroboros-validator': 'pass',
    'ouroboros-security': 'shield',

    'ouroboros-analyst': 'graph',
    'ouroboros-researcher': 'telescope',
    'ouroboros-requirements': 'checklist',
    'ouroboros-tasks': 'list-ordered',

    'ouroboros-writer': 'markdown',
    'ouroboros-review': 'eye',
};

function getAgentIcon(name: string): string {
    return AGENT_ICONS[name] || 'organization';
}

function AgentActivityBox({ currentAgent, handoffHistory, showAllActivity, onToggle }: AgentActivityBoxProps) {
    const recentHandoffs = handoffHistory.slice(-5).reverse();
    const hasHandoffs = recentHandoffs.length > 0;
    // Use 'pulse' for idle state to indicate system is alive but waiting
    const currentIcon = currentAgent ? getAgentIcon(currentAgent.name) : 'pulse';

    return (
        <div className={styles.cardContainer}>
            <div className={styles.holographicOverlay} />
            <div className={styles.scanlineLayer} />

            <button className={styles.techHeader} onClick={onToggle}>
                <div className={styles.headerLeft}>
                    <div className={styles.dataBadge}>
                        <Icon name={currentIcon} className={styles.badgeIcon} />
                        <div className={styles.badgeGlow} />
                    </div>

                    <div className={styles.headerInfo}>
                        <span className={styles.techLabel}>ACTIVE_NEURAL_UNIT</span>
                        <div className={styles.agentIdentity}>
                            {currentAgent ? (
                                <>
                                    <span className={styles.agentNameGlitch} data-text={getDisplayName(currentAgent.name)}>
                                        {getDisplayName(currentAgent.name)}
                                    </span>
                                    <span className={styles.levelTag}>::LVL_{currentAgent.level}</span>
                                </>
                            ) : (
                                <span className={styles.agentSystemIdle}>SYSTEM_WAKE_MODE</span>
                            )}
                        </div>
                    </div>
                </div>

                {hasHandoffs && (
                    <div className={styles.headerRight}>
                        <div className={styles.statusArray}>
                            <div className={styles.statusLight} />
                            <div className={styles.statusLight} />
                            <div className={styles.statusLightActive} />
                        </div>
                        <div className={styles.expandTrigger}>
                            <span className={styles.dataCount}>[{recentHandoffs.length}]</span>
                            <Icon name={showAllActivity ? 'chevron-up' : 'chevron-down'} className={styles.techChevron} />
                        </div>
                    </div>
                )}
            </button>

            {showAllActivity && hasHandoffs && (
                <div className={styles.streamContainer}>
                    <div className={styles.streamTimeline}>
                        {recentHandoffs.map((handoff, index) => (
                            <div key={index} className={styles.streamItem}>
                                <div className={styles.streamTrack}>
                                    <div className={styles.circuitNode} />
                                    {index !== recentHandoffs.length - 1 && <div className={styles.circuitLine} />}
                                </div>
                                <div className={styles.streamContent}>
                                    <div className={styles.dataLink}>
                                        <span className={styles.sourceNode}>{getDisplayName(handoff.from.name)}</span>
                                        <div className={styles.linkArrow}>»</div>
                                        <span className={styles.targetNode}>{getDisplayName(handoff.to.name)}</span>
                                    </div>
                                    {handoff.reason && <div className={styles.systemLog}>LOG: {handoff.reason}</div>}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

function getDisplayName(agentName: string): string {
    return AGENT_DISPLAY_NAMES[agentName] ?? agentName;
}

// ============================================================================
// Helpers
// ============================================================================

function extractDisplayText(response: unknown): string | null {
    if (!response || typeof response !== 'object') return null;
    const r = response as Record<string, unknown>;
    if (typeof r.response === 'string') return r.response;
    if (typeof r.selectedOption === 'string') return r.isCustom ? r.selectedOption : `Selected: ${r.selectedOption}`;
    if (typeof r.confirmed === 'boolean') {
        if (r.isCustom && typeof r.customResponse === 'string') return r.customResponse;
        return r.confirmed ? 'Yes' : 'No';
    }
    if (typeof r.approved === 'boolean') {
        if (r.isCustom && typeof r.customResponse === 'string') return r.customResponse;
        if (r.approved) return 'Approved';
        if (typeof r.feedback === 'string' && r.feedback) return `Rejected: ${r.feedback}`;
        return 'Rejected';
    }
    return null;
}

// ============================================================================
// Sent Message Bubble
// ============================================================================

interface SentMessageBubbleProps {
    message: SentMessage;
}

function SentMessageBubble({ message }: SentMessageBubbleProps) {
    const getTypeInfo = () => {
        switch (message.type) {
            case 'ask': return { icon: 'comment', label: 'RESPONSE', color: 'info' };
            case 'menu': return { icon: 'list-selection', label: 'SELECTION', color: 'success' };
            case 'confirm': return { icon: 'check', label: 'CONFIRM', color: 'warning' };
            case 'plan_review': return { icon: 'file-text', label: 'REVIEW', color: 'info' };
            default: return { icon: 'send', label: 'SENT', color: 'info' };
        }
    };

    const typeInfo = getTypeInfo();
    const timeStr = new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    return (
        <div className={styles.sentContainer}>
            <div className={`${styles.sentCard} ${styles[`sentCard${typeInfo.color.charAt(0).toUpperCase() + typeInfo.color.slice(1)}`]}`}>
                {/* Texture layers */}
                <div className={styles.sentScanlines} />
                <div className={styles.sentGlowEdge} />

                {/* Header */}
                <div className={styles.sentCardHeader}>
                    <div className={styles.sentStatusBadge}>
                        <div className={styles.sentStatusDot} />
                        <span className={styles.sentStatusText}>TRANSMITTED</span>
                    </div>
                    <div className={styles.sentTimestamp}>
                        <Icon name="clock" className={styles.sentTimeIcon} />
                        <span>{timeStr}</span>
                    </div>
                </div>

                {/* Content */}
                <div className={styles.sentCardBody}>
                    <p className={styles.sentMessageText}>{message.text}</p>
                </div>

                {/* Footer */}
                <div className={styles.sentCardFooter}>
                    {message.attachmentCount && message.attachmentCount > 0 && (
                        <div className={styles.sentAttachmentTag}>
                            <Icon name="pin" />
                            <span>{message.attachmentCount}</span>
                        </div>
                    )}
                    <div className={styles.sentTypeTag}>
                        <Icon name={typeInfo.icon} />
                        <span>{typeInfo.label}</span>
                    </div>
                    <div className={styles.sentCheckmark}>
                        <Icon name="check-all" />
                    </div>
                </div>
            </div>
        </div>
    );
}

// ============================================================================
// Request Chat Bubble
// ============================================================================

interface RequestChatBubbleProps {
    request: PendingRequest;
    onRespond: (id: string, response: unknown) => void;
    onCancel: (id: string) => void;
}

function RequestChatBubble({ request, onRespond, onCancel }: RequestChatBubbleProps) {
    const isPlanReview = request.type === 'plan_review';

    const getTypeVariant = () => {
        switch (request.type) {
            case 'confirm': return styles.confirmType;
            case 'menu': return styles.menuType;
            case 'plan_review': return styles.planType;
            default: return styles.askType;
        }
    };

    return (
        <div className={`${styles.messageBubble} ${getTypeVariant()} ${isPlanReview ? styles.planReviewBubble : ''}`}>
            <div className={styles.header}>
                <Badge variant="info" size="small">{formatRequestType(request.type)}</Badge>
                <span className={styles.agentName}>{request.agentName} (L{request.agentLevel})</span>
                <span className={styles.time}>{formatRelativeTime(request.timestamp)}</span>
                <button className={styles.closeButton} onClick={() => onCancel(request.id)} title="Cancel (Esc)">
                    <Icon name="close" />
                </button>
            </div>
            <div className={styles.content}>
                <RequestContent request={request} onRespond={onRespond} onCancel={onCancel} />
            </div>
        </div>
    );
}

// ============================================================================
// Request Content Router
// ============================================================================

interface RequestContentProps {
    request: PendingRequest;
    onRespond: (id: string, response: unknown) => void;
    onCancel: (id: string) => void;
}

function RequestContent({ request, onRespond, onCancel }: RequestContentProps) {
    switch (request.type) {
        case 'ask':
            return <AskContent request={request} data={request.data as AskRequestData} onRespond={onRespond} onCancel={onCancel} />;
        case 'menu':
            return <MenuContent request={request} data={request.data as MenuRequestData} onRespond={onRespond} onCancel={onCancel} />;
        case 'confirm':
            return <ConfirmContent request={request} data={request.data as ConfirmRequestData} onRespond={onRespond} onCancel={onCancel} />;
        case 'plan_review':
            return <PlanReviewContent request={request} data={request.data as PlanReviewRequestData} onRespond={onRespond} onCancel={onCancel} />;
        default:
            return <p>Unknown request type</p>;
    }
}

// ============================================================================
// Attachment Hook
// ============================================================================

/** Read a file as data URL */
function readFileAsDataURL(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error(`Failed to read file: ${file.name}`));
        reader.readAsDataURL(file);
    });
}

function useAttachments(maxAttachments = MAX_ATTACHMENTS, maxFileSize = MAX_FILE_SIZE) {
    const [attachments, setAttachments] = useState<Attachment[]>([]);
    const [isDragOver, setIsDragOver] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const clearError = useCallback(() => {
        if (error) setTimeout(() => setError(null), 3000);
    }, [error]);

    const processFile = useCallback(async (file: File): Promise<Attachment | null> => {
        if (file.size > maxFileSize) {
            setError(`File too large. Max: ${formatFileSize(maxFileSize)}`);
            clearError();
            return null;
        }

        const isImage = isImageType(file.type);

        try {
            // Compress images to reduce vision token consumption
            const data = isImage
                ? await compressImage(file, { quality: 0.92, maxDimension: 2048 })
                : await readFileAsDataURL(file);

            const attachment: Attachment = {
                id: generateAttachmentId(),
                type: isImage ? 'image' : (detectLanguage(file.name) ? 'code' : 'file'),
                name: file.name,
                data,
                mimeType: file.type,
                size: file.size,
                language: detectLanguage(file.name),
            };
            if (isImage) attachment.previewUrl = URL.createObjectURL(file);
            return attachment;
        } catch {
            return null;
        }
    }, [maxFileSize, clearError]);

    const addAttachment = useCallback(async (file: File) => {
        console.log('[Attachment] Adding file:', file.name, file.size, file.type);
        if (attachments.length >= maxAttachments) {
            setError(`Max ${maxAttachments} attachments`);
            clearError();
            return;
        }
        const attachment = await processFile(file);
        console.log('[Attachment] Processed:', attachment?.name, attachment?.id);
        if (attachment) {
            setAttachments(prev => {
                console.log('[Attachment] State update, new count:', prev.length + 1);
                return [...prev, attachment];
            });
        }
    }, [attachments.length, maxAttachments, processFile, clearError]);

    const removeAttachment = useCallback((id: string) => {
        const att = attachments.find(a => a.id === id);
        if (att?.previewUrl) URL.revokeObjectURL(att.previewUrl);
        setAttachments(prev => prev.filter(a => a.id !== id));
    }, [attachments]);

    const handlePaste = useCallback(async (e: React.ClipboardEvent) => {
        const items = e.clipboardData.items;
        for (const item of items) {
            if (item.kind === 'file') {
                const file = item.getAsFile();
                if (file) {
                    e.preventDefault();
                    await addAttachment(file);
                }
            }
        }
    }, [addAttachment]);

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        console.log('[Attachment] DragOver event triggered');
        if (e.dataTransfer) {
            e.dataTransfer.dropEffect = 'copy';
        }
        setIsDragOver(true);
    }, []);

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        console.log('[Attachment] DragLeave event triggered');
        setIsDragOver(false);
    }, []);

    const handleDrop = useCallback(async (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(false);

        // Try to get VS Code URI list first (for files dragged from Explorer)
        const textData = e.dataTransfer?.getData('text') || '';
        const uriListData = e.dataTransfer?.getData('application/vnd.code.uri-list') || '';
        const pathData = textData || uriListData;

        console.log('[Attachment] Drop - text:', textData, 'uri-list:', uriListData);

        if (pathData) {
            // Files dragged from VS Code Explorer - we get paths, not file content
            // For now, just insert the path as text (could be enhanced to read file content)
            const paths = pathData.split(/\r?\n/).filter(line => line.trim());
            console.log('[Attachment] Got paths:', paths);

            // Insert paths as mentions or text
            // TODO: Could enhance to actually read file content via extension
            return;
        }

        // Try to get actual files (from OS file manager)
        const files = Array.from(e.dataTransfer?.files || []);
        console.log('[Attachment] Drop - files count:', files.length);

        for (const file of files) {
            console.log('[Attachment] Processing file:', file.name, file.size, file.type);
            await addAttachment(file);
        }
    }, [addAttachment]);

    const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        for (const file of files) await addAttachment(file);
        if (fileInputRef.current) fileInputRef.current.value = '';
    }, [addAttachment]);

    const openFilePicker = useCallback(() => fileInputRef.current?.click(), []);

    const clearAttachments = useCallback(() => {
        attachments.forEach(a => { if (a.previewUrl) URL.revokeObjectURL(a.previewUrl); });
        setAttachments([]);
    }, [attachments]);

    return {
        attachments,
        isDragOver,
        error,
        fileInputRef,
        removeAttachment,
        handlePaste,
        handleDragOver,
        handleDragLeave,
        handleDrop,
        handleFileSelect,
        openFilePicker,
        clearAttachments,
    };
}

// ============================================================================
// Content Components
// ============================================================================

interface ContentProps {
    request: PendingRequest;
    onRespond: (id: string, response: unknown) => void;
    onCancel: (id: string) => void;
}


function AskContent({ request, data, onRespond, onCancel }: ContentProps & { data: AskRequestData }) {
    const [value, setValue] = useState('');
    const [cursorPosition, setCursorPosition] = useState(0);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const inputHistory = useInputHistory();
    const slashCommands = useSlashCommands();
    const fileMentions = useFileMentions();
    const formatPaste = useFormattedPaste(textareaRef, setValue, setCursorPosition);
    const {
        attachments, isDragOver, error, fileInputRef,
        removeAttachment, handlePaste, handleDragOver, handleDragLeave,
        handleDrop, handleFileSelect, openFilePicker, clearAttachments,
    } = useAttachments();

    const handleSubmit = useCallback(() => {
        if (value.trim() || attachments.length > 0) {
            // Prepend agent instruction if slash command detected
            const processedValue = slashCommands.prependInstruction(value);
            onRespond(request.id, {
                response: processedValue,
                cancelled: false,
                attachments: serializeAttachments(attachments),
            });
            clearAttachments();
            slashCommands.cancel();
            fileMentions.cancel();
        }
    }, [request.id, value, attachments, onRespond, clearAttachments, slashCommands, fileMentions]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                if (slashCommands.isActive) {
                    slashCommands.cancel();
                } else if (fileMentions.isActive) {
                    fileMentions.cancel();
                } else {
                    onCancel(request.id);
                }
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [request.id, onCancel, slashCommands, fileMentions]);

    const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const newValue = e.target.value;
        const newCursor = e.target.selectionStart;
        setValue(newValue);
        setCursorPosition(newCursor);
        inputHistory.resetNavigation();

        // Update slash command matches (only at start of input)
        slashCommands.update(newValue);

        // Update file mention matches (can be anywhere in input)
        if (!slashCommands.isActive) {
            fileMentions.update(newValue, newCursor);
        }

        e.target.style.height = 'auto';
        e.target.style.height = Math.min(e.target.scrollHeight, 240) + 'px';
    };

    const handleTextareaKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        // Handle file mention navigation first (higher priority when active)
        if (fileMentions.isActive) {
            if (e.key === 'ArrowUp') {
                e.preventDefault();
                fileMentions.moveUp();
                return;
            }
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                fileMentions.moveDown();
                return;
            }
            if (e.key === 'Tab' || e.key === 'Enter') {
                e.preventDefault();
                const { text, newCursor } = fileMentions.complete(value, cursorPosition);
                setValue(text);
                setCursorPosition(newCursor);
                // Set cursor position after state update
                setTimeout(() => {
                    if (textareaRef.current) {
                        textareaRef.current.selectionStart = newCursor;
                        textareaRef.current.selectionEnd = newCursor;
                    }
                }, 0);
                return;
            }
            if (e.key === 'Escape') {
                e.preventDefault();
                fileMentions.cancel();
                return;
            }
        }

        // Handle slash command navigation
        if (slashCommands.isActive) {
            if (e.key === 'ArrowUp') {
                e.preventDefault();
                slashCommands.moveUp();
                return;
            }
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                slashCommands.moveDown();
                return;
            }
            if (e.key === 'Tab') {
                e.preventDefault();
                const completed = slashCommands.complete(value);
                setValue(completed);
                return;
            }
            if (e.key === 'Escape') {
                e.preventDefault();
                slashCommands.cancel();
                return;
            }
        }

        // Handle history navigation (only when no dropdowns active)
        if (!slashCommands.isActive && !fileMentions.isActive && inputHistory.handleKeyDown(e, value, setValue)) {
            return;
        }

        // Handle submit (only when file mentions not active, to allow Enter for completion)
        if (e.key === 'Enter' && !e.shiftKey && !fileMentions.isActive) {
            e.preventDefault();
            handleSubmit();
        }
    };

    const handleSlashCommandSelect = useCallback((cmd: { command: string }) => {
        setValue(cmd.command + ' ');
        slashCommands.cancel();
        textareaRef.current?.focus();
    }, [slashCommands]);

    const handleFileMentionSelect = useCallback((_file: { path: string }) => {
        const { text, newCursor } = fileMentions.complete(value, cursorPosition);
        setValue(text);
        setCursorPosition(newCursor);
        setTimeout(() => {
            if (textareaRef.current) {
                textareaRef.current.selectionStart = newCursor;
                textareaRef.current.selectionEnd = newCursor;
                textareaRef.current.focus();
            }
        }, 0);
    }, [fileMentions, value, cursorPosition]);

    // Track cursor position on click/selection
    const handleTextareaSelect = useCallback((e: React.SyntheticEvent<HTMLTextAreaElement>) => {
        const target = e.target as HTMLTextAreaElement;
        setCursorPosition(target.selectionStart);
        // Update file mentions based on new cursor position
        if (!slashCommands.isActive) {
            fileMentions.update(value, target.selectionStart);
        }
    }, [slashCommands.isActive, fileMentions, value]);

    return (
        <div className={styles.askContent}>
            {data.question && (
                <div className={styles.questionBubble}>
                    <div className={styles.questionAvatar}><Logo size={18} /></div>
                    <div className={styles.questionContent}>
                        <p className={styles.question} style={{ whiteSpace: 'pre-wrap' }}>{parseNewlines(data.question)}</p>
                    </div>
                </div>
            )}

            <div className={styles.userInputArea}>
                {attachments.length > 0 && (
                    <AttachmentsList
                        attachments={attachments}
                        onRemove={removeAttachment}
                        compact
                    />
                )}

                <div
                    className={`${styles.textareaWrapper} ${isDragOver ? styles.dragOver : ''}`}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    onDragEnter={(e) => { e.preventDefault(); e.stopPropagation(); }}
                >
                    {slashCommands.isActive && (
                        <SlashCommandDropdown
                            matches={slashCommands.matches}
                            selectedIndex={slashCommands.selectedIndex}
                            onSelect={handleSlashCommandSelect}
                        />
                    )}
                    {fileMentions.isActive && !slashCommands.isActive && (
                        <FileMentionDropdown
                            matches={fileMentions.matches}
                            selectedIndex={fileMentions.selectedIndex}
                            onSelect={handleFileMentionSelect}
                            isLoading={fileMentions.isLoading}
                        />
                    )}
                    {isDragOver && (
                        <div className={styles.dropIndicator}>
                            <Icon name="cloud-upload" />
                            <span>Drop files here</span>
                        </div>
                    )}
                    <textarea
                        ref={textareaRef}
                        className={`${styles.chatTextarea} ${slashCommands.isActive || fileMentions.isActive ? styles.slashActive : ''}`}
                        placeholder={data.inputLabel ?? 'Type / for commands, @ for files, ↑↓ for history'}
                        value={value}
                        onChange={handleTextareaChange}
                        onSelect={handleTextareaSelect}
                        onPaste={(e) => { if (!formatPaste.tryFormatPaste(e)) handlePaste(e); }}
                        onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); handleDragOver(e); }}
                        onDrop={(e) => { e.preventDefault(); e.stopPropagation(); handleDrop(e); }}
                        onKeyDown={handleTextareaKeyDown}
                        rows={1}
                        autoFocus
                    />
                </div>

                <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    className={styles.hiddenInput}
                    onChange={handleFileSelect}
                    accept="image/*,.txt,.md,.json,.js,.ts,.tsx,.jsx,.py,.rs,.go,.java,.cpp,.c,.cs,.rb,.php,.swift,.kt,.yaml,.yml,.xml,.html,.css,.scss,.sql,.sh"
                />

                {error && (
                    <div className={styles.errorMessage}>
                        <Icon name="warning" />
                        <span>{error}</span>
                    </div>
                )}

                <div className={styles.chatInputFooter}>
                    <div className={styles.footerLeft}>
                        <AttachmentActions
                            onOpenFilePicker={openFilePicker}
                            attachmentCount={attachments.length}
                            maxAttachments={MAX_ATTACHMENTS}
                        />
                        <span className={styles.inputHint}>
                            Enter to send · / for commands · @ for files
                        </span>
                    </div>
                    <button
                        className={styles.chatSendButton}
                        onClick={handleSubmit}
                        disabled={!value.trim() && attachments.length === 0}
                        title="Send"
                    >
                        <Icon name="send" />
                    </button>
                </div>
            </div>
        </div>
    );
}

function MenuContent({ request, data, onRespond, onCancel }: ContentProps & { data: MenuRequestData }) {
    const [customValue, setCustomValue] = useState('');
    const [cursorPosition, setCursorPosition] = useState(0);
    const [showCustomInput, setShowCustomInput] = useState(false);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const inputHistory = useInputHistory();
    const fileMentions = useFileMentions();
    const formatPaste = useFormattedPaste(textareaRef, setCustomValue, setCursorPosition);
    const {
        attachments, isDragOver, error, fileInputRef,
        removeAttachment, handlePaste, handleDragOver, handleDragLeave,
        handleDrop, handleFileSelect, openFilePicker, clearAttachments,
    } = useAttachments();

    const handleSelect = useCallback((index: number, option: string) => {
        onRespond(request.id, {
            selectedIndex: index,
            selectedOption: option,
            isCustom: false,
            cancelled: false,
        });
    }, [request.id, onRespond]);

    const handleCustomSubmit = useCallback(() => {
        const trimmed = customValue.trim();
        if (!trimmed && attachments.length === 0) return;
        onRespond(request.id, {
            selectedIndex: -1,
            selectedOption: trimmed,
            isCustom: true,
            cancelled: false,
            attachments: serializeAttachments(attachments),
        });
        clearAttachments();
        fileMentions.cancel();
    }, [request.id, customValue, attachments, onRespond, clearAttachments, fileMentions]);

    const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const newValue = e.target.value;
        const newCursor = e.target.selectionStart;
        setCustomValue(newValue);
        setCursorPosition(newCursor);
        inputHistory.resetNavigation();

        // Update file mention matches
        fileMentions.update(newValue, newCursor);

        e.target.style.height = 'auto';
        e.target.style.height = Math.min(e.target.scrollHeight, 240) + 'px';
    };

    const handleCustomKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        // Handle file mention navigation first (higher priority when active)
        if (fileMentions.isActive) {
            if (e.key === 'ArrowUp') {
                e.preventDefault();
                fileMentions.moveUp();
                return;
            }
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                fileMentions.moveDown();
                return;
            }
            if (e.key === 'Tab' || e.key === 'Enter') {
                e.preventDefault();
                const { text, newCursor } = fileMentions.complete(customValue, cursorPosition);
                setCustomValue(text);
                setCursorPosition(newCursor);
                setTimeout(() => {
                    if (textareaRef.current) {
                        textareaRef.current.selectionStart = newCursor;
                        textareaRef.current.selectionEnd = newCursor;
                    }
                }, 0);
                return;
            }
            if (e.key === 'Escape') {
                e.preventDefault();
                fileMentions.cancel();
                return;
            }
        }

        // Handle history navigation
        if (inputHistory.handleKeyDown(e, customValue, setCustomValue)) {
            return;
        }
        // Handle submit (only when file mentions not active)
        if (e.key === 'Enter' && !e.shiftKey && !fileMentions.isActive) {
            e.preventDefault();
            handleCustomSubmit();
        }
    };

    const handleFileMentionSelect = useCallback((_file: { path: string }) => {
        const { text, newCursor } = fileMentions.complete(customValue, cursorPosition);
        setCustomValue(text);
        setCursorPosition(newCursor);
        setTimeout(() => {
            if (textareaRef.current) {
                textareaRef.current.selectionStart = newCursor;
                textareaRef.current.selectionEnd = newCursor;
                textareaRef.current.focus();
            }
        }, 0);
    }, [fileMentions, customValue, cursorPosition]);

    // Track cursor position on click/selection
    const handleTextareaSelect = useCallback((e: React.SyntheticEvent<HTMLTextAreaElement>) => {
        const target = e.target as HTMLTextAreaElement;
        setCursorPosition(target.selectionStart);
        fileMentions.update(customValue, target.selectionStart);
    }, [fileMentions, customValue]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
                if (e.key === 'Escape') {
                    if (fileMentions.isActive) {
                        fileMentions.cancel();
                    } else {
                        setShowCustomInput(false);
                        (e.target as HTMLElement).blur();
                    }
                }
                return;
            }
            if (e.key === 'Escape') { onCancel(request.id); return; }
            const num = parseInt(e.key);
            if (num >= 1 && num <= 9 && num <= data.options.length) handleSelect(num - 1, data.options[num - 1]);
            if (e.key === 'c' || e.key === 'C') setShowCustomInput(true);
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [request.id, data.options, handleSelect, onCancel, fileMentions]);

    return (
        <div className={styles.menuContent}>
            <div className={styles.questionBubble}>
                <div className={styles.questionAvatar}><Logo size={18} /></div>
                <div className={styles.questionContent}>
                    <p className={styles.question} style={{ whiteSpace: 'pre-wrap' }}>{parseNewlines(data.question)}</p>
                </div>
            </div>

            <div className={styles.userInputArea}>
                <div className={styles.options}>
                    {data.options.map((option, index) => (
                        <button key={index} className={styles.optionButton} onClick={() => handleSelect(index, option)}>
                            <span className={styles.optionNumber}>{index + 1}</span>
                            <span className={styles.optionText}>{option}</span>
                        </button>
                    ))}
                </div>

                {!showCustomInput ? (
                    <button className={styles.customToggle} onClick={() => setShowCustomInput(true)}>
                        <Icon name="edit" />
                        <span>Custom response</span>
                        <span className={styles.shortcutHint}>C</span>
                    </button>
                ) : (
                    <div
                        className={`${styles.customInputContainer} ${isDragOver ? styles.dragOver : ''}`}
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                    >
                        <DragOverlay visible={isDragOver} />

                        {attachments.length > 0 && (
                            <AttachmentsList attachments={attachments} onRemove={removeAttachment} compact />
                        )}

                        <div className={styles.customInputWrapper}>
                            {fileMentions.isActive && (
                                <FileMentionDropdown
                                    matches={fileMentions.matches}
                                    selectedIndex={fileMentions.selectedIndex}
                                    onSelect={handleFileMentionSelect}
                                    isLoading={fileMentions.isLoading}
                                />
                            )}
                            <textarea
                                ref={textareaRef}
                                className={`${styles.customInput} ${fileMentions.isActive ? styles.slashActive : ''}`}
                                placeholder="Type your message... @ for files, ↑↓ for history"
                                value={customValue}
                                onChange={handleTextareaChange}
                                onSelect={handleTextareaSelect}
                                onPaste={(e) => { if (!formatPaste.tryFormatPaste(e)) handlePaste(e); }}
                                onKeyDown={handleCustomKeyDown}
                                rows={1}
                                autoFocus
                            />
                            <AttachmentActions
                                onOpenFilePicker={openFilePicker}
                                attachmentCount={attachments.length}
                                maxAttachments={MAX_ATTACHMENTS}
                            />
                            <button
                                className={styles.sendButton}
                                onClick={handleCustomSubmit}
                                disabled={!customValue.trim() && attachments.length === 0}
                                title="Send"
                            >
                                <Icon name="send" />
                            </button>
                        </div>

                        <input
                            ref={fileInputRef}
                            type="file"
                            multiple
                            className={styles.hiddenInput}
                            onChange={handleFileSelect}
                        />
                    </div>
                )}

                {error && (
                    <div className={styles.errorMessage}>
                        <Icon name="warning" /><span>{error}</span>
                    </div>
                )}

                <p className={styles.shortcutHintText}>
                    Press 1-{Math.min(data.options.length, 9)} to select · C for custom · @ for files · ↑↓ for history
                </p>
            </div>
        </div>
    );
}

function ConfirmContent({ request, data, onRespond, onCancel }: ContentProps & { data: ConfirmRequestData }) {
    const [customValue, setCustomValue] = useState('');
    const [cursorPosition, setCursorPosition] = useState(0);
    const [showCustomInput, setShowCustomInput] = useState(false);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const inputHistory = useInputHistory();
    const fileMentions = useFileMentions();
    const formatPaste = useFormattedPaste(textareaRef, setCustomValue, setCursorPosition);
    const {
        attachments, isDragOver, error, fileInputRef,
        removeAttachment, handlePaste, handleDragOver, handleDragLeave,
        handleDrop, handleFileSelect, openFilePicker, clearAttachments,
    } = useAttachments();

    const handleConfirm = useCallback((confirmed: boolean) => {
        onRespond(request.id, { confirmed, cancelled: false });
    }, [request.id, onRespond]);

    const handleCustomSubmit = useCallback(() => {
        const trimmed = customValue.trim();
        if (!trimmed && attachments.length === 0) return;
        onRespond(request.id, {
            confirmed: false,
            customResponse: trimmed,
            isCustom: true,
            cancelled: false,
            attachments: serializeAttachments(attachments),
        });
        clearAttachments();
        fileMentions.cancel();
    }, [request.id, customValue, attachments, onRespond, clearAttachments, fileMentions]);

    const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const newValue = e.target.value;
        const newCursor = e.target.selectionStart;
        setCustomValue(newValue);
        setCursorPosition(newCursor);
        inputHistory.resetNavigation();

        // Update file mention matches
        fileMentions.update(newValue, newCursor);

        e.target.style.height = 'auto';
        e.target.style.height = Math.min(e.target.scrollHeight, 240) + 'px';
    };

    const handleCustomKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        // Handle file mention navigation first (higher priority when active)
        if (fileMentions.isActive) {
            if (e.key === 'ArrowUp') {
                e.preventDefault();
                fileMentions.moveUp();
                return;
            }
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                fileMentions.moveDown();
                return;
            }
            if (e.key === 'Tab' || e.key === 'Enter') {
                e.preventDefault();
                const { text, newCursor } = fileMentions.complete(customValue, cursorPosition);
                setCustomValue(text);
                setCursorPosition(newCursor);
                setTimeout(() => {
                    if (textareaRef.current) {
                        textareaRef.current.selectionStart = newCursor;
                        textareaRef.current.selectionEnd = newCursor;
                    }
                }, 0);
                return;
            }
            if (e.key === 'Escape') {
                e.preventDefault();
                fileMentions.cancel();
                return;
            }
        }

        // Handle history navigation
        if (inputHistory.handleKeyDown(e, customValue, setCustomValue)) {
            return;
        }
        // Handle submit (only when file mentions not active)
        if (e.key === 'Enter' && !e.shiftKey && !fileMentions.isActive) {
            e.preventDefault();
            handleCustomSubmit();
        }
    };

    const handleFileMentionSelect = useCallback((_file: { path: string }) => {
        const { text, newCursor } = fileMentions.complete(customValue, cursorPosition);
        setCustomValue(text);
        setCursorPosition(newCursor);
        setTimeout(() => {
            if (textareaRef.current) {
                textareaRef.current.selectionStart = newCursor;
                textareaRef.current.selectionEnd = newCursor;
                textareaRef.current.focus();
            }
        }, 0);
    }, [fileMentions, customValue, cursorPosition]);

    // Track cursor position on click/selection
    const handleTextareaSelect = useCallback((e: React.SyntheticEvent<HTMLTextAreaElement>) => {
        const target = e.target as HTMLTextAreaElement;
        setCursorPosition(target.selectionStart);
        fileMentions.update(customValue, target.selectionStart);
    }, [fileMentions, customValue]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
                if (e.key === 'Escape') {
                    if (fileMentions.isActive) {
                        fileMentions.cancel();
                    } else {
                        setShowCustomInput(false);
                        (e.target as HTMLElement).blur();
                    }
                }
                return;
            }
            if (e.key === 'Escape') { onCancel(request.id); return; }
            if (e.key === 'y' || e.key === 'Y') handleConfirm(true);
            if (e.key === 'n' || e.key === 'N') handleConfirm(false);
            if (e.key === 'c' || e.key === 'C') setShowCustomInput(true);
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [request.id, handleConfirm, onCancel, fileMentions]);

    return (
        <div className={styles.confirmContent}>
            <div className={styles.questionBubble}>
                <div className={styles.questionAvatar}><Logo size={18} /></div>
                <div className={styles.questionContent}>
                    <p className={styles.question} style={{ whiteSpace: 'pre-wrap' }}>{parseNewlines(data.question)}</p>
                </div>
            </div>

            <div className={styles.userInputArea}>
                <div className={styles.confirmButtons}>
                    <Button onClick={() => handleConfirm(true)}>
                        <span className={styles.buttonShortcut}>Y</span>
                        {data.yesLabel ?? 'Yes'}
                    </Button>
                    <Button variant="secondary" onClick={() => handleConfirm(false)}>
                        <span className={styles.buttonShortcut}>N</span>
                        {data.noLabel ?? 'No'}
                    </Button>
                </div>

                {!showCustomInput ? (
                    <button className={styles.customToggle} onClick={() => setShowCustomInput(true)}>
                        <Icon name="edit" />
                        <span>Custom response</span>
                        <span className={styles.shortcutHint}>C</span>
                    </button>
                ) : (
                    <div
                        className={`${styles.customInputContainer} ${isDragOver ? styles.dragOver : ''}`}
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                    >
                        <DragOverlay visible={isDragOver} />

                        {attachments.length > 0 && (
                            <AttachmentsList attachments={attachments} onRemove={removeAttachment} compact />
                        )}

                        <div className={styles.customInputWrapper}>
                            {fileMentions.isActive && (
                                <FileMentionDropdown
                                    matches={fileMentions.matches}
                                    selectedIndex={fileMentions.selectedIndex}
                                    onSelect={handleFileMentionSelect}
                                    isLoading={fileMentions.isLoading}
                                />
                            )}
                            <textarea
                                ref={textareaRef}
                                className={`${styles.customInput} ${fileMentions.isActive ? styles.slashActive : ''}`}
                                placeholder="Type your message... @ for files, ↑↓ for history"
                                value={customValue}
                                onChange={handleTextareaChange}
                                onSelect={handleTextareaSelect}
                                onPaste={(e) => { if (!formatPaste.tryFormatPaste(e)) handlePaste(e); }}
                                onKeyDown={handleCustomKeyDown}
                                rows={1}
                                autoFocus
                            />
                            <AttachmentActions
                                onOpenFilePicker={openFilePicker}
                                attachmentCount={attachments.length}
                                maxAttachments={MAX_ATTACHMENTS}
                            />
                            <button
                                className={styles.sendButton}
                                onClick={handleCustomSubmit}
                                disabled={!customValue.trim() && attachments.length === 0}
                                title="Send"
                            >
                                <Icon name="send" />
                            </button>
                        </div>

                        <input
                            ref={fileInputRef}
                            type="file"
                            multiple
                            className={styles.hiddenInput}
                            onChange={handleFileSelect}
                        />
                    </div>
                )}

                {error && (
                    <div className={styles.errorMessage}>
                        <Icon name="warning" /><span>{error}</span>
                    </div>
                )}

                <p className={styles.shortcutHintText}>
                    Press Y for yes · N for no · C for custom · @ for files · ↑↓ for history
                </p>
            </div>
        </div>
    );
}

function PlanReviewContent({ request, data, onRespond, onCancel }: ContentProps & { data: PlanReviewRequestData }) {
    const [feedback, setFeedback] = useState('');
    const [feedbackCursor, setFeedbackCursor] = useState(0);
    const [customValue, setCustomValue] = useState('');
    const [customCursor, setCustomCursor] = useState(0);
    const [showCustomInput, setShowCustomInput] = useState(false);
    const [isExpanded, setIsExpanded] = useState(true);
    const [activeInput, setActiveInput] = useState<'feedback' | 'custom'>('feedback');
    const feedbackRef = useRef<HTMLTextAreaElement>(null);
    const customRef = useRef<HTMLTextAreaElement>(null);
    const showHeader = Boolean(data.title || data.mode);
    const fileMentions = useFileMentions();
    const feedbackFormatPaste = useFormattedPaste(feedbackRef, setFeedback, setFeedbackCursor);
    const customFormatPaste = useFormattedPaste(customRef, setCustomValue, setCustomCursor);
    const {
        attachments, isDragOver, error, fileInputRef,
        removeAttachment, handlePaste, handleDragOver, handleDragLeave,
        handleDrop, handleFileSelect, openFilePicker, clearAttachments,
    } = useAttachments();

    const handleApprove = useCallback((approved: boolean) => {
        onRespond(request.id, {
            approved,
            feedback: feedback.trim() || undefined,
            cancelled: false,
            attachments: serializeAttachments(attachments),
        });
        clearAttachments();
        fileMentions.cancel();
    }, [request.id, feedback, attachments, onRespond, clearAttachments, fileMentions]);

    const handleRequestChanges = useCallback(() => {
        const trimmed = feedback.trim();
        if (!trimmed && attachments.length === 0) return;
        onRespond(request.id, {
            approved: false,
            feedback: trimmed,
            cancelled: false,
            attachments: serializeAttachments(attachments),
        });
        clearAttachments();
        fileMentions.cancel();
    }, [request.id, feedback, attachments, onRespond, clearAttachments, fileMentions]);

    const handleCustomSubmit = useCallback(() => {
        const trimmed = customValue.trim();
        if (!trimmed && attachments.length === 0) return;
        onRespond(request.id, {
            approved: false,
            customResponse: trimmed,
            isCustom: true,
            cancelled: false,
            attachments: serializeAttachments(attachments),
        });
        clearAttachments();
        fileMentions.cancel();
    }, [request.id, customValue, attachments, onRespond, clearAttachments, fileMentions]);

    const handleFeedbackChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const newValue = e.target.value;
        const newCursor = e.target.selectionStart;
        setFeedback(newValue);
        setFeedbackCursor(newCursor);
        setActiveInput('feedback');
        fileMentions.update(newValue, newCursor);
    };

    const handleFeedbackKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (fileMentions.isActive) {
            if (e.key === 'ArrowUp') {
                e.preventDefault();
                fileMentions.moveUp();
                return;
            }
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                fileMentions.moveDown();
                return;
            }
            if (e.key === 'Tab' || e.key === 'Enter') {
                e.preventDefault();
                const { text, newCursor } = fileMentions.complete(feedback, feedbackCursor);
                setFeedback(text);
                setFeedbackCursor(newCursor);
                setTimeout(() => {
                    if (feedbackRef.current) {
                        feedbackRef.current.selectionStart = newCursor;
                        feedbackRef.current.selectionEnd = newCursor;
                    }
                }, 0);
                return;
            }
            if (e.key === 'Escape') {
                e.preventDefault();
                fileMentions.cancel();
                return;
            }
        }
    };

    const handleFeedbackSelect = useCallback((e: React.SyntheticEvent<HTMLTextAreaElement>) => {
        const target = e.target as HTMLTextAreaElement;
        setFeedbackCursor(target.selectionStart);
        setActiveInput('feedback');
        fileMentions.update(feedback, target.selectionStart);
    }, [fileMentions, feedback]);

    const handleCustomChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const newValue = e.target.value;
        const newCursor = e.target.selectionStart;
        setCustomValue(newValue);
        setCustomCursor(newCursor);
        setActiveInput('custom');
        fileMentions.update(newValue, newCursor);
        e.target.style.height = 'auto';
        e.target.style.height = Math.min(e.target.scrollHeight, 240) + 'px';
    };

    const handleCustomKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (fileMentions.isActive) {
            if (e.key === 'ArrowUp') {
                e.preventDefault();
                fileMentions.moveUp();
                return;
            }
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                fileMentions.moveDown();
                return;
            }
            if (e.key === 'Tab' || e.key === 'Enter') {
                e.preventDefault();
                const { text, newCursor } = fileMentions.complete(customValue, customCursor);
                setCustomValue(text);
                setCustomCursor(newCursor);
                setTimeout(() => {
                    if (customRef.current) {
                        customRef.current.selectionStart = newCursor;
                        customRef.current.selectionEnd = newCursor;
                    }
                }, 0);
                return;
            }
            if (e.key === 'Escape') {
                e.preventDefault();
                fileMentions.cancel();
                return;
            }
        }
        if (e.key === 'Enter' && !e.shiftKey && !fileMentions.isActive) {
            e.preventDefault();
            handleCustomSubmit();
        }
    };

    const handleCustomSelect = useCallback((e: React.SyntheticEvent<HTMLTextAreaElement>) => {
        const target = e.target as HTMLTextAreaElement;
        setCustomCursor(target.selectionStart);
        setActiveInput('custom');
        fileMentions.update(customValue, target.selectionStart);
    }, [fileMentions, customValue]);

    const handleFileMentionSelect = useCallback((_file: { path: string }) => {
        if (activeInput === 'feedback') {
            const { text, newCursor } = fileMentions.complete(feedback, feedbackCursor);
            setFeedback(text);
            setFeedbackCursor(newCursor);
            setTimeout(() => {
                if (feedbackRef.current) {
                    feedbackRef.current.selectionStart = newCursor;
                    feedbackRef.current.selectionEnd = newCursor;
                    feedbackRef.current.focus();
                }
            }, 0);
        } else {
            const { text, newCursor } = fileMentions.complete(customValue, customCursor);
            setCustomValue(text);
            setCustomCursor(newCursor);
            setTimeout(() => {
                if (customRef.current) {
                    customRef.current.selectionStart = newCursor;
                    customRef.current.selectionEnd = newCursor;
                    customRef.current.focus();
                }
            }, 0);
        }
    }, [fileMentions, activeInput, feedback, feedbackCursor, customValue, customCursor]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLInputElement) {
                if (e.key === 'Escape') {
                    if (fileMentions.isActive) {
                        fileMentions.cancel();
                    } else {
                        setShowCustomInput(false);
                        (e.target as HTMLElement).blur();
                    }
                }
                return;
            }
            if (e.key === 'Escape') { onCancel(request.id); return; }
            if (e.key === 'Enter' && e.ctrlKey) handleApprove(true);
            if (e.key === 'c' || e.key === 'C') setShowCustomInput(true);
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [request.id, handleApprove, onCancel, fileMentions]);

    return (
        <div className={styles.planReviewContainer}>
            {/* Plan Content Area - Large scrollable */}
            <div className={styles.planContentArea}>
                {showHeader && (
                    <div className={styles.planReviewHeader}>
                        <div className={styles.planTitleRow}>
                            <Icon name="file-text" className={styles.planIcon} />
                            <h3 className={styles.planReviewTitle}>{data.title ?? 'Plan Review'}</h3>
                            {data.mode && (
                                <span className={styles.planModeBadge}>
                                    {data.mode === 'walkthrough' ? 'Walkthrough' : 'Review'}
                                </span>
                            )}
                        </div>
                        <button
                            className={styles.expandToggle}
                            onClick={() => setIsExpanded(!isExpanded)}
                            title={isExpanded ? 'Collapse' : 'Expand'}
                        >
                            <Icon name={isExpanded ? 'chevron-up' : 'chevron-down'} />
                        </button>
                    </div>
                )}

                <div className={`${styles.planMarkdownWrapper} ${isExpanded ? styles.expanded : styles.collapsed}`}>
                    <Markdown content={parseNewlines(data.plan)} className={styles.planMarkdown} />
                </div>
            </div>

            {/* Actions Area - Fixed at bottom */}
            <div
                className={`${styles.planActionsArea} ${isDragOver ? styles.dragOver : ''}`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
            >
                <DragOverlay visible={isDragOver} />

                {attachments.length > 0 && (
                    <AttachmentsList attachments={attachments} onRemove={removeAttachment} compact />
                )}

                <div className={styles.feedbackInputWrapper}>
                    {fileMentions.isActive && activeInput === 'feedback' && (
                        <FileMentionDropdown
                            matches={fileMentions.matches}
                            selectedIndex={fileMentions.selectedIndex}
                            onSelect={handleFileMentionSelect}
                            isLoading={fileMentions.isLoading}
                        />
                    )}
                    <textarea
                        ref={feedbackRef}
                        className={`${styles.chatTextarea} ${fileMentions.isActive && activeInput === 'feedback' ? styles.slashActive : ''}`}
                        rows={2}
                        placeholder="Feedback (required for changes)... @ for files, Ctrl+V to paste"
                        value={feedback}
                        onChange={handleFeedbackChange}
                        onSelect={handleFeedbackSelect}
                        onPaste={(e) => { if (!feedbackFormatPaste.tryFormatPaste(e)) handlePaste(e); }}
                        onKeyDown={handleFeedbackKeyDown}
                    />
                    <AttachmentActions
                        onOpenFilePicker={openFilePicker}
                        attachmentCount={attachments.length}
                        maxAttachments={MAX_ATTACHMENTS}
                    />
                </div>

                <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    className={styles.hiddenInput}
                    onChange={handleFileSelect}
                />

                <div className={styles.planActionButtons}>
                    <Button size="small" onClick={() => handleApprove(true)}>
                        <Icon name="check" /> Approve
                    </Button>
                    <Button
                        variant="secondary"
                        size="small"
                        onClick={handleRequestChanges}
                        disabled={!feedback.trim() && attachments.length === 0}
                    >
                        <Icon name="edit" /> Request Changes
                    </Button>
                    <Button variant="ghost" size="small" onClick={() => handleApprove(false)}>
                        <Icon name="close" /> Reject
                    </Button>
                </div>

                {!showCustomInput ? (
                    <button className={styles.customToggle} onClick={() => setShowCustomInput(true)}>
                        <Icon name="edit" />
                        <span>Custom response</span>
                        <span className={styles.shortcutHint}>C</span>
                    </button>
                ) : (
                    <div className={styles.customInputWrapper}>
                        {fileMentions.isActive && activeInput === 'custom' && (
                            <FileMentionDropdown
                                matches={fileMentions.matches}
                                selectedIndex={fileMentions.selectedIndex}
                                onSelect={handleFileMentionSelect}
                                isLoading={fileMentions.isLoading}
                            />
                        )}
                        <textarea
                            ref={customRef}
                            className={`${styles.customInput} ${fileMentions.isActive && activeInput === 'custom' ? styles.slashActive : ''}`}
                            placeholder="Type your message... @ for files"
                            value={customValue}
                            onChange={handleCustomChange}
                            onSelect={handleCustomSelect}
                            onPaste={(e) => { if (!customFormatPaste.tryFormatPaste(e)) handlePaste(e); }}
                            onKeyDown={handleCustomKeyDown}
                            rows={1}
                            autoFocus
                        />
                        <button
                            className={styles.sendButton}
                            onClick={handleCustomSubmit}
                            disabled={!customValue.trim() && attachments.length === 0}
                            title="Send"
                        >
                            <Icon name="send" />
                        </button>
                    </div>
                )}

                {error && (
                    <div className={styles.errorMessage}>
                        <Icon name="warning" /><span>{error}</span>
                    </div>
                )}

                <p className={styles.shortcutHintText}>
                    Ctrl+Enter to approve · C for custom · @ for files · Ctrl+V to paste
                </p>
            </div>
        </div>
    );
}
