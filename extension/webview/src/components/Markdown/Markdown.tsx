/**
 * Markdown Renderer Component
 * Renders markdown content with syntax highlighting for code blocks
 */

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import styles from './Markdown.module.css';

interface MarkdownProps {
    content: string;
    className?: string;
}

export function Markdown({ content, className }: MarkdownProps) {
    return (
        <div className={`${styles.markdown} ${className ?? ''}`}>
            <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                    // Custom code block rendering
                    code({ className, children, ...props }) {
                        const match = /language-(\w+)/.exec(className || '');
                        const isInline = !match && !className;
                        
                        if (isInline) {
                            return (
                                <code className={styles.inlineCode} {...props}>
                                    {children}
                                </code>
                            );
                        }
                        
                        return (
                            <div className={styles.codeBlock}>
                                {match && (
                                    <div className={styles.codeLanguage}>{match[1]}</div>
                                )}
                                <pre className={styles.pre}>
                                    <code className={className} {...props}>
                                        {children}
                                    </code>
                                </pre>
                            </div>
                        );
                    },
                    // Custom table rendering
                    table({ children }) {
                        return (
                            <div className={styles.tableWrapper}>
                                <table className={styles.table}>{children}</table>
                            </div>
                        );
                    },
                    // Custom link rendering
                    a({ href, children }) {
                        return (
                            <a 
                                href={href} 
                                className={styles.link}
                                target="_blank" 
                                rel="noopener noreferrer"
                            >
                                {children}
                            </a>
                        );
                    },
                }}
            >
                {content}
            </ReactMarkdown>
        </div>
    );
}
