# Agent Builder Provider/Model Investigation

## Summary

Agent Builder is not hardcoded to `gpt-5.2-chat`, but in the current deployed environment it behaves that way because:

1. The **provider list** is driven by `/api/endpoints`
2. The **model list** is driven by `/api/models`
3. The live `/api/endpoints` response only exposes:
   - `agents`
   - `azureOpenAI`
   - `google`
4. The live `/api/models` response exposes:
   - many `openAI` models
   - only 3 `azureOpenAI` models:
     - `gpt-5.2-chat`
     - `gpt-5-nano`
     - `gpt-5-mini`

This means:

- `openAI` is **not selectable** in Agent Builder because it is missing from `/api/endpoints`
- `azureOpenAI` appears limited because its configured model list is only those 3 models
- `google` should be selectable because it exists in `/api/endpoints`
- if clicking provider/model does nothing, that is likely a **frontend combobox interaction bug**

## Confirmed Runtime Responses

### `/api/endpoints`

```json
{
  "agents": {
    "userProvide": false,
    "capabilities": [
      "tools",
      "file_search",
      "artifacts",
      "ocr",
      "context",
      "execute_code",
      "deferred_tools"
    ],
    "order": 1,
    "disableBuilder": false
  },
  "azureOpenAI": {
    "userProvide": false,
    "order": 4
  },
  "google": {
    "userProvide": false,
    "order": 5
  }
}
```

### `/api/models`

Important observation:

- `openAI` has many models
- `azureOpenAI` only has:
  - `gpt-5.2-chat`
  - `gpt-5-nano`
  - `gpt-5-mini`

## Repo Flow

### Provider list source

Provider options in Agent Builder come from:

- `client/src/components/SidePanel/Agents/AgentPanel.tsx`

Relevant behavior:

- uses `useGetEndpointsQuery()`
- builds providers from `Object.keys(endpointsConfig ?? {})`
- filters out `agents`
- optionally filters through `allowedProviders`

This means the provider dropdown only shows providers returned by `/api/endpoints`.

### Model list source

Model options come from:

- `client/src/components/SidePanel/Agents/ModelPanel.tsx`

Relevant behavior:

- uses `modelsData[provider] ?? []`

This means once a provider is selected, the model dropdown is restricted to the models returned under that provider from `/api/models`.

### Backend endpoints source

`/api/endpoints` is returned by:

- `api/server/controllers/EndpointController.js`
- `api/server/services/Config/getEndpointsConfig.js`

`/api/models` is returned by:

- `api/server/controllers/ModelController.js`
- `api/server/services/Config/loadDefaultModels.js`
- `api/server/services/Config/loadConfigModels.js`

## Current Root Cause

### Not a frontend hardcoded model issue

There is no evidence that `gpt-5.2-chat` is hardcoded directly in the Agent Builder UI.

The builder is rendering backend-provided data.

### Backend/config explanation

- `openAI` models exist in `/api/models`
- but `openAI` is missing from `/api/endpoints`
- therefore `openAI` is not available in the Agent Builder provider dropdown

This is why the builder does not let the user switch to OpenAI even though OpenAI models are present in the models API.

### Likely frontend bug

Since `google` is present in `/api/endpoints`, the provider dropdown should still allow switching from `azureOpenAI` to `google`.

If clicking the provider dropdown does nothing, the likely issue is in the dropdown interaction layer, not in the provider data itself.

Most likely area to investigate:

- `packages/client/src/components/ControlCombobox.tsx`
- `client/src/components/SidePanel/Agents/ModelPanel.tsx`

## Likely Fix Directions

### If the goal is to allow OpenAI as a provider

Investigate why `openAI` is absent from `/api/endpoints` in the deployed environment.

Likely causes:

- runtime env/config does not enable `openAI`
- endpoint exposure differs from model exposure
- deployment config is Azure-focused and does not surface OpenAI in endpoint config

### If the goal is to remove `gpt-5.2-chat` everywhere

Main runtime config candidate:

- `deploy/azure/librechat.azure.yaml`

Relevant Azure config currently defines:

- `gpt-5.2-chat`
- `gpt-5-nano`
- `gpt-5-mini`

### If the goal is to fix the non-responsive dropdown

Inspect:

- provider combobox in `ModelPanel.tsx`
- model combobox in `ModelPanel.tsx`
- `ControlCombobox.tsx`
- any overlay/z-index/pointer-events/popover issue preventing the dropdown from opening

## Clear Reproduction Notes

1. Open Agent Builder
2. Provider appears as `azureOpenAI`
3. Model appears as `gpt-5.2-chat`
4. Clicking provider does not switch to another provider
5. Clicking model does not open/select another model
6. Runtime data confirms `google` exists in `/api/endpoints`, so at least one alternate provider should be available

## Working Conclusion

There are 2 separate concerns:

1. **Provider availability issue**
   - `openAI` missing from `/api/endpoints`
   - explains why OpenAI is not shown/selectable

2. **Dropdown interaction issue**
   - `google` is present in `/api/endpoints`
   - but provider/model selection still does not respond
   - likely a frontend combobox/popover bug

---

## Confirmed Demo Scope

### 1. `gpt-5.2-chat` handling

Confirmed direction:

- backend behavior for `gpt-5.2-chat` stays as-is
- the Agent Builder/provider/model "stuck" behavior is not a bug for the current demo
- current demo mode intentionally has a constrained setup
- the only real requirement is to avoid exposing `gpt` naming on the frontend

What needs to happen:

- rename frontend-facing `gpt-5.2-chat` display to something branded such as `Ethos Model`
- do not disclose on the frontend that GPT is being used behind the scenes

What does **not** need to happen:

- no backend model migration
- no provider/model behavior changes
- no fix for the demo-mode builder restriction

### 2. Audio upload support in chat

Confirmed direction:

- this is **not** just a new marketplace agent
- the platform chat/file-upload experience itself needs to support `mp3/mp4`
- once uploaded, the system should process audio and help create notes/summaries from it

What needs to happen:

- extend existing chat file upload support to accept audio/video meeting files
- use the current audio-processing path where possible
- allow normal chats to work with meeting recordings and generate meeting notes

This means the requirement is now a **platform-wide chat enhancement**, not only a separate marketplace workflow.

### 3. Smarter code execution

Confirmed direction:

- out of scope for now
- explicitly deferred because of the client demo timeline

What needs to happen:

- nothing for this requirement today

---

## New Capability Notes

### Meeting recordings -> meeting notes

Updated interpretation:

- this requirement now applies to the general chat experience
- `mp3/mp4` support should be added to existing chat upload flows
- the system should process meeting recordings and support note generation from them

Relevant existing groundwork:

- `packages/api/src/files/audio.ts`
- `packages/api/src/files/encode/audio.ts`
- `api/app/clients/BaseClient.js`

No longer the primary interpretation:

- separate marketplace-agent-only implementation


### Smart code execution

Updated interpretation:

- deferred for now
- do not spend implementation time on this before the demo
