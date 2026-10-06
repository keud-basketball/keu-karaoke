# KEU KARAOKE

KEU Karaoke is a mobile-first karaoke discovery and playback web app powered by YouTube.

Search for a song, choose a karaoke-focused result, and sing along using the official YouTube embedded player. KEU uses the official YouTube Data API for search and does not download, store, or re-host YouTube media.

Searches can be song titles or artist names; the server adds karaoke focus to the YouTube query. Up to 10 successful search terms are saved locally in the browser and can be cleared from the Recent Searches list.

Save individual results to My Karaoke to keep their video ID, title, channel, and thumbnail in browser local storage. Favorites are separate from Recent Searches and do not make additional YouTube API requests.

Add results to the local Up Next queue in order. Queue entries store only the video ID, title, channel, and thumbnail, and can be played in the official embedded player.

The karaoke watch page includes a plain performance recorder with a microphone selector populated from the browser's available audio inputs. It records only the selected microphone input in the browser's supported recording format; the official YouTube player is not captured or mixed into the recording. No vocal effects, Web Audio routing, or automatic gain control are used. A lightweight noise-reduction option is on by default and requests the browser's built-in microphone noise suppression; availability and behavior depend on the browser and device. The input's original sample rate and channels are not explicitly changed, and the browser determines the practical recording codec and quality. Recordings can be played back and posted inside KEURAOKE Socials; there is no recording download action. Existing local posts remain in the browser; new shared posts require Google sign-in and are stored in Supabase with their microphone-only performance recording. Socials recordings and artist pictures use private Storage buckets and are available to authenticated KEURAOKE users. Microphone permission is requested only when recording starts. USB microphones and soundcards are supported when exposed by the browser; unavailable selected devices fall back to the system default for the next recording.

Google is the only login provider. Users choose a public Recording Artist Name and an optional profile picture; Google account email addresses are not stored in the KEURAOKE profile table or displayed in Socials. Profile ownership, posts, likes, comments, and Storage access are protected by Supabase Row Level Security policies.

The browser and recording format determine the practical sample rate, channels, and codec. KEURAOKE does not normalize or resample the captured recording; the browser may still apply device-level behavior despite the requested capture constraints.

## Native Android app

The `android/app/` directory is a separate native Kotlin audio-monitoring prototype, not part of the browser recording path. Its software monitor path is Android `AudioRecord` → local DSP → `AudioTrack`; it does not capture YouTube playback, record/export audio, or send microphone audio over a network. The app requests microphone permission only when the microphone or Ear Monitoring is activated. The supplied logo is used on startup (the Android system splash on 12+, a themed launch background on earlier versions) and the app home screen; the original logo asset is retained at `android/app/src/main/res/drawable-nodpi/keuraoke_logo.png`. The existing launcher icon is retained rather than cropping the full logo into an unsuitable icon.

The native app includes a karaoke placeholder, a live vocal studio, an Ear Monitoring control, and a separate Audio Settings/Diagnostics screen. The karaoke placeholder directs users to the web app's official YouTube embedded player; YouTube audio remains separate from native microphone monitoring. Eleven native preset profiles are available: CLEAN STUDIO, STUDIO LEAD, 80s ROMANTIC, 80s AOR, 80s POWER BALLAD, 80s CCM, 80s RADIO, 80s ROCK, CONCERT, ECHO, and REVERB. They use short feedback/reflection DSP only; pitch correction and harmony are not simulated.

The engine requests Android's low-latency performance mode for `AudioTrack` and configures each buffer to the greater of its platform minimum or a two-output-burst target in low-latency mode (four bursts in standard fallback mode). It prefers advertised common input/output sample rates, then the output-native rate. Capture prefers `UNPROCESSED` when Android reports support, then falls back through `VOICE_RECOGNITION` and `MIC`. Android's public `AudioRecord.Builder` has no corresponding low-latency performance-mode request, so capture latency remains device-dependent. **LATENCY TEST** is a subjective listening check; the estimate uses configured I/O buffer capacities plus any deliberately added offset and is not measured round-trip latency. The manual offset defaults to 0 ms. Turning Ear Monitoring off pauses and flushes the sole software output path; toggling it does not create another engine.

The settings and diagnostics report selected/active routes, sample rate, channels, frames per burst, AudioRecord/AudioTrack buffer sizes, USB/Bluetooth visibility, monitor state, offset, and a device-dependent buffer estimate. Device changes are debounced and the audio session is restarted when Android reports a route/device change. Wired headset and USB choices are listed ahead of built-in and Bluetooth outputs. USB routing remains dependent on the Android device and interface. The app cannot disable a soundcard's physical DIRECT MONITOR switch; reduce or disable it if you hear a dry voice alongside the processed monitor. Bluetooth can introduce noticeable delay, so wired headphones are recommended.

