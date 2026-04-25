"use strict";
/**
 * Chat Frontend PII Panel — entry point.
 *
 * Re-exports all frontend types, constants, and (future) components.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.autoRedactAll = exports.filterEnabledEntities = exports.segmentText = exports.getPIIIcon = exports.getRiskLevel = exports.RISK_LEVEL_MAP = exports.PII_COLOR_MAP = void 0;
var types_1 = require("./types");
// Constants
Object.defineProperty(exports, "PII_COLOR_MAP", { enumerable: true, get: function () { return types_1.PII_COLOR_MAP; } });
Object.defineProperty(exports, "RISK_LEVEL_MAP", { enumerable: true, get: function () { return types_1.RISK_LEVEL_MAP; } });
// Utility functions
Object.defineProperty(exports, "getRiskLevel", { enumerable: true, get: function () { return types_1.getRiskLevel; } });
Object.defineProperty(exports, "getPIIIcon", { enumerable: true, get: function () { return types_1.getPIIIcon; } });
var pii_highlighter_1 = require("./pii-highlighter");
Object.defineProperty(exports, "segmentText", { enumerable: true, get: function () { return pii_highlighter_1.segmentText; } });
var redaction_filter_1 = require("./redaction-filter");
Object.defineProperty(exports, "filterEnabledEntities", { enumerable: true, get: function () { return redaction_filter_1.filterEnabledEntities; } });
Object.defineProperty(exports, "autoRedactAll", { enumerable: true, get: function () { return redaction_filter_1.autoRedactAll; } });
//# sourceMappingURL=index.js.map