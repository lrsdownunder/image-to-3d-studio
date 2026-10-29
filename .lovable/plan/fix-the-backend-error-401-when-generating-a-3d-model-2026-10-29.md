# Fix the "Backend error 401" when generating a 3D model

## What we know (checked)
- Your GPU server is up and the model is loaded (the page shows "AI server ready · NVIDIA RTX A6000").
- When I send the key from your pod's settings file straight to the GPU server, it gets accepted.
- Your three tries from the website (00:40, 00:41 and 00:43) were all turned away as "Unauthorized", including one after I restarted the app.
- So the key the website sends is still not the one your GPU expects. I don't know the exact cause yet.

## Plan
1. **Add a "key check" to the status bar.** Next to "AI server ready", 3DIT will also try a harmless signed-in request to the GPU and show either "Key accepted" or "Key rejected". This is safe because it never shows the key itself. It tells us right away, without spending a generation, whether the key is right.
2. **Reproduce it myself.** I'll sign into the preview as you, open the Create page and read that check, so you don't need to keep tapping Generate.
3. **Fix based on what the check shows:**
   - If the key is rejected: I'll open a secure form, and you paste in only the value after `GENERATION_BACKEND_TOKEN=` (and the same for the callback secret) from your pod. Each one goes in its own box, with no name and no `=`.
   - If the key is accepted but generating still fails: the job request itself is wrong, and I'll fix the request code.
4. **Make the error clearer.** A 401 on the Create page will show "3DIT's key doesn't match your GPU server. Update the key in settings" instead of the raw error.
5. Run one real generation with a photo and check that the Status box moves past 0%.

## What you'll need to do
- Keep the RunPod pod running and the server terminal open.
- Maybe copy two values from `cat /root/3dit-backend/.env` into a secure form (only if step 3 needs it).

## Technical details
- `getBackendStatus`: add an authenticated `GET /v1/jobs/__keycheck` with `Bearer <token>`. A 404 means the token was accepted and a 401 means it was rejected. Return `tokenAccepted: boolean`. The token value is never logged or returned.
- `create.tsx`: show the result of the key check, and map a 401 job error to a friendly message.
- Verify with Playwright using a minted session and the `stack_modern` server-function logs (preview).
