import { ChatRequest, ChatResponse, PrivacyRuleConfig } from './types';
/**
 * Downstream chat service function type.
 */
export type DownstreamService = (message: string) => Promise<string>;
/**
 * Chat_Proxy orchestrates the PII redaction pipeline.
 *
 * Pipeline: PDF extraction (if attached) → PII scan → redaction → Ethics_Logic_Gate → forward or block.
 *
 * Validates: Requirements 5.1, 5.2, 5.3, 5.4, 5.5, 6.1, 6.2, 6.3, 9.3, 9.8
 */
export declare class ChatProxyImpl {
    private downstream;
    private pdfExtractor;
    constructor(downstream: DownstreamService);
    processRequest(request: ChatRequest, rules: PrivacyRuleConfig): Promise<ChatResponse>;
    private executePipeline;
}
//# sourceMappingURL=chat-proxy.d.ts.map