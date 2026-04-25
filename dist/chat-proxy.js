"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChatProxyImpl = void 0;
const node_crypto_1 = require("node:crypto");
const pii_scanner_1 = require("./pii-scanner");
const redaction_engine_1 = require("./redaction-engine");
const ethics_logic_gate_1 = require("./ethics-logic-gate");
const notification_service_1 = require("./notification-service");
const pdf_text_extractor_1 = require("./pdf-text-extractor");
const errors_1 = require("./errors");
/**
 * Builds a zero-count record for all PII types.
 */
function zeroCounts() {
    return {
        EMAIL: 0,
        PHONE: 0,
        SSN: 0,
        CREDIT_CARD: 0,
        ADDRESS: 0,
        FILE_PATH: 0,
    };
}
/**
 * Generates a SHA-256 hex hash of the given text.
 */
function sha256(text) {
    return (0, node_crypto_1.createHash)('sha256').update(text).digest('hex');
}
/**
 * Builds a RedactionReport from pipeline results.
 */
function buildReport(originalMessage, entities, gateResult, pdfStatus) {
    const detectedCounts = zeroCounts();
    for (const entity of entities) {
        detectedCounts[entity.type]++;
    }
    let actions;
    if (entities.length === 0) {
        actions = [{ entityType: 'EMAIL', action: 'none' }];
    }
    else if (!gateResult.allowed) {
        actions = entities.map((e) => ({
            entityType: e.type,
            action: (gateResult.blockedTypes.includes(e.type) ? 'blocked' : 'redacted'),
        }));
    }
    else {
        actions = entities.map((e) => ({
            entityType: e.type,
            action: 'redacted',
        }));
    }
    return {
        messageHash: sha256(originalMessage),
        detectedCounts,
        actions,
        timestamp: new Date().toISOString(),
        pdfStatus,
    };
}
/**
 * Chat_Proxy orchestrates the PII redaction pipeline.
 *
 * Pipeline: PDF extraction (if attached) → PII scan → redaction → Ethics_Logic_Gate → forward or block.
 *
 * Validates: Requirements 5.1, 5.2, 5.3, 5.4, 5.5, 6.1, 6.2, 6.3, 9.3, 9.8
 */
class ChatProxyImpl {
    constructor(downstream) {
        this.downstream = downstream;
        this.pdfExtractor = new pdf_text_extractor_1.PDFTextExtractorImpl();
    }
    async processRequest(request, rules) {
        try {
            return await this.executePipeline(request, rules);
        }
        catch (error) {
            // Fail-safe: block the message on any unhandled error
            const report = buildReport(request.prompt, [], { allowed: false, blockedTypes: [], reason: 'Unhandled error' }, request.pdfAttachment ? 'error' : 'none');
            return {
                reply: null,
                redactionReport: report,
                notification: null,
                blocked: true,
                error: `Pipeline error: ${error instanceof Error ? error.message : 'Unknown error'}`,
            };
        }
    }
    async executePipeline(request, rules) {
        const originalMessage = request.prompt;
        let pdfText = '';
        let pdfStatus = 'none';
        // Step 1: PDF extraction (if attached)
        if (request.pdfAttachment) {
            try {
                const pdfResult = await this.pdfExtractor.extract(request.pdfAttachment);
                if (pdfResult.extractable) {
                    pdfText = pdfResult.text;
                    pdfStatus = 'processed';
                }
                else {
                    pdfStatus = 'unprocessable';
                }
            }
            catch (error) {
                if (error instanceof errors_1.PDFCorruptedError ||
                    error instanceof errors_1.PDFPasswordProtectedError ||
                    error instanceof errors_1.PDFPageLimitError ||
                    error instanceof errors_1.PDFTimeoutError) {
                    const report = buildReport(originalMessage, [], { allowed: false, blockedTypes: [], reason: null }, 'error');
                    return {
                        reply: null,
                        redactionReport: report,
                        notification: null,
                        blocked: true,
                        error: error.message,
                    };
                }
                throw error;
            }
        }
        // Combine prompt and PDF text for scanning
        const fullText = pdfText ? `${originalMessage}\n${pdfText}` : originalMessage;
        // Step 2: PII scan
        const entities = (0, pii_scanner_1.scan)(fullText);
        // Step 3: Redaction
        let redactionResult;
        redactionResult = (0, redaction_engine_1.redact)(fullText, entities);
        // Step 4: Ethics Logic Gate
        const gateResult = (0, ethics_logic_gate_1.evaluate)(entities, rules);
        // Build the report
        const report = buildReport(originalMessage, entities, gateResult, pdfStatus);
        // Step 5: Block or forward
        if (!gateResult.allowed) {
            const notification = (0, notification_service_1.createBlockNotification)(gateResult.blockedTypes, gateResult.reason ?? 'Message blocked by privacy rules');
            return {
                reply: null,
                redactionReport: report,
                notification,
                blocked: true,
            };
        }
        // Create redaction notification (null if no PII)
        const notification = (0, notification_service_1.createRedactionNotification)(redactionResult.redactions);
        // Step 6: Forward to downstream
        let reply;
        try {
            reply = await this.downstream(redactionResult.redactedText);
        }
        catch (error) {
            return {
                reply: null,
                redactionReport: report,
                notification,
                blocked: false,
                error: `Downstream service error: ${error instanceof Error ? error.message : 'Service unavailable'}`,
            };
        }
        return {
            reply,
            redactionReport: report,
            notification,
            blocked: false,
        };
    }
}
exports.ChatProxyImpl = ChatProxyImpl;
//# sourceMappingURL=chat-proxy.js.map