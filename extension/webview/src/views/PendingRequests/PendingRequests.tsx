import { useState, useRef, useEffect } from 'react';
import { usePendingRequests } from '../../hooks/usePendingRequests';
import { Button } from '../../components/Button';
import { Badge } from '../../components/Badge';
import { Icon } from '../../components/Icon';
import { formatRelativeTime, formatRequestType } from '../../utils/formatters';
import type { PendingRequest, AskRequestData, MenuRequestData, ConfirmRequestData, PlanReviewRequestData } from '../../types/requests';
import styles from './PendingRequests.module.css';

export function PendingRequests() {
    const { requests, respond, cancel } = usePendingRequests();
    const bottomRef = useRef<HTMLDivElement>(null);

    // Auto-scroll to bottom
    useEffect(() => {
        if (bottomRef.current) {
            bottomRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [requests.length]);

    if (requests.length === 0) {
        return (
            <div className={styles.empty}>
                <Icon name="comment-discussion" className={styles.emptyIcon} />
                <h3>No pending requests</h3>
                <p className={styles.emptyHint}>
                    Ouroboros is idle. Trigger an agent action to see requests here.
                </p>
            </div>
        );
    }

    return (
        <div className={styles.container}>
            {requests.map((request) => (
                <div key={request.id} className={styles.listItem}>
                    <RequestChatBubble
                        request={request}
                        onRespond={respond}
                        onCancel={cancel}
                    />
                </div>
            ))}
            <div ref={bottomRef} />
        </div>
    );
}

interface RequestChatBubbleProps {
    request: PendingRequest;
    onRespond: (id: string, response: unknown) => void;
    onCancel: (id: string) => void;
}

function RequestChatBubble({ request, onRespond, onCancel }: RequestChatBubbleProps) {
    return (
        <div className={styles.messageBubble}>
            <div className={styles.header}>
                <Badge variant="info" size="small">{formatRequestType(request.type)}</Badge>
                <span className={styles.agentName}>
                    {request.agentName} (L{request.agentLevel})
                </span>
                <span className={styles.time}>
                    {formatRelativeTime(request.timestamp)}
                </span>
            </div>

            <div className={styles.content}>
                <RequestContent request={request} onRespond={onRespond} />
            </div>

            <div className={styles.footer}>
                <Button variant="ghost" size="small" onClick={() => onCancel(request.id)}>
                    Cancel
                </Button>
            </div>
        </div>
    );
}

interface RequestContentProps {
    request: PendingRequest;
    onRespond: (id: string, response: unknown) => void;
}

function RequestContent({ request, onRespond }: RequestContentProps) {
    switch (request.type) {
        case 'ask':
            return <AskContent request={request} data={request.data as AskRequestData} onRespond={onRespond} />;
        case 'menu':
            return <MenuContent request={request} data={request.data as MenuRequestData} onRespond={onRespond} />;
        case 'confirm':
            return <ConfirmContent request={request} data={request.data as ConfirmRequestData} onRespond={onRespond} />;
        case 'plan_review':
            return <PlanReviewContent request={request} data={request.data as PlanReviewRequestData} onRespond={onRespond} />;
        default:
            return <p>Unknown request type</p>;
    }
}

function AskContent({ request, data, onRespond }: { request: PendingRequest; data: AskRequestData; onRespond: (id: string, response: unknown) => void }) {
    const [value, setValue] = useState('');

    const handleSubmit = () => {
        onRespond(request.id, { response: value, cancelled: false });
    };

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
                    <span className={styles.inputHint}>Shift+Enter for new line</span>
                    <Button size="small" onClick={handleSubmit} disabled={!value.trim()}>
                        Send
                    </Button>
                </div>
            </div>
        </div>
    );
}

function MenuContent({ request, data, onRespond }: { request: PendingRequest; data: MenuRequestData; onRespond: (id: string, response: unknown) => void }) {
    const [customValue, setCustomValue] = useState('');

    const handleSelect = (index: number, option: string) => {
        onRespond(request.id, {
            selectedIndex: index,
            selectedOption: option,
            isCustom: false,
            cancelled: false,
        });
    };

    const handleCustomSubmit = () => {
        const trimmed = customValue.trim();
        if (!trimmed) {
            return;
        }

        onRespond(request.id, {
            selectedIndex: -1,
            selectedOption: trimmed,
            isCustom: true,
            cancelled: false,
        });
        setCustomValue('');
    };

    return (
        <div className={styles.menuContent}>
            <p className={styles.question}>{data.question}</p>
            <div className={styles.actions}>
                <div className={styles.options}>
                    {data.options.map((option, index) => (
                        <Button
                            key={index}
                            variant="secondary"
                            size="small"
                            onClick={() => handleSelect(index, option)}
                        >
                            {option}
                        </Button>
                    ))}
                </div>
                {/* Always show custom input option */}
                <div className={styles.customInputRow}>
                    <input
                        type="text"
                        className={styles.input}
                        placeholder="Or type custom response..."
                        value={customValue}
                        onChange={(e) => setCustomValue(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleCustomSubmit()}
                    />
                    <Button size="small" onClick={handleCustomSubmit} disabled={!customValue.trim()}>
                        Send
                    </Button>
                </div>
            </div>
        </div>
    );
}

function ConfirmContent({ request, data, onRespond }: { request: PendingRequest; data: ConfirmRequestData; onRespond: (id: string, response: unknown) => void }) {
    const handleConfirm = (confirmed: boolean) => {
        onRespond(request.id, { confirmed, cancelled: false });
    };

    return (
        <div className={styles.confirmContent}>
            <p className={styles.question}>{data.question}</p>
            <div className={styles.actions}>
                <Button onClick={() => handleConfirm(true)}>
                    {data.yesLabel ?? 'Yes'}
                </Button>
                <Button variant="secondary" onClick={() => handleConfirm(false)}>
                    {data.noLabel ?? 'No'}
                </Button>
            </div>
        </div>
    );
}

function PlanReviewContent({ request, data, onRespond }: { request: PendingRequest; data: PlanReviewRequestData; onRespond: (id: string, response: unknown) => void }) {
    const [feedback, setFeedback] = useState('');
    const showHeader = Boolean(data.title || data.mode);

    const handleApprove = (approved: boolean) => {
        onRespond(request.id, {
            approved,
            feedback: feedback.trim() || undefined,
            cancelled: false,
        });
    };

    const handleRequestChanges = () => {
        const trimmed = feedback.trim();
        if (!trimmed) {
            return;
        }
        onRespond(request.id, {
            approved: false,
            feedback: trimmed,
            cancelled: false,
        });
    };

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
                <div className={styles.customInputRow}>
                    <textarea
                        className={styles.textarea}
                        rows={2}
                        placeholder="Feedback (required for changes)..."
                        value={feedback}
                        onChange={(e) => setFeedback(e.target.value)}
                    />
                </div>
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
            </div>
        </div>
    );
}
