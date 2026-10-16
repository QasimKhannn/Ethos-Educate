# Ethos Sandbox QA Tracker

## Test scope

- Ethos Educate: `https://sandboxeducate.charterschoolsusa.com/`
- Ethos Enterprise: `https://sandbox.charterschoolsusa.com/`
- Source: QA list supplied 2026-09-17
- Status: Awaiting confirmation of the meanings of the five unlabeled TRUE/FALSE columns and the target sandbox for each item.

## Results

| ID | Item | Sandbox | Expected result | Outcome | Evidence / defect |
| --- | --- | --- | --- | --- | --- |
| QA-001 | Loading screen when sending a prompt | Educate | Prompt transitions to a visible in-progress state and then renders the answer. | PASS | New QA chat sent `Reply with exactly QA_OK`; visible `Thinking` and `Generating...` states appeared, followed by `QA_OK`. |
| QA-002 | Enterprise MCP auto-selection and tool awareness | Enterprise | Asking which MCPs are available must not enable tools; the assistant should accurately describe available tools. | FAIL | No MCP was auto-enabled (all eight picker rows remained Value 0), but the response named only NetSuite while the picker lists SharePoint, Outlook, Teams, NetSuite, OneDrive, Document Workflow, Image Generation, and Web Search. |
| QA-003 | Educate page title | Educate | Educate UI/browser title identifies the product as Ethos Educate. | PASS | Fully loaded title, page heading, and product footer show `Ethos Educate`. |
| QA-004 | Public-agent starter prompt cards | Educate | Public agent provides either three starter prompt cards or its designed guided intake flow. | PASS | `Lesson Plan Builder` intentionally opens a guided intake experience through the chat input rather than using generic starter cards. |
| QA-005 | MCP descriptions | Enterprise | MCP picker presents usable descriptions and connection state; authenticated success/error flows should be clear. | PARTIAL | All eight listed MCPs expose a name, state, and description. Authenticated connector success/error paths remain scheduled for follow-up; CSUSA-account authentication is approved when needed. |
| QA-006 | Image/poster generation, download, expiry and guidance | Educate | Generates a visible image, offers download, states the 24-hour expiry, and gives user-safe guidance. | PASS | Image generation completed with a download button, 24-hour expiry text, and an accuracy-review warning. The confirmed red apple can take time to render after returning to the chat. |
| QA-007 | Tool-call loading context | Educate | Loader describes the user-facing operation rather than exposing a raw tool name. | PASS | During image generation, the UI showed `Generating your image… In progress`. |
| QA-008 | Word document formatting and document MCP | Enterprise | Document agent creates a downloadable, formatted Word document. | FAIL | `Downloadable Word Doc or PDF` returned text only and explicitly reported that no file-creation tool was enabled. In a standard chat, `Document Workflow` is marked `Disconnected`, so an end-to-end DOCX could not be created. |
| QA-009 | Simplified agent builder | Enterprise | Required/optional fields are clear and tools use simple optional checkboxes. | PARTIAL | Name and Instructions are clearly required; image, category, description, and tools are marked optional. The tool selector still presents `Add <tool>` buttons, not the requested checkbox controls. |
| QA-010 | In-app app-install guide | Enterprise | A simple install guide is available within Educate/Enterprise. | FAIL | Settings contains no install guide. `Help & FAQ` opens a separate Freshworks login tab, requiring another sign-in rather than presenting an in-app guide. No authentication was attempted. |
| QA-011 | User-oriented error messaging | Enterprise | Failures explain the cause and next action in plain language. | PASS | The document agent explained that file creation was unavailable, named the missing capability, and described the next step; it did not show a raw system error. |
| QA-012 | Unsupported file-type guidance | Enterprise | Rejecting an unsupported format lists allowed and disallowed file types. | BLOCKED | A test BMP was prepared. The visible Attach Files control did not emit a browser file-chooser event through the QA harness; the harness then lost its browser connection before an application response could be observed. This is not classified as an application failure. |
| QA-013 | 40-message-per-minute cap | Both | No unexpected 40-message-per-minute cap, or a clear product-approved limit. | PENDING | Requires a controlled 41-message rate test; not run before browser automation failed. |
| QA-014 | Generated-file 24-hour expiration and expired-item regeneration | Educate / Enterprise | Artifact states a 24-hour expiry and an expired artifact exposes Regenerate. | PARTIAL | Expiry is confirmed in Educate. Enterprise expiration and the expired-state Regenerate button remain unverified. |
| QA-015 | Deployment cache-reset update modal | Both | A new deployment prompts users to reload fresh application assets. | PENDING | Requires a deployment event or a test environment with a version change. |

## Separate performance observation

| ID | Observation | Sandbox | Status | Evidence |
| --- | --- | --- | --- | --- |
| PERF-001 | Generated image may show a blank white/gray placeholder immediately after returning to a completed chat before the image renders. | Educate | OPEN | The red apple was confirmed present after the delayed render; capture the client-side image-load delay as a separate performance/reliability fix. |
