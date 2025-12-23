import { useState, useEffect, useCallback } from 'react';
import { usePendingRequests } from '../../hooks/usePendingRequests';
import { useAppContext } from '../../context/AppContext';
import { Button } from '../../components/Button';
import { Badge } from '../../components/Badge';
import { Icon } from '../../components/Icon';
import { Logo } from '../../components/Logo';
import { formatRelativeTime, formatRequestType } from '../../utils/formatters';
import { AGENT_DISPLAY_NAMES } from '../../types/agent';
import type { PendingRequest, AskRequestData, MenuRequestData, ConfirmRequestData, PlanReviewRequestData } from '../../types/requests';
import styles from './PendingRequests.module.css';

/** Parse escaped newlines in text (handles both \n and \\n) */
function parseNewlines(text: string): string {
    // First replace \\n (escaped backslash + n) with actual newline
    // Then replace \n (backslash + n literal) with actual newline
    return text.replace(/\\n/g, '\n');
}

interface SentMessage {
    id: string;
    text: string;
    type: 'ask' | 'menu' | 'confirm' | 'plan_review';
    timestamp: number;
}

export function PendingRequests() {
    const { requests, respond, cancel } = usePendingRequests();
    const { state } = useAppContext();
    const [sentMessage, setSentMessage] = useState<SentMessage | null>(null);
    const [showAllActivity, setShowAllActivity] = useState(false);

    // Clear sent message after fade out animation
    useEffect(() => {
        if (sentMessage) {
            const timer = setTimeout(() => {
                setSentMessage(null);
            }, 4000); // 4 seconds total (includes fade animation)
            return () => clearTimeout(timer);
        }
    }, [sentMessage]);

    // Wrap respond to capture the sent message
    const handleRespond = useCallback((id: string, response: unknown) => {
        // Find the request to get its type
        const request = requests.find(r => r.id === id);
        const displayText = extractDisplayText(response);
        if (displayText && request) {
            setSentMessage({
                id: `sent-${Date.now()}`,
                text: displayText,
                type: request.type,
                timestamp: Date.now(),
            });
        }
        respond(id, response);
    }, [requests, respond]);

    // Show sent message bubble if no pending requests
    if (requests.length === 0) {
        return (
            <div className={styles.empty}>
                {/* Agent Activity Box - Always visible */}
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
                        <p className={styles.emptyHint}>
                            Waiting for agent input...
                        </p>
                    </div>
                )}
            </div>
        );
    }

    // Only show the most recent request (centered)
    const currentRequest = requests[requests.length - 1];

    return (
        <div className={styles.container}>
            {/* Agent Activity Box - Always visible */}
            <AgentActivityBox 
                currentAgent={state.currentAgent}
                handoffHistory={state.handoffHistory}
                showAllActivity={showAllActivity}
                onToggle={() => setShowAllActivity(!showAllActivity)}
            />

            <div className={styles.listItem}>
                <RequestChatBubble
                    request={currentRequest}
                    onRespond={handleRespond}
                    onCancel={cancel}
                />
            </div>
        </div>
    );
}

/** Agent Activity Box Component */
interface AgentActivityBoxProps {
    currentAgent: { name: string; level: 0 | 1 | 2 } | null;
    handoffHistory: Array<{ from: { name: string; level: 0 | 1 | 2 }; to: { name: string; level: 0 | 1 | 2 }; reason?: string }>;
    showAllActivity: boolean;
    onToggle: () => void;
}

