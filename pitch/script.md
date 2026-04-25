# PII Redaction Filter — Pitch Script

---

**[OPEN — The Problem]**

Every day, millions of people paste personal information into AI chatbots without realizing it. A resume with a Social Security Number buried at the bottom. Insurance documents uploaded at 2 AM from a hospital waiting room. Research notes with a source's phone number still in the text.

These aren't careless people. They're tired, stressed, or just focused on something bigger. The risk is invisible — until it isn't.

**[TRANSITION — Real Stories]**

Maya is job hunting. It's 11 PM and she's been pasting her resume into ChatGPT to polish it. She doesn't notice the SSN left over from an old government form template. She hits send — and our filter catches it. One click to redact. She goes to bed safe.

Priya is in an ER waiting room at 2 AM. Her mother was just rushed in. She uploads insurance cards and hospital documents to Claude, trying to figure out coverage. She's not thinking about data privacy — she's thinking about her mom. Our tool quietly flags the Medicare ID, date of birth, and home address. Fifteen seconds to redact. She gets her answer. Her mother's identity stays protected.

James is writing a research paper and pastes a block of notes into a chat for help structuring his argument. Buried in there: a real person's name, phone number, and address from an old interview. He'd completely forgotten. We catch it. He redacts it and moves on. The paper gets an A. That person never ends up in a training dataset.

**[THE PRODUCT — How It Works]**

PII Redaction Filter is a TypeScript middleware that sits between the user and any downstream AI chat service. Every message passes through a real-time pipeline before it ever leaves the browser.

First, we scan the text using pattern-matching for six PII types: emails, phone numbers, Social Security Numbers, credit cards, physical addresses, and file paths. If a PDF is attached, we extract and scan that too.

Then, our Ethics Logic Gate evaluates configurable privacy rules. Sensitive types like SSNs and credit cards can be set to block the message entirely — it never gets forwarded. Other types get redacted with clear placeholders like `[EMAIL_REDACTED]`, so the AI still gets useful context without the private data.

Every request generates a SHA-256 hashed audit trail — what was detected, what action was taken, and when. The user gets a real-time notification showing exactly what was caught and what was done about it.

On the frontend, a PrivacyLens panel highlights detected PII inline with color-coded risk levels — red for high-risk items like SSNs, blue for emails, green for addresses — so users can see exactly what's being protected before they send.

**[CLOSE — Why It Matters]**

We're not asking people to change their behavior. We're adding one quiet layer of awareness at the exact moment it matters — fast enough that it doesn't break their flow, clear enough that they trust it, and respectful enough that they keep using it.

That's the whole idea. One small moment between send and regret.

---

*PII Redaction Filter — because the best privacy protection is the kind you barely notice.*
