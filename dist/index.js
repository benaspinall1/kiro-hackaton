"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChatProxyImpl = exports.PDFTextExtractorImpl = exports.createBlockNotification = exports.createRedactionNotification = exports.validateConfig = exports.evaluate = exports.redact = exports.scan = exports.PDFTimeoutError = exports.PDFPageLimitError = exports.PDFPasswordProtectedError = exports.PDFCorruptedError = exports.InvalidEntityError = exports.PLACEHOLDER_MAP = void 0;
exports.createChatProxy = createChatProxy;
var types_1 = require("./types");
Object.defineProperty(exports, "PLACEHOLDER_MAP", { enumerable: true, get: function () { return types_1.PLACEHOLDER_MAP; } });
// Custom error classes
var errors_1 = require("./errors");
Object.defineProperty(exports, "InvalidEntityError", { enumerable: true, get: function () { return errors_1.InvalidEntityError; } });
Object.defineProperty(exports, "PDFCorruptedError", { enumerable: true, get: function () { return errors_1.PDFCorruptedError; } });
Object.defineProperty(exports, "PDFPasswordProtectedError", { enumerable: true, get: function () { return errors_1.PDFPasswordProtectedError; } });
Object.defineProperty(exports, "PDFPageLimitError", { enumerable: true, get: function () { return errors_1.PDFPageLimitError; } });
Object.defineProperty(exports, "PDFTimeoutError", { enumerable: true, get: function () { return errors_1.PDFTimeoutError; } });
// Pipeline components
var pii_scanner_1 = require("./pii-scanner");
Object.defineProperty(exports, "scan", { enumerable: true, get: function () { return pii_scanner_1.scan; } });
var redaction_engine_1 = require("./redaction-engine");
Object.defineProperty(exports, "redact", { enumerable: true, get: function () { return redaction_engine_1.redact; } });
var ethics_logic_gate_1 = require("./ethics-logic-gate");
Object.defineProperty(exports, "evaluate", { enumerable: true, get: function () { return ethics_logic_gate_1.evaluate; } });
Object.defineProperty(exports, "validateConfig", { enumerable: true, get: function () { return ethics_logic_gate_1.validateConfig; } });
var notification_service_1 = require("./notification-service");
Object.defineProperty(exports, "createRedactionNotification", { enumerable: true, get: function () { return notification_service_1.createRedactionNotification; } });
Object.defineProperty(exports, "createBlockNotification", { enumerable: true, get: function () { return notification_service_1.createBlockNotification; } });
var pdf_text_extractor_1 = require("./pdf-text-extractor");
Object.defineProperty(exports, "PDFTextExtractorImpl", { enumerable: true, get: function () { return pdf_text_extractor_1.PDFTextExtractorImpl; } });
// Chat Proxy orchestrator
var chat_proxy_1 = require("./chat-proxy");
Object.defineProperty(exports, "ChatProxyImpl", { enumerable: true, get: function () { return chat_proxy_1.ChatProxyImpl; } });
/**
 * Convenience factory that wires all pipeline components together
 * and returns a ready-to-use ChatProxyImpl instance.
 */
function createChatProxy(downstream) {
    return new ChatProxyImpl(downstream);
}
//# sourceMappingURL=index.js.map