function AgentActivityBox({ currentAgent, handoffHistory, showAllActivity, onToggle }: AgentActivityBoxProps) {
    const recentHandoffs = handoffHistory.slice(-5).reverse();
    const hasHandoffs = recentHandoffs.length > 0;

    return (
        <div className={styles.activityBox}>
            <button className={styles.activityHeader} onClick={onToggle}>
                <div className={styles.activityLeft}>
                    <div className={styles.activityIcon}>
                        <Icon name="organization" />
                    </div>
                    <div className={styles.activityInfo}>
                        <span className={styles.activityLabel}>Current Agent</span>
                        <span className={styles.activityAgent}>
                            {currentAgent ? (
                                <>
                                    <span className={styles.agentName}>{getDisplayName(currentAgent.name)}</span>
                                    <span className={styles.agentLevel}>L{currentAgent.level}</span>
                                </>
                            ) : (
                                <span className={styles.agentIdle}>Idle</span>
                            )}
                        </span>
                    </div>
                </div>
                {hasHandoffs && (
                    <Icon 
                        name={showAllActivity ? 'chevron-up' : 'chevron-down'} 
                        className={styles.activityToggle}
                    />
                )}
            </button>
            
            {showAllActivity && hasHandoffs && (
                <div className={styles.activityList}>
                    <div className={styles.activityListHeader}>Recent Handoffs</div>
                    {recentHandoffs.map((handoff, index) => (
                        <div key={index} className={styles.activityItem}>
                            <div className={styles.handoffFlow}>
                                <span className={styles.activityFrom}>
                                    {getDisplayName(handoff.from.name)}
                                    <span className={styles.levelBadge}>L{handoff.from.level}</span>
                                </span>
                                <Icon name="arrow-right" className={styles.activityArrow} />
                                <span className={styles.activityTo}>
                                    {getDisplayName(handoff.to.name)}
                                    <span className={styles.levelBadge}>L{handoff.to.level}</span>
                                </span>
                            </div>
                            {handoff.reason && (
                                <span className={styles.handoffReason}>{handoff.reason}</span>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

function getDisplayName(agentName: string): string {
    return AGENT_DISPLAY_NAMES[agentName] ?? agentName;
}

/** Extract human-readable text from response object */
function extractDisplayText(response: unknown): string | null {
    if (!response || typeof response !== 'object') return null;
    
    const r = response as Record<string, unknown>;
    
    // Ask response
    if (typeof r.response === 'string') {
        return r.response;
    }
    
    // Menu response
    if (typeof r.selectedOption === 'string') {
        return r.isCustom ? r.selectedOption : `Selected: ${r.selectedOption}`;
    }
    
    // Confirm response
    if (typeof r.confirmed === 'boolean') {
        if (r.isCustom && typeof r.customResponse === 'string') {
            return r.customResponse;
        }
        return r.confirmed ? 'Yes' : 'No';
    }
    
    // Plan review response
    if (typeof r.approved === 'boolean') {
        if (r.isCustom && typeof r.customResponse === 'string') {
            return r.customResponse;
        }
        if (r.approved) return 'Approved';
        if (typeof r.feedback === 'string' && r.feedback) {
            return `Rejected: ${r.feedback}`;
        }
        return 'Rejected';
    }
    
    return null;
}

interface SentMessageBubbleProps {
    message: SentMessage;
}

function SentMessageBubble({ message }: SentMessageBubbleProps) {
    const getTypeInfo = () => {
        switch (message.type) {
            case 'ask':
                return { icon: 'comment', label: 'Response', color: 'info' };
            case 'menu':
                return { icon: 'list-selection', label: 'Selection', color: 'success' };
            case 'confirm':
                return { icon: 'check', label: 'Confirmation', color: 'warning' };
            case 'plan_review':
                return { icon: 'file-text', label: 'Review', color: 'info' };
            default:
                return { icon: 'send', label: 'Sent', color: 'info' };
        }
    };

    const typeInfo = getTypeInfo();
    const timeStr = new Date(message.timestamp).toLocaleTimeString([], { 
        hour: '2-digit', 
        minute: '2-digit' 
    });

    return (
        <div className={styles.sentContainer}>
            <div className={`${styles.sentBubble} ${styles[`sent${typeInfo.color.charAt(0).toUpperCase() + typeInfo.color.slice(1)}`]}`}>
                {/* Bubble tail */}
                <div className={styles.sentTail} />
                
                {/* Header with icon and status */}
                <div className={styles.sentHeader}>
                    <div className={styles.sentStatus}>
                        <Icon name="check-all" className={styles.sentCheckIcon} />
                        <span>Sent to Copilot</span>
                    </div>
                    <span className={styles.sentTime}>{timeStr}</span>
                </div>

                {/* Message content */}
                <p className={styles.sentText}>{message.text}</p>

                {/* Footer with type badge */}
                <div className={styles.sentFooter}>
                    <div className={styles.sentTypeBadge}>
                        <Icon name={typeInfo.icon} />
                        <span>{typeInfo.label}</span>
                    </div>
                </div>
            </div>
        </div>
    );
}

interface RequestChatBubbleProps {
    request: PendingRequest;
    onRespond: (id: string, response: unknown) => void;
    onCancel: (id: string) => void;
}

function RequestChatBubble({ request, onRespond, onCancel }: RequestChatBubbleProps) {
    // Get variant class based on request type
    const getTypeVariant = () => {
        switch (request.type) {
            case 'confirm': return styles.confirmType;
            case 'menu': return styles.menuType;
            case 'plan_review': return styles.planType;
            default: return styles.askType;
        }
    };

    return (
        <div className={`${styles.messageBubble} ${getTypeVariant()}`}>
            <div className={styles.header}>
                <Badge variant="info" size="small">{formatRequestType(request.type)}</Badge>
                <span className={styles.agentName}>
                    {request.agentName} (L{request.agentLevel})
                </span>
                <span className={styles.time}>
                    {formatRelativeTime(request.timestamp)}
                </span>
                <button 
                    className={styles.closeButton}
                    onClick={() => onCancel(request.id)}
                    title="Cancel (Esc)"
                >
                    <Icon name="close" />
                </button>
            </div>

            <div className={styles.content}>
                <RequestContent request={request} onRespond={onRespond} onCancel={onCancel} />
            </div>
        </div>
    );
}

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


interface ContentProps {
    request: PendingRequest;
    onRespond: (id: string, response: unknown) => void;
    onCancel: (id: string) => void;
}

function AskContent({ request, data, onRespond, onCancel }: ContentProps & { data: AskRequestData }) {
    const [value, setValue] = useState('');

    const handleSubmit = useCallback(() => {
        if (value.trim()) {
            onRespond(request.id, { response: value, cancelled: false });
        }
    }, [request.id, value, onRespond]);

    // Keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                onCancel(request.id);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [request.id, onCancel]);

    // Auto-resize textarea
    const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setValue(e.target.value);
        e.target.style.height = 'auto';
        e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
    };

    return (
        <div className={styles.askContent}>
            {/* Agent question bubble */}
            {data.question && (
                <div className={styles.questionBubble}>
                    <div className={styles.questionAvatar}>
                        <Logo size={18} />
                    </div>
                    <div className={styles.questionContent}>
                        <p className={styles.question} style={{ whiteSpace: 'pre-wrap' }}>{parseNewlines(data.question)}</p>
                    </div>
                </div>
            )}
            
            {/* User input area */}
            <div className={styles.userInputArea}>
                <textarea
                    className={styles.chatTextarea}
                    placeholder={data.inputLabel ?? 'Type your reply...'}
                    value={value}
                    onChange={handleTextareaChange}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleSubmit();
                        }
                    }}
                    rows={1}
                    autoFocus
                />
                <div className={styles.chatInputFooter}>
                    <span className={styles.inputHint}>Enter to send · Shift+Enter for new line</span>
                    <button 
                        className={styles.chatSendButton} 
                        onClick={handleSubmit} 
                        disabled={!value.trim()}
                        title="Send"
                    >
                        <Logo size={18} />
                    </button>
                </div>
            </div>
        </div>
    );
}

function MenuContent({ request, data, onRespond, onCancel }: ContentProps & { data: MenuRequestData }) {
    const [customValue, setCustomValue] = useState('');
    const [showCustomInput, setShowCustomInput] = useState(false);

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
        if (!trimmed) return;

        onRespond(request.id, {
            selectedIndex: -1,
            selectedOption: trimmed,
            isCustom: true,
            cancelled: false,
        });
    }, [request.id, customValue, onRespond]);

    // Auto-resize textarea
    const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setCustomValue(e.target.value);
        e.target.style.height = 'auto';
        e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
    };

    // Keyboard shortcuts: 1-9 for options, Esc to cancel
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Don't capture if typing in input
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
                if (e.key === 'Escape') {
                    setShowCustomInput(false);
                    (e.target as HTMLElement).blur();
                }
                return;
            }

            if (e.key === 'Escape') {
                onCancel(request.id);
                return;
            }

            // Number keys 1-9 for quick selection
            const num = parseInt(e.key);
            if (num >= 1 && num <= 9 && num <= data.options.length) {
                handleSelect(num - 1, data.options[num - 1]);
            }

            // 'c' for custom input
            if (e.key === 'c' || e.key === 'C') {
                setShowCustomInput(true);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [request.id, data.options, handleSelect, onCancel]);

    return (
        <div className={styles.menuContent}>
            {/* Agent question bubble */}
            <div className={styles.questionBubble}>
                <div className={styles.questionAvatar}>
                    <Logo size={18} />
                </div>
                <div className={styles.questionContent}>
                    <p className={styles.question} style={{ whiteSpace: 'pre-wrap' }}>{parseNewlines(data.question)}</p>
                </div>
            </div>

            {/* Options area */}
            <div className={styles.userInputArea}>
                <div className={styles.options}>
                    {data.options.map((option, index) => (
                        <button
                            key={index}
                            className={styles.optionButton}
                            onClick={() => handleSelect(index, option)}
                        >
                            <span className={styles.optionNumber}>{index + 1}</span>
                            <span className={styles.optionText}>{option}</span>
                        </button>
                    ))}
                </div>
                
                {/* Custom input toggle */}
                {!showCustomInput ? (
                    <button 
                        className={styles.customToggle}
                        onClick={() => setShowCustomInput(true)}
                    >
                        <Icon name="edit" />
                        <span>Custom response</span>
                        <span className={styles.shortcutHint}>C</span>
                    </button>
                ) : (
                    <div className={styles.customInputWrapper}>
                        <textarea
                            className={styles.customInput}
                            placeholder="Type your message..."
                            value={customValue}
                            onChange={handleTextareaChange}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    handleCustomSubmit();
                                }
                            }}
                            rows={1}
                            autoFocus
                        />
                        <button 
                            className={styles.sendButton} 
                            onClick={handleCustomSubmit} 
                            disabled={!customValue.trim()}
                            title="Send"
                        >
                            <Logo size={18} />
                        </button>
                    </div>
                )}
                
                <p className={styles.shortcutHintText}>Press 1-{Math.min(data.options.length, 9)} to select · C for custom · Shift+Enter for new line</p>
            </div>
        </div>
    );
}

