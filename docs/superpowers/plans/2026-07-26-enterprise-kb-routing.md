# Enterprise Knowledge Base Routing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent general questions such as “介绍一下青岛栈桥” from querying or exposing the enterprise knowledge base while preserving knowledge-base answers for clearly internal business questions.

**Architecture:** Add a small deterministic routing module with no external dependencies. The chat endpoint classifies the latest user question before retrieval, injects enterprise reference material only for enterprise routes, and adds route-specific answer instructions. The ZEGO system prompt becomes route-aware instead of assuming every request must be answered from the knowledge base.

**Tech Stack:** TypeScript, Next.js 15 route handlers, Node.js built-in test runner, OpenAI-compatible chat completions.

## Global Constraints

- Preserve streaming SSE behavior and the final `data: [DONE]` marker.
- Preserve `sanitizeSpeechText()` processing for digital-human display and TTS.
- Do not add a network-based classifier or new runtime dependency.
- General questions must never contain enterprise retrieval content.
- Enterprise facts must only be answered from supplied knowledge-base content.

---

### Task 1: Deterministic question routing

**Files:**
- Create: `src/lib/question-routing.test.ts`
- Create: `src/lib/question-routing.ts`

**Interfaces:**
- Produces: `routeQuestion(question: string): 'enterprise_kb' | 'general'`
- Produces: `buildRoutedUserContent(question: string, route: AnswerRoute, kbContent?: string): string`

- [ ] **Step 1: Write failing tests**

Test that “介绍一下青岛栈桥” and ordinary general questions route to `general`; company contract, invoice, project amount and named-company questions route to `enterprise_kb`; general content contains no knowledge-base wording; enterprise content contains the supplied reference text and strict grounding instructions.

- [ ] **Step 2: Run the routing test and verify RED**

Run: `node --test src/lib/question-routing.test.ts`

Expected: FAIL because `question-routing.ts` does not exist.

- [ ] **Step 3: Implement the minimal router and content builder**

Use explicit high-confidence internal-business phrases. Do not route on ambiguous words such as `项目` or `公司` alone.

- [ ] **Step 4: Run the routing test and verify GREEN**

Run: `node --test src/lib/question-routing.test.ts`

Expected: all routing tests pass.

### Task 2: Integrate routing into the chat endpoint and prompt

**Files:**
- Modify: `src/app/api/chat/completions/route.ts`
- Modify: `src/lib/zego/aiagent.ts`

**Interfaces:**
- Consumes: `routeQuestion()` and `buildRoutedUserContent()` from Task 1.

- [ ] **Step 1: Classify the latest user question before any RAG call**

Only execute `retrieveFromRagflow()` or `retrieveFromBailian()` when the route is `enterprise_kb`.

- [ ] **Step 2: Build the final user message through the tested helper**

For `general`, retain only the original question plus general-answer policy. For `enterprise_kb`, append strict grounding policy and retrieved reference material.

- [ ] **Step 3: Replace the default ZEGO system prompt**

Tell the model to follow the backend route instructions, never expose internal retrieval details, answer stable general knowledge directly, avoid definitive claims for current data, and avoid mechanical follow-up questions.

- [ ] **Step 4: Run the full test suite and production build**

Run: `npm test`

Expected: all tests pass.

Run: `npm run build`

Expected: Next.js production build succeeds.

### Task 3: Update the development record

**Files:**
- Modify: `../../01_需求文档/020_开发Doc/2026-07-26_青岛栈桥问答异常现状与调优记录.md`

- [ ] **Step 1: Record the implementation scope and verification evidence**

Mark routing, prompt changes, tests and local build as completed. Keep deployment and live digital-human verification as pending because they require the deployed environment.

- [ ] **Step 2: Re-read the record and verify status consistency**

The document must distinguish local code completion from deployment completion.
