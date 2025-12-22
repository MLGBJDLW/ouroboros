import { useState, useEffect, useCallback } from 'react';
import { usePendingRequests } from '../../hooks/usePendingRequests';
import { Button } from '../../components/Button';
import { Badge } from '../../components/Badge';
import { Icon } from '../../components/Icon';
import { formatRelativeTime, formatRequestType } from '../../utils/formatters';
import type { PendingRequest, AskRequestData, MenuRequestData, ConfirmRequestData, PlanReviewRequestData } from '../../types/requests';
import styles from './PendingRequests.module.css';

export function PendingRequests() {
    const { requests, respond, cancel } = usePendingRequests();

    if (requests.length === 0) {
        return (
            <div className={styles.empty}>
                <Icon name="comment-discussion" className={styles.emptyIcon} />
                <h3>No pending requests</h3>
                <p className={styles.emptyHint}>
                    Waiting for agent input...
                </p>
            </div>
        );
    }

    // Only show the most recent request (centered)
    const currentRequest = requests[requests.length - 1];

    return (
        <div className={styles.container}>
            <div className={styles.listItem}>
                <RequestChatBubble
                    request={currentRequest}
                    onRespond={respond}
                    onCancel={cancel}
                />
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

    return (
        <div className={styles.askContent}>
            {data.question && <p className={styles.question}>{data.question}</p>}
            <div className={styles.actions}>
                <textarea
                    className={styles.textarea}
                    placeholder={data.inputLabel ?? 'Type your answer...'}
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleSubmit();
                        }
                    }}
                    rows={3}
                    autoFocus
                />
                <div className={styles.inputFooter}>
                    <span className={styles.inputHint}>Enter to send · Shift+Enter for new line · Esc to cancel</span>
                    <Button size="small" onClick={handleSubmit} disabled={!value.trim()}>
                        Send
                    </Button>
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
            <p className={styles.question}>{data.question}</p>
            <div className={styles.actions}>
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
                    <div className={styles.customInputRow}>
                        <input
                            type="text"
                            className={styles.input}
                            placeholder="Type custom response..."
                            value={customValue}
                            onChange={(e) => setCustomValue(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') handleCustomSubmit();
                            }}
                            autoFocus
                        />
                        <Button size="small" onClick={handleCustomSubmit} disabled={!customValue.trim()}>
                            Send
                        </Button>
                    </div>
                )}
                
                <p className={styles.shortcutHintText}>Press 1-{Math.min(data.options.length, 9)} to select · C for custom · Esc to cancel</p>
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
            <p className={styles.question}>{data.question}</p>
            <div className={styles.actions}>
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
                    <div className={styles.customInputRow}>
                        <input
                            type="text"
                            className={styles.input}
                            placeholder="Type custom response..."
                            value={customValue}
                            onChange={(e) => setCustomValue(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') handleCustomSubmit();
                            }}
                            autoFocus
                        />
                        <Button size="small" onClick={handleCustomSubmit} disabled={!customValue.trim()}>
                            Send
                        </Button>
                    </div>
                )}
                
                <p className={styles.shortcutHintText}>Press Y for yes · N for no · C for custom · Esc to cancel</p>
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
            <pre className={styles.planText}>{data.plan}</pre>
            <div className={styles.actions}>
                <textarea
                    className={styles.textarea}
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
                    <div className={styles.customInputRow}>
                        <input
                            type="text"
                            className={styles.input}
                            placeholder="Type custom response..."
                            value={customValue}
                            onChange={(e) => setCustomValue(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') handleCustomSubmit();
                            }}
                            autoFocus
                        />
                        <Button size="small" onClick={handleCustomSubmit} disabled={!customValue.trim()}>
                            Send
                        </Button>
                    </div>
                )}
                
                <p className={styles.shortcutHintText}>Ctrl+Enter to approve · C for custom · Esc to cancel</p>
            </div>
        </div>
    );
}