function ConfirmContent({ request, data, onRespond, onCancel }: ContentProps & { data: ConfirmRequestData }) {
    const [customValue, setCustomValue] = useState('');
    const [showCustomInput, setShowCustomInput] = useState(false);

    const handleConfirm = useCallback((confirmed: boolean) => {
        onRespond(request.id, { confirmed, cancelled: false });
    }, [request.id, onRespond]);

    const handleCustomSubmit = useCallback(() => {
        const trimmed = customValue.trim();
        if (!trimmed) return;
        onRespond(request.id, {
            confirmed: false,
            customResponse: trimmed,
            isCustom: true,
            cancelled: false,
        });
    }, [request.id, customValue, onRespond]);

    // Auto-resize textarea
    const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setCustomValue(e.target.value);
        e.target.style.height = 'auto';
        e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
    };

    // Keyboard shortcuts: Y for yes, N for no, C for custom, Esc to cancel
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Don't capture if typing in input
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
                if (e.key === 'Escape') {
                    setShowCustomInput(false);
                    (e.target as HTMLElement).blur();
                }
                return;
            }

            if (e.key === 'Escape') {
                onCancel(request.id);
                return;
            }
            if (e.key === 'y' || e.key === 'Y') {
                handleConfirm(true);
            }
            if (e.key === 'n' || e.key === 'N') {
                handleConfirm(false);
            }
            if (e.key === 'c' || e.key === 'C') {
                setShowCustomInput(true);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [request.id, handleConfirm, onCancel]);

    return (
        <div className={styles.confirmContent}>
            {/* Agent question bubble */}
            <div className={styles.questionBubble}>
                <div className={styles.questionAvatar}>
                    <Logo size={18} />
                </div>
                <div className={styles.questionContent}>
                    <p className={styles.question} style={{ whiteSpace: 'pre-wrap' }}>{parseNewlines(data.question)}</p>
                </div>
            </div>

            {/* Response area */}
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
                
                {/* Custom input toggle */}
                {!showCustomInput ? (
                    <button 
                        className={styles.customToggle}
                        onClick={() => setShowCustomInput(true)}
                    >
                        <Icon name="edit" />
                        <span>Custom response</span>
                        <span className={styles.shortcutHint}>C</span>
                    </button>
                ) : (
                    <div className={styles.customInputWrapper}>
                        <textarea
                            className={styles.customInput}
                            placeholder="Type your message..."
                            value={customValue}
                            onChange={handleTextareaChange}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    handleCustomSubmit();
                                }
                            }}
                            rows={1}
                            autoFocus
                        />
                        <button 
                            className={styles.sendButton} 
                            onClick={handleCustomSubmit} 
                            disabled={!customValue.trim()}
                            title="Send"
                        >
                            <Logo size={18} />
                        </button>
                    </div>
                )}
                
                <p className={styles.shortcutHintText}>Press Y for yes · N for no · C for custom · Shift+Enter for new line</p>
            </div>
        </div>
    );
}

