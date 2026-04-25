/**
 * HTTP server for the Chat Frontend PII Panel REST API.
 *
 * Uses Node.js built-in `http` module — no Express dependency.
 * Exposes three POST endpoints wrapping existing backend functions:
 *   POST /api/scan   — PII scanning
 *   POST /api/redact — PII redaction
 *   POST /api/chat   — Chat proxy pipeline
 *
 * Validates: Requirements 9.1, 9.2, 9.3
 */

import * as http from 'node:http';
import { scan } from '../pii-scanner';
import { redact } from '../redaction-engine';
import { ChatProxyImpl } from '../chat-proxy';
import type { ChatRequest, PrivacyRuleConfig } from '../types';

/**
 * Read the full request body as a string.
 */
function readBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
    req.on('error', reject);
  });
}

/**
 * Send a JSON response with the given status code.
 */
function sendJSON(res: http.ServerResponse, statusCode: number, data: unknown): void {
  const body = JSON.stringify(data);
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(body);
}

/**
 * Send a JSON error response.
 */
function sendError(res: http.ServerResponse, statusCode: number, message: string): void {
  sendJSON(res, statusCode, { error: message });
}

/**
 * Parse JSON body, returning the parsed object or null on failure.
 */
function parseJSON(raw: string): unknown | null {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/** Default echo downstream service for the chat endpoint. */
const echoDownstream = async (message: string): Promise<string> => message;

/** Default privacy rules (redact all types). */
const defaultRules: PrivacyRuleConfig = { rules: {} };

/**
 * Handle POST /api/scan
 * Accepts { text: string }, returns PIIEntity[].
 */
async function handleScan(body: unknown, res: http.ServerResponse): Promise<void> {
  const obj = body as Record<string, unknown>;
  if (typeof obj.text !== 'string') {
    sendError(res, 400, 'Missing or invalid "text" field');
    return;
  }
  const entities = scan(obj.text);
  sendJSON(res, 200, entities);
}

/**
 * Handle POST /api/redact
 * Accepts { text: string, entities: PIIEntity[] }, returns RedactionResult.
 */
async function handleRedact(body: unknown, res: http.ServerResponse): Promise<void> {
  const obj = body as Record<string, unknown>;
  if (typeof obj.text !== 'string') {
    sendError(res, 400, 'Missing or invalid "text" field');
    return;
  }
  if (!Array.isArray(obj.entities)) {
    sendError(res, 400, 'Missing or invalid "entities" field');
    return;
  }
  const result = redact(obj.text, obj.entities);
  sendJSON(res, 200, result);
}

/**
 * Handle POST /api/chat
 * Accepts ChatRequest body, returns ChatResponse.
 */
async function handleChat(body: unknown, res: http.ServerResponse): Promise<void> {
  const obj = body as Record<string, unknown>;
  if (typeof obj.prompt !== 'string') {
    sendError(res, 400, 'Missing or invalid "prompt" field');
    return;
  }
  const request: ChatRequest = { prompt: obj.prompt };
  if (obj.pdfAttachment !== undefined) {
    request.pdfAttachment = obj.pdfAttachment as Buffer;
  }
  const proxy = new ChatProxyImpl(echoDownstream);
  const response = await proxy.processRequest(request, defaultRules);
  sendJSON(res, 200, response);
}

/** Known API routes and their handlers. */
const ROUTES: Record<string, (body: unknown, res: http.ServerResponse) => Promise<void>> = {
  '/api/scan': handleScan,
  '/api/redact': handleRedact,
  '/api/chat': handleChat,
};

/**
 * Serves the chat UI HTML page at GET /
 */
function serveHTML(res: http.ServerResponse): void {
  const html = getIndexHTML();
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(html);
}

/**
 * Returns the full interactive chat UI as a self-contained HTML string.
 */
function getIndexHTML(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>PII Redaction Chat</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #F3F4F6; height: 100vh; overflow: hidden; }

  .app-layout { display: flex; height: 100vh; }
  .chat-area { flex: 1; display: flex; flex-direction: column; min-width: 0; }

  .message-list { flex: 1; overflow-y: auto; padding: 16px 16px 80px; }
  .message-row { margin: 6px 0; }
  .message-row.user { text-align: right; }
  .message-row.assistant { text-align: left; }

  .message-bubble { display: inline-block; max-width: 70%; padding: 10px 14px; border-radius: 12px; word-wrap: break-word; font-size: 14px; line-height: 1.5; }
  .message-row.user .message-bubble { background: #DCF8C6; border-bottom-right-radius: 4px; }
  .message-row.assistant .message-bubble { background: #FFFFFF; border: 1px solid #E5E7EB; border-bottom-left-radius: 4px; }
  .message-bubble.error { background: #FEE2E2; border: 1px solid #EF4444; color: #991B1B; }

  .pii-highlight { padding: 1px 4px; border-radius: 3px; }
  .pii-highlight.muted { opacity: 0.4; }

  .input-area { position: fixed; bottom: 0; left: 0; right: 0; padding: 12px 16px; background: #FFF; border-top: 1px solid #E5E7EB; display: flex; gap: 8px; z-index: 100; }
  .input-area input { flex: 1; padding: 10px 14px; border: 1px solid #D1D5DB; border-radius: 8px; font-size: 14px; outline: none; }
  .input-area input:focus { border-color: #3B82F6; }
  .input-area button { padding: 10px 24px; background: #3B82F6; color: #FFF; border: none; border-radius: 8px; font-weight: 600; cursor: pointer; font-size: 14px; }
  .input-area button:disabled { background: #93C5FD; cursor: not-allowed; }

  .loading { text-align: center; padding: 12px; color: #6B7280; font-size: 13px; }

  /* Panel */
  .panel-overlay { display: none; position: fixed; top: 0; right: 0; width: 380px; height: 100%; background: #F9FAFB; box-shadow: -2px 0 12px rgba(0,0,0,0.15); z-index: 200; flex-direction: column; }
  .panel-overlay.open { display: flex; }

  .panel-header { padding: 16px; border-bottom: 1px solid #E5E7EB; }
  .panel-header h2 { font-size: 18px; font-weight: 700; }
  .panel-header p { font-size: 13px; color: #6B7280; margin-top: 4px; }
  .panel-header .close-btn { float: right; background: none; border: none; font-size: 20px; cursor: pointer; color: #6B7280; }

  .panel-items { flex: 1; overflow-y: auto; padding: 12px; }

  .pii-card { display: flex; align-items: center; gap: 10px; padding: 10px; border: 1px solid #E5E7EB; border-radius: 8px; margin-bottom: 8px; background: #FFF; }
  .pii-card .icon { font-size: 20px; }
  .pii-card .details { flex: 1; min-width: 0; }
  .pii-card .type-label { font-weight: 600; font-size: 13px; }
  .pii-card .risk-badge { font-size: 11px; padding: 2px 6px; border-radius: 4px; color: #FFF; margin-left: 6px; }
  .pii-card .risk-badge.high { background: #EF4444; }
  .pii-card .risk-badge.medium { background: #F59E0B; }
  .pii-card .risk-badge.low { background: #22C55E; }
  .pii-card .matched { font-size: 12px; color: #6B7280; word-break: break-all; margin-top: 2px; }
  .pii-card .toggle { width: 40px; height: 22px; border-radius: 11px; border: none; cursor: pointer; position: relative; flex-shrink: 0; }
  .pii-card .toggle.on { background: #22C55E; }
  .pii-card .toggle.off { background: #D1D5DB; }
  .pii-card .toggle::after { content: ''; position: absolute; width: 18px; height: 18px; border-radius: 50%; background: #FFF; top: 2px; transition: left 0.2s; }
  .pii-card .toggle.on::after { left: 20px; }
  .pii-card .toggle.off::after { left: 2px; }

  .panel-actions { padding: 12px; border-top: 1px solid #E5E7EB; display: flex; flex-direction: column; gap: 8px; }
  .panel-actions .auto-btn { padding: 10px; background: #F59E0B; color: #FFF; border: none; border-radius: 6px; font-weight: 600; cursor: pointer; }
  .panel-actions .send-btn { padding: 10px; background: #3B82F6; color: #FFF; border: none; border-radius: 6px; font-weight: 600; cursor: pointer; }

  .panel-footer { padding: 10px 16px; border-top: 1px solid #E5E7EB; text-align: center; font-size: 12px; color: #6B7280; }

  .notification { position: fixed; top: 16px; left: 50%; transform: translateX(-50%); background: #FEE2E2; color: #991B1B; padding: 10px 20px; border-radius: 8px; border: 1px solid #EF4444; z-index: 300; display: none; font-size: 13px; }
  .notification.show { display: block; }

  @media (max-width: 1023px) {
    .panel-overlay { width: 100%; }
    .input-area { right: 0; }
  }
  @media (min-width: 1024px) {
    .panel-overlay.open ~ .chat-area .input-area { right: 380px; }
  }
</style>
</head>
<body>

<div class="app-layout">
  <div class="panel-overlay" id="panel">
    <div class="panel-header">
      <button class="close-btn" id="panelClose">&times;</button>
      <h2 id="panelTitle">0 PII items detected</h2>
      <p>Review detected items before sending</p>
    </div>
    <div class="panel-items" id="panelItems"></div>
    <div class="panel-actions">
      <button class="auto-btn" id="autoRedactBtn">Auto-Redact All</button>
      <button class="send-btn" id="confirmSendBtn">Confirm &amp; Send</button>
    </div>
    <div class="panel-footer" id="panelFooter">0 items protected today</div>
  </div>

  <div class="chat-area">
    <div class="message-list" id="messageList"></div>
    <div class="input-area">
      <input type="text" id="msgInput" placeholder="Type a message..." autocomplete="off" />
      <button id="sendBtn" disabled>Send</button>
    </div>
  </div>
</div>

<div class="notification" id="notification"></div>

<script>
const PII_COLORS = { EMAIL:'#DBEAFE', PHONE:'#FFEDD5', SSN:'#FEE2E2', CREDIT_CARD:'#F3E8FF', ADDRESS:'#DCFCE7', FILE_PATH:'#F3F4F6' };
const PII_ICONS = { EMAIL:'📧', PHONE:'📱', SSN:'🔒', CREDIT_CARD:'💳', ADDRESS:'🏠', FILE_PATH:'📁' };
const RISK = { SSN:'high', CREDIT_CARD:'high', EMAIL:'medium', PHONE:'medium', ADDRESS:'low', FILE_PATH:'low' };
const RISK_LABEL = { high:'High Risk', medium:'Medium Risk', low:'Low Risk' };

let messages = [];
let pendingText = '';
let pendingEntities = [];
let piiItems = [];
let statsCount = parseInt(sessionStorage.getItem('pii-stats') || '0', 10);
let isLoading = false;

const msgList = document.getElementById('messageList');
const msgInput = document.getElementById('msgInput');
const sendBtn = document.getElementById('sendBtn');
const panel = document.getElementById('panel');
const panelTitle = document.getElementById('panelTitle');
const panelItems = document.getElementById('panelItems');
const panelFooter = document.getElementById('panelFooter');
const notifEl = document.getElementById('notification');

function updateSendBtn() {
  sendBtn.disabled = !msgInput.value.trim() || isLoading;
}
msgInput.addEventListener('input', updateSendBtn);
msgInput.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !sendBtn.disabled) submitMessage(); });
sendBtn.addEventListener('click', submitMessage);
document.getElementById('panelClose').addEventListener('click', closePanel);
document.getElementById('autoRedactBtn').addEventListener('click', () => {
  piiItems.forEach(i => i.enabled = true);
  renderPanel();
  renderLastUserHighlights();
});
document.getElementById('confirmSendBtn').addEventListener('click', confirmSend);

function renderMessages() {
  msgList.innerHTML = messages.map(m => {
    const cls = m.role + (m.isError ? ' error' : '');
    const bubbleCls = 'message-bubble' + (m.isError ? ' error' : '');
    let content = escapeHtml(m.text);
    if (m.role === 'user' && m.entities && m.entities.length) {
      content = highlightText(m.text, m.entities, m.disabledIndices || new Set());
    }
    return '<div class="message-row ' + m.role + '"><div class="' + bubbleCls + '">' + content + '</div></div>';
  }).join('') + (isLoading ? '<div class="loading">Processing...</div>' : '');
  msgList.scrollTop = msgList.scrollHeight;
}

function highlightText(text, entities, disabled) {
  const sorted = [...entities].sort((a,b) => a.startIndex - b.startIndex);
  let result = '', cursor = 0;
  sorted.forEach((e, i) => {
    if (e.startIndex > cursor) result += escapeHtml(text.slice(cursor, e.startIndex));
    const muted = disabled.has(i) ? ' muted' : '';
    result += '<span class="pii-highlight' + muted + '" style="background:' + (PII_COLORS[e.type]||'#EEE') + '">' + escapeHtml(e.matchedText) + '</span>';
    cursor = e.endIndex;
  });
  if (cursor < text.length) result += escapeHtml(text.slice(cursor));
  return result;
}

function escapeHtml(s) { return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

function showNotification(msg) {
  notifEl.textContent = msg;
  notifEl.classList.add('show');
  setTimeout(() => notifEl.classList.remove('show'), 4000);
}

function renderPanel() {
  panelTitle.textContent = piiItems.length + ' PII items detected';
  panelFooter.textContent = statsCount + ' items protected today';
  panelItems.innerHTML = piiItems.map((item, i) => {
    const e = item.entity;
    const risk = RISK[e.type] || 'low';
    return '<div class="pii-card">' +
      '<span class="icon">' + (PII_ICONS[e.type]||'🔍') + '</span>' +
      '<div class="details"><span class="type-label">' + e.type + '</span>' +
      '<span class="risk-badge ' + risk + '">' + RISK_LABEL[risk] + '</span>' +
      '<div class="matched">' + escapeHtml(e.matchedText) + '</div></div>' +
      '<button class="toggle ' + (item.enabled ? 'on' : 'off') + '" data-idx="' + i + '"></button></div>';
  }).join('');
  panelItems.querySelectorAll('.toggle').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.idx);
      piiItems[idx].enabled = !piiItems[idx].enabled;
      renderPanel();
      renderLastUserHighlights();
    });
  });
}

function renderLastUserHighlights() {
  const last = messages[messages.length - 1];
  if (last && last.role === 'user' && last.entities) {
    last.disabledIndices = new Set(piiItems.map((it,i) => it.enabled ? -1 : i).filter(i => i >= 0));
    renderMessages();
  }
}

function openPanel() { panel.classList.add('open'); renderPanel(); }
function closePanel() {
  panel.classList.remove('open');
  if (messages.length && messages[messages.length-1].role === 'user' && pendingText) {
    messages.pop();
    renderMessages();
  }
  pendingText = ''; pendingEntities = []; piiItems = [];
}

async function submitMessage() {
  const text = msgInput.value.trim();
  if (!text) return;
  msgInput.value = '';
  updateSendBtn();
  pendingText = text;
  isLoading = true;

  messages.push({ role: 'user', text, entities: null, disabledIndices: new Set() });
  renderMessages();

  let entities;
  try {
    const res = await fetch('/api/scan', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({text}) });
    if (!res.ok) throw new Error('Scan failed');
    entities = await res.json();
  } catch(e) {
    isLoading = false;
    messages.pop();
    renderMessages();
    showNotification('Failed to scan message for PII. Please try again.');
    return;
  }

  if (!entities.length) {
    await sendDirect(text);
  } else {
    messages[messages.length-1].entities = entities;
    pendingEntities = entities;
    piiItems = entities.map(e => ({ entity: e, enabled: true }));
    isLoading = false;
    renderMessages();
    openPanel();
  }
}

async function sendDirect(text) {
  try {
    const res = await fetch('/api/chat', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({prompt:text}) });
    if (!res.ok) throw new Error('Chat failed');
    const data = await res.json();
    isLoading = false;
    if (data.blocked) { showNotification('Your message was blocked by privacy rules.'); renderMessages(); return; }
    if (data.error) { messages.push({ role:'assistant', text: data.error, isError:true }); renderMessages(); return; }
    messages.push({ role:'assistant', text: data.reply || '' });
    renderMessages();
  } catch(e) {
    isLoading = false;
    messages.push({ role:'assistant', text:'Failed to get a response. Please try again.', isError:true });
    renderMessages();
  }
}

async function confirmSend() {
  const enabled = piiItems.filter(i => i.enabled).map(i => i.entity);
  const redactedCount = enabled.length;
  isLoading = true;
  renderMessages();

  let textToSend = pendingText;
  if (enabled.length > 0) {
    try {
      const res = await fetch('/api/redact', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({text:pendingText, entities:enabled}) });
      if (!res.ok) throw new Error('Redact failed');
      const data = await res.json();
      textToSend = data.redactedText;
    } catch(e) {
      isLoading = false;
      renderMessages();
      showNotification('Failed to redact PII. Please try again.');
      return;
    }
  }

  panel.classList.remove('open');
  await sendDirect(textToSend);

  if (redactedCount > 0) {
    statsCount += redactedCount;
    sessionStorage.setItem('pii-stats', String(statsCount));
    panelFooter.textContent = statsCount + ' items protected today';
  }
  pendingText = ''; pendingEntities = []; piiItems = [];
}
</script>
</body>
</html>`;
}

/**
 * Main request handler. Exported for testability.
 */
export async function handleRequest(
  req: http.IncomingMessage,
  res: http.ServerResponse,
): Promise<void> {
  const url = req.url ?? '';
  const method = (req.method ?? '').toUpperCase();

  // Serve the HTML UI at GET /
  if (url === '/' && method === 'GET') {
    serveHTML(res);
    return;
  }

  // Check if this is a known API route
  const handler = ROUTES[url];

  if (!handler) {
    sendError(res, 404, `Not found: ${url}`);
    return;
  }

  if (method !== 'POST') {
    sendError(res, 405, `Method ${method} not allowed. Use POST.`);
    return;
  }

  try {
    const raw = await readBody(req);
    const body = parseJSON(raw);
    if (body === null) {
      sendError(res, 400, 'Invalid JSON body');
      return;
    }
    await handler(body, res);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    sendError(res, 500, message);
  }
}

/**
 * Create an HTTP server (not auto-listening) for testability.
 */
export function createServer(): http.Server {
  return http.createServer((req, res) => {
    handleRequest(req, res).catch(() => {
      if (!res.headersSent) {
        sendError(res, 500, 'Internal server error');
      }
    });
  });
}
