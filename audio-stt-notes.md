# Audio / Video STT Notes

## Current Status

- Frontend file selection for `mp3/mp4` is working.
- Uploaded audio reaches `POST /api/files`.
- Backend starts processing immediately.
- The deployed Azure YAML currently has `speech.tts`, but **does not have `speech.stt`**.
- Because STT is not configured end-to-end, audio processing fails fast with the generic 500:
  - `We couldn't process that file.`

## Current Code Diagnosis

- Chat upload selection has been opened up for audio/video.
- The clean end-to-end fix still needs:
  - code-side routing certainty for `audio/video -> context`
  - deployed `speech.stt` config in the actual Azure YAML

### Relevant files

- `client/src/hooks/Files/uploadStrategy.ts`
- `client/src/components/Chat/Input/Files/AttachFileMenu.tsx`
- `api/server/services/Files/process.js`
- `deploy/azure/librechat.azure.yaml`
- `librechat.example.yaml`

## Why It Fails Right Now

1. `speech.stt` exists as an example in `librechat.example.yaml`
2. `speech.stt` is **missing** from `deploy/azure/librechat.azure.yaml`
3. The file reaches `/api/files`
4. Backend processing begins
5. STT-capable processing cannot complete without a real STT provider config

## Recommended Fix

### Code-side

- Ensure uploaded `mp3/mp4` in chat is routed through the `context` transcription path when appropriate.
- Keep existing image/doc flow untouched.

### Deployment-side

- Add `speech.stt` to `deploy/azure/librechat.azure.yaml`
- Prefer `azureOpenAI` STT if staying aligned with the current Azure stack
- Senior/devops needs to confirm:
  - STT deployment name
  - API version
  - actual deploy-time validity of the Azure STT resource

## Browser STT vs Server STT

### Browser STT

- Good for **live microphone dictation**
- Already exists in the app for mic-based speech input
- Not suitable as a quick fix for uploaded `mp3/mp4`
- Would require a different frontend architecture for uploaded-file transcription

### Server-side STT

- Best fit for uploaded audio/video files
- Keeps current upload flow intact
- Better for scale, consistency, and reliability

## Azure Speech Pricing Notes

Source used: Azure Speech pricing page for **East US**

### Speech-to-Text rates

- **Fast Transcription:** `$0.36 per audio hour`
- **Real-time Transcription:** `$1.00 per audio hour`
- **Batch Transcription:** `$0.18 per audio hour`

### Best practical fit

- For uploaded meeting recordings / notes generation:
  - **Fast Transcription** is the most practical balance of cost and usefulness

## Monthly Cost Examples

Using **Fast Transcription = $0.36/hour**

- `100` files/month x `10` min each
  - `1,000` minutes = `16.67` hours
  - Cost: **~$6.00/month**

- `200` files/month x `10` min each
  - `2,000` minutes = `33.33` hours
  - Cost: **~$12.00/month**

- `500` files/month x `10` min each
  - `5,000` minutes = `83.33` hours
  - Cost: **~$30.00/month**

- `1,000` files/month x `15` min each
  - `15,000` minutes = `250` hours
  - Cost: **~$90.00/month**

### Comparison

- Real-time at `$1.00/hour`
  - `33.33` hours = **~$33.33/month**
  - `250` hours = **~$250.00/month**

- Batch at `$0.18/hour`
  - `33.33` hours = **~$6.00/month**
  - `250` hours = **~$45.00/month**

## What To Ask Senior

- Do we already have an Azure STT / transcription deployment?
- If yes, what is the:
  - deployment name
  - API version
- If not, can one be created/provided so `speech.stt.azureOpenAI` can be wired correctly?

## Current Recommendation

- Do **not** pursue browser STT for uploaded files in this branch
- Use the existing backend upload flow
- Add `speech.stt`
- Add the routing fix for audio/video -> `context`
- Prefer **Azure Speech / Azure STT** or a valid Azure OpenAI transcription setup, depending on what infra already exists
