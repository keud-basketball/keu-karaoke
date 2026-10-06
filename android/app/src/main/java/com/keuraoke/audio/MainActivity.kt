package com.keuraoke.audio

import android.Manifest
import android.app.Activity
import android.content.pm.PackageManager
import android.media.AudioDeviceCallback
import android.media.AudioDeviceInfo
import android.media.AudioManager
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.media.AudioAttributes
import android.media.AudioFocusRequest
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.widget.AdapterView
import android.widget.ArrayAdapter
import android.widget.Button
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.SeekBar
import android.widget.Spinner
import android.widget.Switch
import android.widget.TextView

@Suppress("SetTextI18n")
class MainActivity : Activity() {
    private val mainHandler = Handler(Looper.getMainLooper())
    private lateinit var audioManager: AudioManager
    private lateinit var engine: AudioEngine
    private lateinit var engineStatus: TextView
    private lateinit var diagnostics: TextView
    private lateinit var statusMessage: TextView
    private lateinit var latencyTestButton: Button
    private lateinit var microphoneSwitch: Switch
    private lateinit var monitoringSwitch: Switch
    private lateinit var lowLatencySwitch: Switch
    private lateinit var bypassSwitch: Switch
    private lateinit var echoSwitch: Switch
    private lateinit var reverbSwitch: Switch
    private lateinit var vocalChainSwitch: Switch
    private lateinit var presetSpinner: Spinner
    private lateinit var inputSpinner: Spinner
    private lateinit var outputSpinner: Spinner
    private lateinit var echoAmountLabel: TextView
    private lateinit var echoAmountSeekBar: SeekBar
    private lateinit var echoDelayLabel: TextView
    private lateinit var echoDelaySeekBar: SeekBar
    private lateinit var homeStatus: TextView
    private lateinit var homePage: ScrollView
    private lateinit var studioPage: ScrollView
    private lateinit var settingsPage: ScrollView
    private lateinit var karaokePage: ScrollView
    private lateinit var earMonitoringHomeButton: Button

    private val inputChoices = mutableListOf<DeviceChoice>()
    private val outputChoices = mutableListOf<DeviceChoice>()
    private var selectedInputId: Int? = null
    private var selectedOutputId: Int? = null
    private var engineRequested = false
    private var awaitingDeviceReconnect = false
    private var addedDevicePending = false
    private var permissionRequestPending = false
    private var latencyTestActive = false
    private var deviceCallbackRegistered = false
    private var updatingControls = false
    private var rebuildingDeviceLists = false
    private var removedDevicePending = false
    private var currentPreset = VoicePreset.CLEAN_STUDIO
    private var latestDiagnostics: AudioDiagnostics? = null
    private var audioFocusRequest: AudioFocusRequest? = null
    private var audioFocusGranted = false
    private var audioFocusAvailable = false
    private val audioFocusListener = AudioManager.OnAudioFocusChangeListener { change ->
        mainHandler.post {
            if (::engine.isInitialized) handleAudioFocusChange(change)
        }
    }
    private val restartAfterDeviceChange = Runnable {
        refreshDevices()
        if (awaitingDeviceReconnect && addedDevicePending && hasMicrophonePermission()) {
            awaitingDeviceReconnect = false
            engineRequested = true
            setSwitch(microphoneSwitch, true)
            setSwitch(monitoringSwitch, false)
            startEngine()
            statusMessage.text =
                "Android reported an audio device. The microphone engine restarted; enable Ear Monitoring when the output route is ready."
        } else if (engineRequested && hasMicrophonePermission()) {
            engineStatus.text = "🟡 DEVICE CHANGE"
            homeStatus.text = engineStatus.text
            val pausedMonitor = removedDevicePending && monitoringSwitch.isChecked
            if (pausedMonitor) {
                setSwitch(monitoringSwitch, false)
                abandonAudioFocus()
            }
            engine.stop()
            startEngine()
            statusMessage.text = if (pausedMonitor) {
                "An audio device disconnected. Software monitoring was paused to avoid an unexpected speaker route."
            } else {
                "Audio routing changed. Reinitializing with Android's current device routes."
            }
        }
        removedDevicePending = false
        addedDevicePending = false
    }