function PlanReviewContent({ request, data, onRespond, onCancel }: ContentProps & { data: PlanReviewRequestData }) {
    const [feedback, setFeedback] = useState('');
    const [customValue, setCustomValue] = useState('');
    const [showCustomInput, setShowCustomInput] = useState(false);
    const showHeader = Boolean(data.title || data.mode);

    const handleApprove = useCallback((approved: boolean) => {
        onRespond(request.id, {
            approved,
            feedback: feedback.trim() || undefined,
            cancelled: false,
        });
    }, [request.id, feedback, onRespond]);

    const handleRequestChanges = useCallback(() => {
        const trimmed = feedback.trim();
        if (!trimmed) return;
        onRespond(request.id, {
            approved: false,
            feedback: trimmed,
            cancelled: false,
        });
    }, [request.id, feedback, onRespond]);

    const handleCustomSubmit = useCallback(() => {
        const trimmed = customValue.trim();
        if (!trimmed) return;
        onRespond(request.id, {
            approved: false,
            customResponse: trimmed,
            isCustom: true,
            cancelled: false,
        });
    }, [request.id, customValue, onRespond]);

    // Keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Don't capture if typing in textarea or input
            if (e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLInputElement) {
                if (e.key === 'Escape') {
                    setShowCustomInput(false);
                    (e.target as HTMLElement).blur();
                }
                return;
            }

            if (e.key === 'Escape') {
                onCancel(request.id);
                return;
            }
            // Ctrl+Enter to approve
            if (e.key === 'Enter' && e.ctrlKey) {
                handleApprove(true);
            }
            // C for custom input
            if (e.key === 'c' || e.key === 'C') {
                setShowCustomInput(true);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [request.id, handleApprove, onCancel]);

    return (
        <div className={styles.planContent}>
            {/* Agent plan bubble */}
            <div className={styles.questionBubble}>
                <div className={styles.questionAvatar}>
                    <Logo size={18} />
                </div>
                <div className={styles.planBubbleContent}>
                    {showHeader && (
                        <div className={styles.planHeader}>
                            <h4 className={styles.planTitle}>{data.title ?? 'Plan Review'}</h4>
                            {data.mode && (
                                <span className={styles.planMode}>
                                    {data.mode === 'walkthrough' ? 'Walkthrough' : 'Review'}
                                </span>
                            )}
                        </div>
                    )}
                    <pre className={styles.planText}>{parseNewlines(data.plan)}</pre>
                </div>
            </div>

            {/* Response area */}
            <div className={styles.userInputArea}>
                <textarea
                    className={styles.chatTextarea}
                    rows={2}
                    placeholder="Feedback (required for changes)..."
                    value={feedback}
                    onChange={(e) => setFeedback(e.target.value)}
                />
                <div className={styles.confirmButtons}>
                    <Button size="small" onClick={() => handleApprove(true)}>
                        Approve
                    </Button>
                    <Button
                        variant="secondary"
                        size="small"
                        onClick={handleRequestChanges}
                        disabled={!feedback.trim()}
                    >
                        Request Changes
                    </Button>
                    <Button variant="ghost" size="small" onClick={() => handleApprove(false)}>
                        Reject
                    </Button>
                </div>
                
                {/* Custom input toggle */}
                {!showCustomInput ? (
                    <button 
                        className={styles.customToggle}
                        onClick={() => setShowCustomInput(true)}
                    >
                        <Icon name="edit" />
                        <span>Custom response</span>
                        <span className={styles.shortcutHint}>C</span>
                    </button>
                ) : (
                    <div className={styles.customInputWrapper}>
                        <textarea
                            className={styles.customInput}
                            placeholder="Type your message..."
                            value={customValue}
                            onChange={(e) => {
                                setCustomValue(e.target.value);
                                e.target.style.height = 'auto';
                                e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
                            }}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    handleCustomSubmit();
                                }
                            }}
                            rows={1}
                            autoFocus
                        />
                        <button 
                            className={styles.sendButton} 
                            onClick={handleCustomSubmit} 
                            disabled={!customValue.trim()}
                            title="Send"
                        >
                            <Logo size={18} />
                        </button>
                    </div>
                )}
                
                <p className={styles.shortcutHintText}>Ctrl+Enter to approve · C for custom · Shift+Enter for new line</p>
            </div>
        </div>
    );
}