### Build and install on Android

1. Install Android Studio with Android SDK Platform 36 and Android SDK Build-Tools. Open this repository's root folder and allow Gradle sync. The native module uses Android Gradle Plugin 9, its built-in Kotlin support, and the included Gradle 9.8.0 wrapper; Android Studio may prompt to install compatible build tools.
2. Build a debug APK either with Android Studio's **Build > Build APK(s)** action or, from this repository root with a configured Android SDK, run:

   ```bash
   ./gradlew :app:assembleDebug
   ```

3. Install the generated `android/app/build/outputs/apk/debug/app-debug.apk` by USB with Android Platform Tools:

   ```bash
   adb install -r android/app/build/outputs/apk/debug/app-debug.apk
   ```

   Alternatively, transfer that APK to the phone and open it. Android may ask you to allow installs from that file manager.

4. On the phone, open **KEURAOKE**, connect wired headphones and (for USB tests) the USB audio interface, select the exposed input/output devices in Audio Settings if listed, and enable **MICROPHONE** or **EAR MONITORING** to trigger the microphone permission prompt. Keep the app visible during tests; leaving the app stops the audio engine.

5. Try CLEAN STUDIO, STUDIO LEAD, the 80s presets, CONCERT, ECHO, and REVERB; switch presets while monitoring and repeat Ear Monitoring ON/OFF. Run the hardware checks separately:
   - Phone microphone → wired headphones.
   - USB soundcard microphone → wired headphones.
   - USB soundcard and its microphone input → KEURAOKE → wired headphones.
   - Bluetooth output (expect potentially significant delay).

   For each check, note input device, output device, sample rate, input/output buffer sizes, the app's estimated latency, subjective delay, double voice (yes/no), feedback (yes/no), and whether the selected FX worked. Do not hear the soundcard's direct monitor and KEURAOKE's software monitor together while judging delay. Use the app's device-dependent estimate only as a buffer diagnostic; actual monitoring latency and USB routing must be validated on the target phone and interface.

Physical Android/USB audio hardware was not available for this build. Device-specific input/output routing, actual monitoring delay, stability, all preset sound, repeated monitor toggling, USB reconnect behavior, and soundcard direct-monitor behavior still require real-hardware testing; the estimate is not an acoustic or round-trip measurement.

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create `.env.local` in the project root. Copy the YouTube and Supabase settings from `.env.example`:

   ```env
   YOUTUBE_API_KEY=your_youtube_api_key_here
   NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_or_publishable_key
   ```

   `NEXT_PUBLIC_SUPABASE_ANON_KEY` is the Supabase public anon/publishable key and is intended for browser use; database access is restricted by RLS. Never put a Supabase service-role key in a `NEXT_PUBLIC_` variable or browser code. Keep `.env.local` private; it is ignored by git.

3. Configure Google OAuth for the existing Supabase project:
   1. Keep using the existing project URL and public anon/publishable key in `.env.local`. The `profiles`, `social_posts`, `social_post_likes`, and `social_post_comments` tables, RLS policies, and private `avatars` and `social-recordings` buckets are already provisioned; do not rerun or create another migration or buckets.
   2. In Google Cloud Console, configure the OAuth consent screen and create an OAuth client with application type **Web application**. Add `http://localhost:3000` and your production site origin to **Authorized JavaScript origins**. Add the Supabase callback shown in **Supabase → Authentication → Providers → Google** (usually `https://<project-ref>.supabase.co/auth/v1/callback`) to **Authorized redirect URIs**.
   3. In **Supabase → Authentication → Providers**, enable Google and enter the Google OAuth client ID and client secret. Disable Email and every other provider so Google is the only login method. Keep the client secret in Supabase only; it is not needed in this application's environment variables.
   4. In **Supabase → Authentication → URL Configuration**, set the Site URL to your production origin and allow `http://localhost:3000/auth/callback` plus the exact callback URL for each Vercel production/preview origin. Add custom domains and Vercel preview domains as needed. KEURAOKE uses the current browser origin for the callback; no application callback origin is hardcoded.
   5. In Vercel project settings, add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` for the environments you deploy, then redeploy. Also add `YOUTUBE_API_KEY` there as before.

   Supabase and Google Cloud dashboard configuration is required; the application does not create OAuth credentials or enable a Google provider automatically. Do not add email/password, another OAuth provider, or the Supabase service-role key.

4. Start the development server:

   ```bash
   npm run dev
   ```

5. Open the app at [http://localhost:3000](http://localhost:3000). Browsing and karaoke search work without signing in; Google login is needed for an artist profile and shared Socials posts.

The API key is used only by the server-side `/api/search` route. Playback uses the official YouTube embedded player and remains subject to YouTube availability and embedding restrictions.

## Validation

```bash
npm run lint
npm run typecheck
npm run build
```