    private val deviceCallback = object : AudioDeviceCallback() {
        override fun onAudioDevicesAdded(addedDevices: Array<out AudioDeviceInfo>) {
            addedDevicePending = true
            scheduleDeviceRefresh()
        }

        override fun onAudioDevicesRemoved(removedDevices: Array<out AudioDeviceInfo>) {
            removedDevicePending = true
            addedDevicePending = false
            scheduleDeviceRefresh()
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        audioManager = getSystemService(AudioManager::class.java)
        engine = AudioEngine(
            context = this,
            onReady = { report ->
                mainHandler.post {
                    latestDiagnostics = report
                    engineStatus.text = "🟢 AUDIO READY"
                    if (::homeStatus.isInitialized) homeStatus.text = engineStatus.text
                    statusMessage.text = if (latencyTestActive) {
                        "Latency listening check active. Speak a short syllable and note subjective delay; the app does not measure acoustic round-trip latency."
                    } else {
                        report.fallbackDescription
                            ?: "Microphone audio is local. Software monitoring follows the Ear Monitoring switch."
                    }
                    renderDiagnostics()
                }
            },
            onFailure = { message ->
                mainHandler.post {
                    engineRequested = false
                    latestDiagnostics = null
                    setSwitch(monitoringSwitch, false)
                    setLatencyTestActive(false)
                    engineStatus.text = "🔴 AUDIO UNAVAILABLE"
                    if (::homeStatus.isInitialized) homeStatus.text = engineStatus.text
                    awaitingDeviceReconnect = message.contains("disconnected", ignoreCase = true)
                    setSwitch(microphoneSwitch, awaitingDeviceReconnect)
                    if (awaitingDeviceReconnect) abandonAudioFocus()
                    statusMessage.text = if (awaitingDeviceReconnect) {
                        "$message Monitoring is paused; Android device reconnection will trigger a restart when reported."
                    } else {
                        setSwitch(microphoneSwitch, false)
                        message
                    }
                    if (!awaitingDeviceReconnect) abandonAudioFocus()
                    renderDiagnostics()
                }
            },
        )
        buildInterface()
        refreshDevices()
    }

    override fun onStart() {
        super.onStart()
        if (!deviceCallbackRegistered) {
            audioManager.registerAudioDeviceCallback(deviceCallback, mainHandler)
            deviceCallbackRegistered = true
        }
        refreshDevices()
    }

    override fun onStop() {
        mainHandler.removeCallbacks(restartAfterDeviceChange)
        if (deviceCallbackRegistered) {
            audioManager.unregisterAudioDeviceCallback(deviceCallback)
            deviceCallbackRegistered = false
        }
        val audioWasRequested = engineRequested || awaitingDeviceReconnect
        engineRequested = false
        awaitingDeviceReconnect = false
        addedDevicePending = false
        permissionRequestPending = false
        setLatencyTestActive(false)
        if (::engine.isInitialized) {
            engine.stop()
        }
        abandonAudioFocus()
        if (audioWasRequested) {
            setSwitch(microphoneSwitch, false)
            setSwitch(monitoringSwitch, false)
            latestDiagnostics = null
            engineStatus.text = "🟢 AUDIO READY"
            homeStatus.text = engineStatus.text
            statusMessage.text = "Audio stopped while KEURAOKE is in the background."
            renderDiagnostics()
        }
        super.onStop()
    }

    override fun onDestroy() {
        if (::audioManager.isInitialized && deviceCallbackRegistered) {
            audioManager.unregisterAudioDeviceCallback(deviceCallback)
            deviceCallbackRegistered = false
        }
        if (::engine.isInitialized) engine.stop()
        abandonAudioFocus()
        mainHandler.removeCallbacks(restartAfterDeviceChange)
        super.onDestroy()
    }

    @Suppress("DEPRECATION")
    override fun onRequestPermissionsResult(
        requestCode: Int,
        permissions: Array<out String>,
        grantResults: IntArray,
    ) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode != REQUEST_RECORD_AUDIO) return
        permissionRequestPending = false
        if (!engineRequested) return
        if (grantResults.firstOrNull() == PackageManager.PERMISSION_GRANTED) {
            startEngine()
        } else {
            engineRequested = false
            setSwitch(microphoneSwitch, false)
            setSwitch(monitoringSwitch, false)
            setLatencyTestActive(false)
            engineStatus.text = "🔴 AUDIO UNAVAILABLE"
            homeStatus.text = engineStatus.text
            statusMessage.text =
                "Microphone permission was denied. If Android no longer shows the prompt, allow it in App permissions, then try again."
        }
        renderDiagnostics()
    }

    private fun buildInterface() {
        homePage = ScrollView(this)
        val home = pageContent(homePage)
        home.gravity = Gravity.CENTER_HORIZONTAL
        val logo = ImageView(this).apply {
            setImageResource(R.drawable.keuraoke_logo)
            contentDescription = "KEURAOKE logo"
            scaleType = ImageView.ScaleType.FIT_CENTER
            adjustViewBounds = true
            maxHeight = dp(220)
        }
        home.addView(logo, LinearLayout.LayoutParams(dp(220), dp(220)).apply {
            gravity = Gravity.CENTER_HORIZONTAL
            bottomMargin = dp(8)
        })
        home.addView(label("KEURAOKE", 30f, true).apply {
            gravity = Gravity.CENTER
            setTextColor(Color.WHITE)
        })
        home.addView(label("Your song. Your moment.", 17f).apply {
            gravity = Gravity.CENTER
            setTextColor(Color.LTGRAY)
        })
        home.addView(sectionHeading("SING YOUR WAY"))
        home.addView(navigationButton("🎵  KARAOKE") { showPage(karaokePage) })
        home.addView(navigationButton("🎤  MICROPHONE") {
            showPage(studioPage)
            if (!microphoneSwitch.isChecked) microphoneSwitch.performClick()
        })
        earMonitoringHomeButton = navigationButton("🎧  EAR MONITORING · OFF") {
            showPage(studioPage)
            monitoringSwitch.performClick()
        }
        home.addView(earMonitoringHomeButton)
        home.addView(navigationButton("🎛️  VOCAL PRESETS") { showPage(studioPage) })
        home.addView(navigationButton("⚙️  AUDIO SETTINGS") { showPage(settingsPage) })
        homeStatus = label("🟢 AUDIO READY", 16f, true).apply {
            gravity = Gravity.CENTER
            setTextColor(Color.GREEN)
            setPadding(0, dp(16), 0, dp(8))
        }
        home.addView(homeStatus)
        home.addView(label(
            "Connect wired headphones for the most responsive monitoring. Microphone access is requested only when you turn the mic or monitoring on.",
            14f,
        ).apply { setTextColor(Color.LTGRAY) })

        buildStudioInterface()
        buildSettingsPage()
        buildKaraokePage()
        showPage(homePage)
    }

    private fun buildStudioInterface() {
        val scrollView = ScrollView(this)
        val content = pageContent(scrollView)
        studioPage = scrollView
        content.addView(navigationButton("‹  HOME") { showPage(homePage) })
        content.addView(label("LIVE VOCAL STUDIO", 25f, true).apply { setTextColor(Color.WHITE) })
        content.addView(sectionHeading("MONITORING"))

        microphoneSwitch = switch("MICROPHONE")
        monitoringSwitch = switch("EAR MONITORING")
        content.addView(microphoneSwitch)
        content.addView(monitoringSwitch)

        engineStatus = label("🟢 AUDIO READY", 16f, true)
        content.addView(engineStatus)
        statusMessage = label("Microphone permission is requested only when monitoring or the microphone is enabled.", 14f)
        content.addView(statusMessage)
        latencyTestButton = Button(this).apply {
            text = "⏱️ LATENCY TEST — START"
            setOnClickListener { toggleLatencyTest() }
        }
        content.addView(latencyTestButton)
        content.addView(label(
            "Starts a subjective listening check through the software monitor. The app estimates configured I/O-buffer processing time; actual device-dependent monitoring latency is not measured.",
            13f,
        ))

        content.addView(sectionHeading("VOICE FX"))
        presetSpinner = Spinner(this)
        presetSpinner.adapter = ArrayAdapter(
            this,
            android.R.layout.simple_spinner_dropdown_item,
            VoicePreset.entries.map { it.title },
        )
        content.addView(presetSpinner)
        echoSwitch = switch("ECHO EFFECT")
        echoAmountLabel = label("ECHO AMOUNT 30%", 14f)
        content.addView(echoAmountLabel)
        echoAmountSeekBar = SeekBar(this).apply {
            max = 100
            progress = 30
            contentDescription = "Echo amount from zero to one hundred percent"
        }
        content.addView(echoAmountSeekBar)
        echoDelayLabel = label("DELAY 120 ms", 14f)
        content.addView(echoDelayLabel)
        echoDelaySeekBar = SeekBar(this).apply {
            max = 700
            progress = 120
            contentDescription = "Echo return delay from zero to seven hundred milliseconds"
        }
        content.addView(echoDelaySeekBar)
        reverbSwitch = switch("REVERB EFFECT")
        vocalChainSwitch = switch("VOCAL TONE / COMPRESSION")
        bypassSwitch = switch("FX BYPASS")
        content.addView(echoSwitch)
        content.addView(reverbSwitch)
        content.addView(vocalChainSwitch)
        content.addView(bypassSwitch)

        content.addView(navigationButton("⚙️  AUDIO SETTINGS & DIAGNOSTICS") {
            showPage(settingsPage)
        })
        content.addView(label(
            "For lowest latency, use wired headphones. If you hear two voices, disable or reduce DIRECT MONITOR on your soundcard. Android cannot universally control its hardware direct-monitor path. Keep output volume conservative; the app's soft effect limiter does not prevent hardware feedback.",
            14f,
        ))

        microphoneSwitch.setOnCheckedChangeListener { _, checked ->
            if (updatingControls) return@setOnCheckedChangeListener
            updateHomeMonitoringLabel()
            if (checked) {
                requestMicrophoneAndStart()
            } else {
                engineRequested = false
                awaitingDeviceReconnect = false
                setLatencyTestActive(false)
                setSwitch(monitoringSwitch, false)
                engine.stop()
                latestDiagnostics = null
                abandonAudioFocus()
                engineStatus.text = "🟢 AUDIO READY"
                homeStatus.text = engineStatus.text
                statusMessage.text = "Microphone and software monitoring are off."
                renderDiagnostics()
            }
        }
        monitoringSwitch.setOnCheckedChangeListener { _, checked ->
            if (updatingControls) return@setOnCheckedChangeListener
            updateHomeMonitoringLabel()
            if (checked) {
                setSwitch(microphoneSwitch, true)
                requestMicrophoneAndStart()
            } else {
                engine.setMonitoringEnabled(false)
                abandonAudioFocus()
                setLatencyTestActive(false)
                statusMessage.text =
                    "Software monitoring is off. The microphone can remain active; check the soundcard's direct-monitor control separately."
            }
        }
        presetSpinner.onItemSelectedListener = object : AdapterView.OnItemSelectedListener {
            override fun onNothingSelected(parent: AdapterView<*>?) = Unit

            override fun onItemSelected(parent: AdapterView<*>?, view: View?, position: Int, id: Long) {
                val nextPreset = VoicePreset.entries[position]
                if (nextPreset == currentPreset) return
                currentPreset = nextPreset
                configurePresetDefaults(nextPreset)
                engine.setPreset(nextPreset)
            }
        }
        echoSwitch.setOnCheckedChangeListener { _, checked ->
            if (!updatingControls) engine.setEchoEnabled(checked)
        }
        reverbSwitch.setOnCheckedChangeListener { _, checked ->
            if (!updatingControls) engine.setReverbEnabled(checked)
        }
        vocalChainSwitch.setOnCheckedChangeListener { _, checked ->
            if (!updatingControls) engine.setVocalChainEnabled(checked)
        }
        bypassSwitch.setOnCheckedChangeListener { _, checked ->
            if (!updatingControls) engine.setFxBypassed(checked)
        }
        echoAmountSeekBar.setOnSeekBarChangeListener(object : SeekBar.OnSeekBarChangeListener {
            override fun onProgressChanged(seekBar: SeekBar?, progress: Int, fromUser: Boolean) {
                echoAmountLabel.text = "ECHO AMOUNT $progress%"
                engine.setEchoAmountPercent(progress)
            }

            override fun onStartTrackingTouch(seekBar: SeekBar?) = Unit
            override fun onStopTrackingTouch(seekBar: SeekBar?) = Unit
        })
        echoDelaySeekBar.setOnSeekBarChangeListener(object : SeekBar.OnSeekBarChangeListener {
            override fun onProgressChanged(seekBar: SeekBar?, progress: Int, fromUser: Boolean) {
                echoDelayLabel.text = "DELAY $progress ms"
                engine.setEchoDelayMs(progress)
            }

            override fun onStartTrackingTouch(seekBar: SeekBar?) = Unit
            override fun onStopTrackingTouch(seekBar: SeekBar?) = Unit
        })
    }

    private fun buildSettingsPage() {
        settingsPage = ScrollView(this)
        val content = pageContent(settingsPage)
        content.addView(navigationButton("‹  HOME") { showPage(homePage) })
        content.addView(label("AUDIO SETTINGS", 25f, true).apply { setTextColor(Color.WHITE) })
        lowLatencySwitch = switch("REQUEST LOW-LATENCY AUDIO")
        lowLatencySwitch.isChecked = true
        content.addView(lowLatencySwitch)
        content.addView(label(
            "Android may ignore the low-latency output request or use a larger device buffer. AudioRecord does not expose the same low-latency performance-mode option.",
            13f,
        ))

        content.addView(sectionHeading("INPUT DEVICE"))
        inputSpinner = Spinner(this)
        content.addView(inputSpinner)
        content.addView(sectionHeading("OUTPUT DEVICE"))
        outputSpinner = Spinner(this)
        content.addView(outputSpinner)
        content.addView(sectionHeading("AUDIO DIAGNOSTICS"))
        diagnostics = label("🟢 AUDIO READY\nMicrophone permission: not requested", 14f)
        content.addView(diagnostics)
        content.addView(label(
            "If you hear two voices, reduce or disable DIRECT MONITOR on your soundcard. Android cannot control that hardware switch. Wired headphones are recommended; Bluetooth may add noticeable monitoring delay.",
            14f,
        ))

        lowLatencySwitch.setOnCheckedChangeListener { _, checked ->
            if (updatingControls) return@setOnCheckedChangeListener
            engine.setLowLatencyMode(checked)
            if (engineRequested) scheduleDeviceRefresh()
        }
    }

    private fun buildKaraokePage() {
        karaokePage = ScrollView(this)
        val content = pageContent(karaokePage)
        content.addView(navigationButton("‹  HOME") { showPage(homePage) })
        content.addView(label("KARAOKE", 25f, true).apply { setTextColor(Color.WHITE) })
        content.addView(label(
            "Find a song, then sing along with official karaoke playback.",
            18f,
        ))
        content.addView(label(
            "Native YouTube playback is not enabled in this audio prototype. Open KEURAOKE in your browser for the official embedded player. Microphone monitoring remains a separate native audio path.",
            15f,
        ))
        content.addView(navigationButton("🎤  OPEN LIVE VOCAL STUDIO") { showPage(studioPage) })
    }

    private fun pageContent(scrollView: ScrollView): LinearLayout =
        LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(20), dp(18), dp(20), dp(28))
            setBackgroundColor(Color.rgb(10, 14, 32))
            scrollView.addView(
                this,
                ViewGroup.LayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT,
                    ViewGroup.LayoutParams.WRAP_CONTENT,
                ),
            )
        }

    private fun showPage(page: ScrollView) {
        page.scrollTo(0, 0)
        setContentView(page)
    }

    private fun navigationButton(text: String, action: () -> Unit): Button =
        Button(this).apply {
            this.text = text
            textSize = 16f
            setTextColor(Color.WHITE)
            background = GradientDrawable().apply {
                setColor(Color.rgb(27, 47, 91))
                cornerRadius = dp(12).toFloat()
            }
            setPadding(dp(14), dp(10), dp(14), dp(10))
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT,
            ).apply {
                topMargin = dp(6)
                bottomMargin = dp(6)
            }
            setOnClickListener { action() }
        }

    private fun updateHomeMonitoringLabel() {
        if (!::earMonitoringHomeButton.isInitialized || !::monitoringSwitch.isInitialized) return
        earMonitoringHomeButton.text =
            if (monitoringSwitch.isChecked) "🎧  EAR MONITORING · ON" else "🎧  EAR MONITORING · OFF"
    }

    private fun toggleLatencyTest() {
        if (latencyTestActive) {
            setLatencyTestActive(false)
            setSwitch(monitoringSwitch, false)
            engine.setMonitoringEnabled(false)
            statusMessage.text = "Latency listening check stopped. The microphone can remain active."
            return
        }

        setLatencyTestActive(true)
        setSwitch(microphoneSwitch, true)
        setSwitch(monitoringSwitch, true)
        statusMessage.text =
            "Latency listening check starting. Speak a short syllable and note subjective delay; the displayed estimate is not a measured round trip."
        requestMicrophoneAndStart()
    }

    private fun setLatencyTestActive(active: Boolean) {
        latencyTestActive = active
        if (::latencyTestButton.isInitialized) {
            latencyTestButton.text = if (active) {
                "⏱️ LATENCY TEST — STOP"
            } else {
                "⏱️ LATENCY TEST — START"
            }
        }
    }

    private fun requestMicrophoneAndStart() {
        if (!hasMicrophonePermission()) {
            if (permissionRequestPending) return
            permissionRequestPending = true
            engineRequested = true
            statusMessage.text = "Requesting microphone permission…"
            requestPermissions(arrayOf(Manifest.permission.RECORD_AUDIO), REQUEST_RECORD_AUDIO)
            return
        }
        startEngine()
    }

    private fun startEngine() {
        if (!hasMicrophonePermission()) return
        if (monitoringSwitch.isChecked && !requestAudioFocus()) {
            engineRequested = false
            engine.stop()
            setSwitch(microphoneSwitch, false)
            setSwitch(monitoringSwitch, false)
            engineStatus.text = "🔴 AUDIO UNAVAILABLE"
            homeStatus.text = engineStatus.text
            statusMessage.text = "Audio focus is unavailable. Close another audio session and try again."
            renderDiagnostics()
            return
        }
        engineRequested = true
        engineStatus.text = "🟡 AUDIO STARTING"
        homeStatus.text = engineStatus.text
        statusMessage.text = "Opening the microphone and requesting the lowest stable Android audio path…"
        latestDiagnostics = null
        engine.setPreset(currentPreset)
        engine.setEchoEnabled(echoSwitch.isChecked)
        engine.setEchoAmountPercent(echoAmountSeekBar.progress)
        engine.setEchoDelayMs(echoDelaySeekBar.progress)
        engine.setReverbEnabled(reverbSwitch.isChecked)
        engine.setVocalChainEnabled(vocalChainSwitch.isChecked)
        engine.setFxBypassed(bypassSwitch.isChecked)
        engine.setLowLatencyMode(lowLatencySwitch.isChecked)
        engine.setMonitoringEnabled(monitoringSwitch.isChecked)
        engine.start(selectedInputId, selectedOutputId)
        renderDiagnostics()
    }

    private fun requestAudioFocus(): Boolean {
        if (audioFocusGranted) return audioFocusAvailable
        val request = audioFocusRequest
            ?: AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT)
                .setAudioAttributes(
                    AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_MEDIA)
                        .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                        .build(),
                )
                .setOnAudioFocusChangeListener(audioFocusListener, mainHandler)
                .build()
                .also { audioFocusRequest = it }
        audioFocusGranted =
            audioManager.requestAudioFocus(request) == AudioManager.AUDIOFOCUS_REQUEST_GRANTED
        audioFocusAvailable = audioFocusGranted
        return audioFocusGranted
    }

    private fun abandonAudioFocus() {
        if (!audioFocusGranted) return
        audioFocusRequest?.let(audioManager::abandonAudioFocusRequest)
        audioFocusGranted = false
        audioFocusAvailable = false
    }

    private fun handleAudioFocusChange(change: Int) {
        when (change) {
            AudioManager.AUDIOFOCUS_GAIN -> {
                if (audioFocusGranted) audioFocusAvailable = true
                statusMessage.text =
                    "Audio focus returned. Ear Monitoring remains off until you turn it on again."
            }
            AudioManager.AUDIOFOCUS_LOSS_TRANSIENT,
            AudioManager.AUDIOFOCUS_LOSS_TRANSIENT_CAN_DUCK,
            AudioManager.AUDIOFOCUS_LOSS,
            -> {
                audioFocusAvailable = false
                setSwitch(monitoringSwitch, false)
                engine.setMonitoringEnabled(false)
                if (change == AudioManager.AUDIOFOCUS_LOSS) {
                    engineRequested = false
                    setSwitch(microphoneSwitch, false)
                    engine.stop()
                    abandonAudioFocus()
                }
                statusMessage.text = "Audio focus changed. Software monitoring was stopped for safety."
                renderDiagnostics()
            }
        }
    }

    private fun configurePresetDefaults(value: VoicePreset) {
        val echo = value.profile.echoMix > 0f
        val reverb = value.profile.reverbMix > 0f
        val vocalChain = value != VoicePreset.CLEAN_STUDIO
        updatingControls = true
        echoSwitch.isChecked = echo
        reverbSwitch.isChecked = reverb
        vocalChainSwitch.isChecked = vocalChain
        updatingControls = false
        engine.setEchoEnabled(echo)
        engine.setReverbEnabled(reverb)
        engine.setVocalChainEnabled(vocalChain)
    }

    private fun refreshDevices() {
        if (!::inputSpinner.isInitialized) return
        val inputs = audioManager.getDevices(AudioManager.GET_DEVICES_INPUTS)
            .sortedBy { inputRoutePriority(it.type) }
            .map { DeviceChoice(it.id, "${it.productName} — ${deviceTypeName(it.type)}") }
        val outputs = audioManager.getDevices(AudioManager.GET_DEVICES_OUTPUTS)
            .sortedBy { outputRoutePriority(it.type) }
            .map { DeviceChoice(it.id, "${it.productName} — ${deviceTypeName(it.type)}") }
        val oldInputId = selectedInputId
        val oldOutputId = selectedOutputId
        inputChoices.clear()
        inputChoices.add(DeviceChoice(null, "System-selected input"))
        inputChoices.addAll(inputs)
        outputChoices.clear()
        outputChoices.add(DeviceChoice(null, "System-selected output"))
        outputChoices.addAll(outputs)
        if (oldInputId != null && inputs.none { it.id == oldInputId }) selectedInputId = null
        if (oldOutputId != null && outputs.none { it.id == oldOutputId }) selectedOutputId = null

        rebuildingDeviceLists = true
        inputSpinner.adapter = deviceAdapter(inputChoices)
        outputSpinner.adapter = deviceAdapter(outputChoices)
        inputSpinner.setSelection(inputChoices.indexOfFirst { it.id == selectedInputId }.coerceAtLeast(0))
        outputSpinner.setSelection(outputChoices.indexOfFirst { it.id == selectedOutputId }.coerceAtLeast(0))
        setDeviceSelectionListener(inputSpinner, inputChoices, true)
        setDeviceSelectionListener(outputSpinner, outputChoices, false)
        rebuildingDeviceLists = false
        renderDiagnostics()
    }

    private fun deviceAdapter(choices: List<DeviceChoice>): ArrayAdapter<DeviceChoice> =
        ArrayAdapter(this, android.R.layout.simple_spinner_dropdown_item, choices)

    private fun setDeviceSelectionListener(
        spinner: Spinner,
        choices: List<DeviceChoice>,
        input: Boolean,
    ) {
        spinner.onItemSelectedListener = object : AdapterView.OnItemSelectedListener {
            override fun onNothingSelected(parent: AdapterView<*>?) = Unit

            override fun onItemSelected(parent: AdapterView<*>?, view: View?, position: Int, id: Long) {
                if (rebuildingDeviceLists) return
                val choice = choices.getOrNull(position) ?: return
                if (input) {
                    if (choice.id == selectedInputId) return
                    selectedInputId = choice.id
                } else {
                    if (choice.id == selectedOutputId) return
                    selectedOutputId = choice.id
                }
                if (engineRequested) scheduleDeviceRefresh()
            }
        }
    }

    private fun scheduleDeviceRefresh() {
        mainHandler.removeCallbacks(restartAfterDeviceChange)
        mainHandler.postDelayed(restartAfterDeviceChange, DEVICE_CHANGE_DEBOUNCE_MS)
    }

    private fun renderDiagnostics() {
        if (!::diagnostics.isInitialized) return
        val report = latestDiagnostics
        val inputs = audioManager.getDevices(AudioManager.GET_DEVICES_INPUTS)
        val outputs = audioManager.getDevices(AudioManager.GET_DEVICES_OUTPUTS)
        val usbDetected = (inputs + outputs).any {
            it.type == AudioDeviceInfo.TYPE_USB_DEVICE || it.type == AudioDeviceInfo.TYPE_USB_HEADSET
        }
        val bluetoothDetected = outputs.any {
            it.type == AudioDeviceInfo.TYPE_BLUETOOTH_A2DP ||
                it.type == AudioDeviceInfo.TYPE_BLUETOOTH_SCO ||
                (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S &&
                    (it.type == AudioDeviceInfo.TYPE_BLE_HEADSET ||
                        it.type == AudioDeviceInfo.TYPE_BLE_SPEAKER))
        }
        val bluetoothWarning = if (bluetoothDetected) {
            "\nBluetooth may introduce significant monitoring latency. Wired headphones are recommended for singing."
        } else {
            ""
        }
        val permission = if (hasMicrophonePermission()) "granted" else "not granted"
        val details = if (report == null) {
            "Input device: ${selectedDeviceName(inputChoices, selectedInputId)}\n" +
                "Output device: ${selectedDeviceName(outputChoices, selectedOutputId)}\n" +
                "Sample rate: not active\n" +
                "Channels: not active\n" +
                "Frames per burst: not active\n" +
                "AudioRecord buffer: not active\n" +
                "AudioTrack buffer: not active\n" +
                "Audio API: native AudioRecord + AudioTrack\n" +
                "Low-latency feature: ${if (supportsLowLatencyFeature()) "available" else "not reported"}\n" +
                "USB audio: ${if (usbDetected) "detected" else "not detected"}\n" +
                "Bluetooth output: ${if (bluetoothDetected) "detected" else "not detected"}\n" +
                "Ear Monitoring: ${if (monitoringSwitch.isChecked) "ON" else "OFF"}\n" +
                "Echo amount: ${echoAmountSeekBar.progress}%\n" +
                "Echo delay: ${echoDelaySeekBar.progress} ms\n" +
                "Estimated latency — device dependent: unavailable until the engine is running\n" +
                "Actual monitoring latency: device-dependent; not measured"
        } else {
            val rating = latencyRating(report.estimatedLatencyMs)
            val audioMode = if (report.lowLatencyRequested) {
                "AudioRecord buffered; low-latency AudioTrack requested"
            } else {
                "AudioRecord buffered; standard AudioTrack fallback"
            }
            val speakerWarning = if (report.outputName.contains("speaker", ignoreCase = true)) {
                "\nWarning: speaker output appears active; use headphones to reduce feedback."
            } else {
                ""
            }
            "Input device: ${report.inputName}\n" +
                "Output device: ${report.outputName}\n" +
                "Sample rate: ${report.sampleRate} Hz\n" +
                "Frames per burst: ${report.framesPerBurst}\n" +
                "AudioRecord buffer: ${report.inputBufferFrames} frames\n" +
                "AudioTrack buffer: ${report.outputBufferFrames} frames\n" +
                "Channels: ${report.inputChannels} input / ${report.outputChannels} output\n" +
                "Capture source: ${report.inputSource}\n" +
                "Audio API / mode: $audioMode\n" +
                "Low-latency feature: ${if (report.lowLatencyFeature) "available" else "not reported"}\n" +
                "USB audio: ${if (usbDetected) "detected" else "not detected"}\n" +
                "Bluetooth output: ${if (bluetoothDetected) "detected" else "not detected"}\n" +
                "Ear Monitoring: ${if (monitoringSwitch.isChecked) "ON" else "OFF"}\n" +
                "Echo amount: ${echoAmountSeekBar.progress}%\n" +
                "Echo delay: ${echoDelaySeekBar.progress} ms\n" +
                "Estimated latency — device dependent (configured I/O buffers): ~${report.estimatedLatencyMs} ms — $rating\n" +
                "Actual monitoring latency: device-dependent; not measured. This estimate is not a measured round-trip result." +
                speakerWarning +
                (report.fallbackDescription?.let { "\nFallback / routing note: $it" } ?: "")
        }
        diagnostics.text =
            "${engineStatus.text}\nMicrophone permission: $permission\n$details$bluetoothWarning"
    }

    private fun selectedDeviceName(choices: List<DeviceChoice>, id: Int?): String =
        choices.firstOrNull { it.id == id }?.label ?: "System selected"

    private fun inputRoutePriority(type: Int): Int = when (type) {
        AudioDeviceInfo.TYPE_WIRED_HEADSET -> 0
        AudioDeviceInfo.TYPE_USB_DEVICE, AudioDeviceInfo.TYPE_USB_HEADSET -> 1
        AudioDeviceInfo.TYPE_BUILTIN_MIC -> 2
        AudioDeviceInfo.TYPE_BLUETOOTH_SCO, AudioDeviceInfo.TYPE_BLE_HEADSET -> 3
        else -> 4
    }

    private fun outputRoutePriority(type: Int): Int = when (type) {
        AudioDeviceInfo.TYPE_WIRED_HEADPHONES, AudioDeviceInfo.TYPE_WIRED_HEADSET -> 0
        AudioDeviceInfo.TYPE_USB_DEVICE, AudioDeviceInfo.TYPE_USB_HEADSET -> 1
        AudioDeviceInfo.TYPE_BUILTIN_EARPIECE, AudioDeviceInfo.TYPE_BUILTIN_SPEAKER -> 2
        AudioDeviceInfo.TYPE_BLUETOOTH_A2DP, AudioDeviceInfo.TYPE_BLUETOOTH_SCO,
        AudioDeviceInfo.TYPE_BLE_HEADSET, AudioDeviceInfo.TYPE_BLE_SPEAKER -> 3
        else -> 4
    }

    private fun supportsLowLatencyFeature(): Boolean =
        packageManager.hasSystemFeature(PackageManager.FEATURE_AUDIO_LOW_LATENCY)

    private fun hasMicrophonePermission(): Boolean =
        checkSelfPermission(Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED

    private fun latencyRating(milliseconds: Int): String = when {
        milliseconds <= 10 -> "🟢 VERY LOW"
        milliseconds <= 20 -> "🟡 LOW"
        milliseconds <= 40 -> "🟠 NOTICEABLE"
        else -> "🔴 HIGH"
    }

    private fun switch(text: String): Switch = Switch(this).apply {
        this.text = text
        textSize = 15f
        setTextColor(Color.WHITE)
        setPadding(0, dp(4), 0, dp(4))
    }

    private fun label(text: String, size: Float, bold: Boolean = false): TextView =
        TextView(this).apply {
            this.text = text
            textSize = size
            setTextColor(Color.WHITE)
            if (bold) setTypeface(typeface, Typeface.BOLD)
            setPadding(0, dp(5), 0, dp(5))
        }

    private fun sectionHeading(text: String): TextView =
        label(text, 18f, true).apply {
            setTextColor(Color.rgb(104, 181, 255))
            setPadding(0, dp(22), 0, dp(8))
        }

    private fun setSwitch(control: Switch, value: Boolean) {
        updatingControls = true
        control.isChecked = value
        updatingControls = false
        if (::monitoringSwitch.isInitialized && control === monitoringSwitch) {
            updateHomeMonitoringLabel()
        }
    }

    private fun dp(value: Int): Int = (value * resources.displayMetrics.density).toInt()

    private data class DeviceChoice(val id: Int?, val label: String) {
        override fun toString(): String = label
    }

    private companion object {
        const val REQUEST_RECORD_AUDIO = 1001
        const val DEVICE_CHANGE_DEBOUNCE_MS = 500L
    }
}
