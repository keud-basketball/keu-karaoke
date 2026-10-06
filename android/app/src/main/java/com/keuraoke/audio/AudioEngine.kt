package com.keuraoke.audio

import android.annotation.SuppressLint
import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.media.AudioDeviceInfo
import android.media.AudioFormat
import android.media.AudioManager
import android.media.AudioRecord
import android.media.AudioTrack
import android.media.MediaRecorder
import android.os.Process
import kotlin.math.abs
import kotlin.math.max
import kotlin.math.min

data class VocalPresetProfile(
    val echoMix: Float = 0f,
    val echoFeedback: Float = 0f,
    val earlyReflectionMs: Int = 0,
    val lateReflectionMs: Int = 0,
    val reverbMix: Float = 0f,
    val earlyFeedback: Float = 0f,
    val lateFeedback: Float = 0f,
    val lowMidCut: Float = 0f,
    val presence: Float = 0f,
    val compressorThreshold: Float = 32_000f,
    val compressorRatio: Float = 1f,
    val saturation: Float = 1f,
)

enum class VoicePreset(val title: String, val profile: VocalPresetProfile) {
    CLEAN_STUDIO("CLEAN STUDIO", VocalPresetProfile()),
    STUDIO_LEAD(
        "STUDIO LEAD",
        VocalPresetProfile(earlyReflectionMs = 18, lateReflectionMs = 38, reverbMix = 0.045f,
            earlyFeedback = 0.12f, lateFeedback = 0.08f, presence = 0.1f,
            compressorThreshold = 20_000f, compressorRatio = 2f, saturation = 1.015f),
    ),
    EIGHTIES_ROMANTIC(
        "80s ROMANTIC",
        VocalPresetProfile(earlyReflectionMs = 24, lateReflectionMs = 54, reverbMix = 0.1f,
            earlyFeedback = 0.18f, lateFeedback = 0.12f, presence = 0.04f,
            compressorThreshold = 19_000f, compressorRatio = 1.8f, saturation = 1.02f),
    ),
    EIGHTIES_AOR(
        "80s AOR",
        VocalPresetProfile(echoMix = 0.075f, echoFeedback = 0.12f,
            earlyReflectionMs = 18, lateReflectionMs = 42, reverbMix = 0.06f,
            earlyFeedback = 0.12f, lateFeedback = 0.08f, lowMidCut = 0.14f,
            presence = 0.16f, compressorThreshold = 17_000f, compressorRatio = 2.4f,
            saturation = 1.045f),
    ),
    EIGHTIES_POWER_BALLAD(
        "80s POWER BALLAD",
        VocalPresetProfile(echoMix = 0.09f, echoFeedback = 0.16f,
            earlyReflectionMs = 28, lateReflectionMs = 78, reverbMix = 0.12f,
            earlyFeedback = 0.2f, lateFeedback = 0.15f, presence = 0.07f,
            compressorThreshold = 18_000f, compressorRatio = 2.2f, saturation = 1.025f),
    ),
    EIGHTIES_CCM(
        "80s CCM",
        VocalPresetProfile(earlyReflectionMs = 22, lateReflectionMs = 48, reverbMix = 0.075f,
            earlyFeedback = 0.14f, lateFeedback = 0.1f, presence = 0.12f,
            compressorThreshold = 20_000f, compressorRatio = 1.8f, saturation = 1.015f),
    ),
    EIGHTIES_RADIO(
        "80s RADIO",
        VocalPresetProfile(earlyReflectionMs = 10, lateReflectionMs = 24, reverbMix = 0.025f,
            earlyFeedback = 0.08f, lateFeedback = 0.05f, lowMidCut = 0.08f,
            presence = 0.16f, compressorThreshold = 15_000f, compressorRatio = 2.8f,
            saturation = 1.025f),
    ),
    EIGHTIES_ROCK(
        "80s ROCK",
        VocalPresetProfile(echoMix = 0.05f, echoFeedback = 0.1f,
            earlyReflectionMs = 18, lateReflectionMs = 42, reverbMix = 0.055f,
            earlyFeedback = 0.1f, lateFeedback = 0.07f, lowMidCut = 0.12f,
            presence = 0.2f, compressorThreshold = 16_000f, compressorRatio = 2.5f,
            saturation = 1.07f),
    ),
    CONCERT(
        "CONCERT",
        VocalPresetProfile(earlyReflectionMs = 16, lateReflectionMs = 34, reverbMix = 0.095f,
            earlyFeedback = 0.12f, lateFeedback = 0.07f, presence = 0.06f,
            compressorThreshold = 18_000f, compressorRatio = 2.2f, saturation = 1.02f),
    ),
    ECHO(
        "ECHO",
        VocalPresetProfile(echoMix = 0.24f, echoFeedback = 0.18f,
            presence = 0.04f, compressorThreshold = 22_000f, compressorRatio = 1.5f),
    ),
    REVERB(
        "REVERB",
        VocalPresetProfile(earlyReflectionMs = 36, lateReflectionMs = 88, reverbMix = 0.17f,
            earlyFeedback = 0.22f, lateFeedback = 0.16f, presence = 0.03f,
            compressorThreshold = 22_000f, compressorRatio = 1.5f),
    ),
}

data class AudioDiagnostics(
    val inputName: String,
    val outputName: String,
    val sampleRate: Int,
    val framesPerBurst: Int,
    val inputBufferFrames: Int,
    val outputBufferFrames: Int,
    val inputChannels: Int,
    val outputChannels: Int,
    val inputSource: String,
    val lowLatencyRequested: Boolean,
    val fallbackDescription: String?,
    val estimatedLatencyMs: Int,
    val lowLatencyFeature: Boolean,
)

class AudioEngine(
    context: Context,
    private val onReady: (AudioDiagnostics) -> Unit,
    private val onFailure: (String) -> Unit,
) {
    private val appContext = context.applicationContext
    private val audioManager = appContext.getSystemService(AudioManager::class.java)
    private val lock = Any()

    @Volatile
    private var running = false

    @Volatile
    private var monitoringEnabled = false

    @Volatile
    private var monitoringGeneration = 0L

    @Volatile
    private var fxBypassed = false

    @Volatile
    private var echoEnabled = true

    @Volatile
    private var reverbEnabled = true

    @Volatile
    private var vocalChainEnabled = true

    @Volatile
    private var preset = VoicePreset.CLEAN_STUDIO

    @Volatile
    private var echoAmountPercent = 30

    @Volatile
    private var echoDelayMs = 120

    @Volatile
    private var activeRecord: AudioRecord? = null

    @Volatile
    private var activeTrack: AudioTrack? = null

    private var worker: Thread? = null

    @Volatile
    private var lowLatencyEnabled = true

    fun start(inputDeviceId: Int?, outputDeviceId: Int?) {
        synchronized(lock) {
            if (running || worker?.isAlive == true) return
            running = true
            worker = Thread(
                { runAudio(inputDeviceId, outputDeviceId) },
                "KeuraokeAudioEngine",
            ).apply {
                priority = Thread.NORM_PRIORITY
                start()
            }
        }
    }

    fun stop() {
        val thread: Thread?
        synchronized(lock) {
            running = false
            if (monitoringEnabled) monitoringGeneration++
            monitoringEnabled = false
            activeTrack?.let { track ->
                track.pause()
                track.flush()
            }
            runCatching { activeRecord?.stop() }
            thread = worker
        }
        if (thread != null && thread !== Thread.currentThread()) {
            runCatching { thread.join(1_000) }
        }
    }

    fun setMonitoringEnabled(enabled: Boolean) {
        synchronized(lock) {
            if (monitoringEnabled != enabled) monitoringGeneration++
            monitoringEnabled = enabled
            if (!enabled) {
                activeTrack?.let { track ->
                    track.pause()
                    track.flush()
                }
            }
        }
    }

    fun setFxBypassed(bypassed: Boolean) {
        fxBypassed = bypassed
    }

    fun setEchoEnabled(enabled: Boolean) {
        echoEnabled = enabled
    }

    fun setReverbEnabled(enabled: Boolean) {
        reverbEnabled = enabled
    }

    fun setVocalChainEnabled(enabled: Boolean) {
        vocalChainEnabled = enabled
    }

    fun setPreset(value: VoicePreset) {
        preset = value
    }

    fun setEchoAmountPercent(value: Int) {
        echoAmountPercent = value.coerceIn(0, 100)
    }

    fun setEchoDelayMs(value: Int) {
        echoDelayMs = value.coerceIn(0, 700)
    }

    fun setLowLatencyMode(enabled: Boolean) {
        lowLatencyEnabled = enabled
    }

    private fun runAudio(inputDeviceId: Int?, outputDeviceId: Int?) {
        var record: AudioRecord? = null
        var track: AudioTrack? = null
        try {
            Process.setThreadPriority(Process.THREAD_PRIORITY_AUDIO)
            val session = openSession(inputDeviceId, outputDeviceId)
            record = session.record
            track = session.track
            activeRecord = record
            activeTrack = track
            if (!running) return

            val diagnostics = diagnosticsFor(session)
            onReady(diagnostics)
            streamAudio(session)
        } catch (exception: Exception) {
            if (running) {
                onFailure(
                    exception.message
                        ?: "Audio could not be initialized. Check microphone access and connected devices.",
                )
            }
        } finally {
            running = false
            synchronized(lock) {
                activeRecord = null
                activeTrack = null
            }
            runCatching { record?.stop() }
            runCatching { track?.pause() }
            runCatching { track?.flush() }
            record?.release()
            track?.release()
        }
    }

    private fun openSession(inputDeviceId: Int?, outputDeviceId: Int?): AudioSession {
        check(
            appContext.checkSelfPermission(Manifest.permission.RECORD_AUDIO) ==
                PackageManager.PERMISSION_GRANTED,
        ) {
            "Microphone permission is required to start monitoring."
        }
        val preferredRate = audioManager
            .getProperty(AudioManager.PROPERTY_OUTPUT_SAMPLE_RATE)
            ?.toIntOrNull()
            ?: 48_000
        val inputRates = inputDeviceId
            ?.let { findDevice(it, AudioManager.GET_DEVICES_INPUTS)?.sampleRates }
            ?.filter { it > 0 }
            .orEmpty()
        val outputRates = outputDeviceId
            ?.let { findDevice(it, AudioManager.GET_DEVICES_OUTPUTS)?.sampleRates }
            ?.filter { it > 0 }
            .orEmpty()
        val commonRates = if (inputRates.isNotEmpty() && outputRates.isNotEmpty()) {
            inputRates.filter { it in outputRates }
        } else {
            emptyList()
        }
        val advertisedRates = (commonRates.ifEmpty { outputRates + inputRates })
            .distinct()
            .sortedBy { kotlin.math.abs(it - preferredRate) }
        val sampleRates = (advertisedRates + listOf(preferredRate, 48_000, 44_100)).distinct()
        val supportsUnprocessed = audioManager
            .getProperty(AudioManager.PROPERTY_SUPPORT_AUDIO_SOURCE_UNPROCESSED)
            .equals("true", ignoreCase = true)
        val audioSources = buildList {
            if (supportsUnprocessed) add(MediaRecorder.AudioSource.UNPROCESSED)
            add(MediaRecorder.AudioSource.VOICE_RECOGNITION)
            add(MediaRecorder.AudioSource.MIC)
        }.distinct()
        var lastError: Exception? = null

        val modes = if (lowLatencyEnabled) listOf(true, false) else listOf(false)
        for (lowLatency in modes) {
            for (sampleRate in sampleRates) {
                for (audioSource in audioSources) {
                    try {
                        return createSession(
                            inputDeviceId,
                            outputDeviceId,
                            sampleRate,
                            audioSource,
                            lowLatency,
                        )
                    } catch (exception: Exception) {
                        lastError = exception
                    }
                }
            }
        }

        throw IllegalStateException(
            lastError?.message ?: "No supported microphone/output configuration was found.",
            lastError,
        )
    }

    @SuppressLint("MissingPermission")
    private fun createSession(
        inputDeviceId: Int?,
        outputDeviceId: Int?,
        sampleRate: Int,
        audioSource: Int,
        lowLatency: Boolean,
    ): AudioSession {
        if (
            appContext.checkSelfPermission(Manifest.permission.RECORD_AUDIO) !=
            PackageManager.PERMISSION_GRANTED
        ) {
            throw SecurityException("Microphone permission is required to start monitoring.")
        }
        val inputMinBytes = AudioRecord.getMinBufferSize(
            sampleRate,
            AudioFormat.CHANNEL_IN_MONO,
            AudioFormat.ENCODING_PCM_16BIT,
        )
        val outputMinBytes = AudioTrack.getMinBufferSize(
            sampleRate,
            AudioFormat.CHANNEL_OUT_STEREO,
            AudioFormat.ENCODING_PCM_16BIT,
        )
        check(inputMinBytes > 0 && outputMinBytes > 0) {
            "Android rejected the $sampleRate Hz audio configuration."
        }

        val framesPerBurst = audioManager
            .getProperty(AudioManager.PROPERTY_OUTPUT_FRAMES_PER_BUFFER)
            ?.toIntOrNull()
            ?.takeIf { it > 0 }
            ?: 256
        val burstCount = if (lowLatency) 2 else 4
        val inputBufferBytes = max(inputMinBytes, framesPerBurst * burstCount * 2)
        val outputBufferBytes = max(outputMinBytes, framesPerBurst * burstCount * 4)
        val inputFormat = AudioFormat.Builder()
            .setSampleRate(sampleRate)
            .setEncoding(AudioFormat.ENCODING_PCM_16BIT)
            .setChannelMask(AudioFormat.CHANNEL_IN_MONO)
            .build()
        val outputFormat = AudioFormat.Builder()
            .setSampleRate(sampleRate)
            .setEncoding(AudioFormat.ENCODING_PCM_16BIT)
            .setChannelMask(AudioFormat.CHANNEL_OUT_STEREO)
            .build()

        var record: AudioRecord? = null
        var track: AudioTrack? = null
        try {
            val createdRecord = AudioRecord.Builder()
                .setAudioSource(audioSource)
                .setAudioFormat(inputFormat)
                .setBufferSizeInBytes(inputBufferBytes)
                .build()
            record = createdRecord
            check(createdRecord.state == AudioRecord.STATE_INITIALIZED) {
                "Android could not initialize microphone capture."
            }
            val createdTrack = AudioTrack.Builder()
                .setAudioAttributes(
                    android.media.AudioAttributes.Builder()
                        .setUsage(android.media.AudioAttributes.USAGE_MEDIA)
                        .setContentType(android.media.AudioAttributes.CONTENT_TYPE_SPEECH)
                        .build(),
                )
                .setAudioFormat(outputFormat)
                .setBufferSizeInBytes(outputBufferBytes)
                .setTransferMode(AudioTrack.MODE_STREAM)
                .setPerformanceMode(
                    if (lowLatency) AudioTrack.PERFORMANCE_MODE_LOW_LATENCY
                    else AudioTrack.PERFORMANCE_MODE_NONE,
                )
                .build()
            track = createdTrack
            check(createdTrack.state == AudioTrack.STATE_INITIALIZED) {
                "Android could not initialize audio output."
            }

            val inputDevice = inputDeviceId?.let { findDevice(it, AudioManager.GET_DEVICES_INPUTS) }
            val outputDevice = outputDeviceId?.let { findDevice(it, AudioManager.GET_DEVICES_OUTPUTS) }
            val inputSelected = inputDeviceId == null ||
                (inputDevice != null && createdRecord.setPreferredDevice(inputDevice))
            val outputSelected = outputDeviceId == null ||
                (outputDevice != null && createdTrack.setPreferredDevice(outputDevice))
            createdRecord.startRecording()
            check(createdRecord.recordingState == AudioRecord.RECORDSTATE_RECORDING) {
                "Android did not start microphone capture."
            }

            return AudioSession(
                record = createdRecord,
                track = createdTrack,
                sampleRate = sampleRate,
                framesPerBurst = framesPerBurst,
                lowLatencyRequested = lowLatency,
                audioSource = audioSource,
                inputDeviceId = inputDeviceId,
                outputDeviceId = outputDeviceId,
                inputDeviceSelected = inputSelected,
                outputDeviceSelected = outputSelected,
                fallbackDescription = if (lowLatency) null else "Standard Android audio mode",
            )
        } catch (exception: Exception) {
            record?.release()
            track?.release()
            throw exception
        }
    }

    private fun findDevice(id: Int, direction: Int): AudioDeviceInfo? =
        audioManager.getDevices(direction).firstOrNull { it.id == id }

    private fun selectedDeviceDescription(id: Int?, direction: Int): String? =
        id?.let { findDevice(it, direction)?.let(::deviceDescription) }

    private fun diagnosticsFor(session: AudioSession): AudioDiagnostics {
        val inputFrames = session.record.bufferSizeInFrames
        val outputFrames = session.track.bufferSizeInFrames
        val estimateMs = (
            (inputFrames.toDouble() + outputFrames.toDouble()) * 1_000.0 /
                session.sampleRate
            ).toInt()
        val inputName = session.record.routedDevice?.let { "Active: ${deviceDescription(it)}" }
            ?: selectedDeviceDescription(session.inputDeviceId, AudioManager.GET_DEVICES_INPUTS)
                ?.let { "Requested: $it (active route not confirmed)" }
            ?: "Android-selected input (active route not reported)"
        val outputName = session.track.routedDevice?.let { "Active: ${deviceDescription(it)}" }
            ?: selectedDeviceDescription(session.outputDeviceId, AudioManager.GET_DEVICES_OUTPUTS)
                ?.let { "Requested: $it (active route not confirmed)" }
            ?: if (monitoringEnabled) {
                "Android-selected output (active route not reported)"
            } else {
                "Android-selected output (monitor off)"
            }
        val routeWarning = when {
            !session.inputDeviceSelected -> "Requested input unavailable; using Android routing"
            !session.outputDeviceSelected -> "Requested output unavailable; using Android routing"
            else -> session.fallbackDescription
        }

        return AudioDiagnostics(
            inputName = inputName,
            outputName = outputName,
            sampleRate = session.sampleRate,
            framesPerBurst = session.framesPerBurst,
            inputBufferFrames = inputFrames,
            outputBufferFrames = outputFrames,
            inputChannels = 1,
            outputChannels = 2,
            inputSource = if (session.audioSource == MediaRecorder.AudioSource.UNPROCESSED) {
                "UNPROCESSED"
            } else if (session.audioSource == MediaRecorder.AudioSource.VOICE_RECOGNITION) {
                "VOICE_RECOGNITION"
            } else {
                "MIC fallback"
            },
            lowLatencyRequested = session.lowLatencyRequested,
            fallbackDescription = routeWarning,
            estimatedLatencyMs = estimateMs,
            lowLatencyFeature = appContext.packageManager.hasSystemFeature(
                android.content.pm.PackageManager.FEATURE_AUDIO_LOW_LATENCY,
            ),
        )
    }

    private fun deviceDescription(device: AudioDeviceInfo): String =
        "${device.productName} (${deviceTypeName(device.type)})"

    private fun streamAudio(session: AudioSession) {
        val record = session.record
        val track = session.track
        val blockFrames = min(session.framesPerBurst, 512).coerceAtLeast(64)
        val input = ShortArray(blockFrames)
        val output = ShortArray(blockFrames * 2)
        val sampleRate = session.sampleRate
        val echoBuffer = ShortArray(max(sampleRate * 700 / 1_000 + 1, 64))
        val reverbShort = ShortArray(max(sampleRate * 50 / 1_000, 64))
        val reverbLong = ShortArray(max(sampleRate * 100 / 1_000, 64))
        val processor = VoiceProcessor(sampleRate, echoBuffer, reverbShort, reverbLong)
        var observedMonitoringGeneration = -1L
        var reportedActiveOutputRoute = !monitoringEnabled

        while (running) {
            val framesRead = record.read(input, 0, input.size, AudioRecord.READ_BLOCKING)
            if (framesRead == AudioRecord.ERROR_DEAD_OBJECT) {
                error("The input device disconnected. Reconnect it and try again.")
            }
            if (framesRead < 0) {
                error("Microphone capture failed (audio error $framesRead).")
            }
            if (framesRead == 0) continue

            val shouldMonitor = monitoringEnabled
            val currentMonitoringGeneration = monitoringGeneration
            if (currentMonitoringGeneration != observedMonitoringGeneration) {
                if (shouldMonitor) {
                    track.play()
                } else {
                    track.pause()
                    track.flush()
                }
                observedMonitoringGeneration = currentMonitoringGeneration
            }
            if (!shouldMonitor) continue

            processor.process(input, output, framesRead)
            var offset = 0
            val samplesToWrite = framesRead * 2
            while (running && offset < samplesToWrite) {
                val written = track.write(
                    output,
                    offset,
                    samplesToWrite - offset,
                    AudioTrack.WRITE_BLOCKING,
                )
                if (written == AudioTrack.ERROR_DEAD_OBJECT) {
                    error("The output device disconnected. Reconnect it and try again.")
                }
                if (written < 0) error("Audio output failed (audio error $written).")
                if (written == 0) break
                offset += written
                if (!reportedActiveOutputRoute) {
                    onReady(diagnosticsFor(session))
                    reportedActiveOutputRoute = true
                }
            }
        }
    }

    private inner class VoiceProcessor(
        private val sampleRate: Int,
        private val echoBuffer: ShortArray,
        private val reverbShort: ShortArray,
        private val reverbLong: ShortArray,
    ) {
        private var echoCursor = 0
        private var shortCursor = 0
        private var longCursor = 0
        private var envelope = 0f
        private var lowFrequency = 0f
        private var previousPreset: VoicePreset? = null
        private var previousEchoEnabled: Boolean? = null
        private var previousEchoAmountPercent: Int? = null
        private var previousEchoDelayMs: Int? = null
        private var previousReverbEnabled: Boolean? = null
        private var previousBypass: Boolean? = null
        private var previousVocalChainEnabled: Boolean? = null

        fun process(input: ShortArray, output: ShortArray, frames: Int) {
            val bypass = fxBypassed
            val selectedPreset = preset
            val useEcho = echoEnabled
            val amountPercent = echoAmountPercent
            val delayMs = echoDelayMs
            val useReverb = reverbEnabled
            val useVocalChain = vocalChainEnabled

            if (
                selectedPreset != previousPreset ||
                useEcho != previousEchoEnabled ||
                useReverb != previousReverbEnabled ||
                bypass != previousBypass ||
                useVocalChain != previousVocalChainEnabled
            ) {
                echoBuffer.fill(0)
                reverbShort.fill(0)
                reverbLong.fill(0)
                echoCursor = 0
                shortCursor = 0
                longCursor = 0
                envelope = 0f
                lowFrequency = 0f
                previousPreset = selectedPreset
                previousEchoEnabled = useEcho
                previousReverbEnabled = useReverb
                previousBypass = bypass
                previousVocalChainEnabled = useVocalChain
            }

            if (
                amountPercent != previousEchoAmountPercent ||
                delayMs != previousEchoDelayMs
            ) {
                echoBuffer.fill(0)
                echoCursor = 0
                previousEchoAmountPercent = amountPercent
                previousEchoDelayMs = delayMs
            }

            if (bypass || (!useEcho && !useReverb && !useVocalChain)) {
                for (frame in 0 until frames) {
                    val sample = input[frame]
                    output[frame * 2] = sample
                    output[frame * 2 + 1] = sample
                }
                return
            }

            for (frame in 0 until frames) {
                val dry = input[frame].toFloat()
                val profile = selectedPreset.profile
                var wet = dry
                if (useEcho && amountPercent > 0 && delayMs > 0) {
                    val delayFrames = (delayMs * sampleRate / 1_000)
                        .coerceIn(1, echoBuffer.size - 1)
                    val echoIndex = (echoCursor - delayFrames + echoBuffer.size) % echoBuffer.size
                    val echo = echoBuffer[echoIndex].toFloat()
                    echoBuffer[echoCursor] = (dry + echo * profile.echoFeedback)
                        .toInt()
                        .coerceIn(Short.MIN_VALUE.toInt(), Short.MAX_VALUE.toInt())
                        .toShort()
                    wet += echo * profile.echoMix * amountPercent / 30f
                    echoCursor = (echoCursor + 1) % echoBuffer.size
                }

                if (useReverb) {
                    val earlyFrames = (profile.earlyReflectionMs * sampleRate / 1_000)
                        .coerceIn(1, reverbShort.size - 1)
                    val lateFrames = (profile.lateReflectionMs * sampleRate / 1_000)
                        .coerceIn(1, reverbLong.size - 1)
                    val earlyIndex =
                        (shortCursor - earlyFrames + reverbShort.size) % reverbShort.size
                    val lateIndex =
                        (longCursor - lateFrames + reverbLong.size) % reverbLong.size
                    val shortEcho = reverbShort[earlyIndex].toFloat()
                    val longEcho = reverbLong[lateIndex].toFloat()
                    reverbShort[shortCursor] = (dry + shortEcho * profile.earlyFeedback)
                        .toInt()
                        .coerceIn(Short.MIN_VALUE.toInt(), Short.MAX_VALUE.toInt())
                        .toShort()
                    reverbLong[longCursor] = (dry + longEcho * profile.lateFeedback)
                        .toInt()
                        .coerceIn(Short.MIN_VALUE.toInt(), Short.MAX_VALUE.toInt())
                        .toShort()
                    wet += (shortEcho + longEcho) * profile.reverbMix
                    shortCursor = (shortCursor + 1) % reverbShort.size
                    longCursor = (longCursor + 1) % reverbLong.size
                }

                if (useVocalChain) {
                    val inputFloat = wet
                    lowFrequency += (inputFloat - lowFrequency) * 0.09f
                    wet -= lowFrequency * profile.lowMidCut
                    wet += (inputFloat - lowFrequency) * profile.presence

                    val magnitude = abs(wet)
                    envelope += (magnitude - envelope) * if (magnitude > envelope) 0.08f else 0.003f
                    val threshold = profile.compressorThreshold
                    if (envelope > threshold) {
                        val reduction =
                            threshold + (envelope - threshold) / profile.compressorRatio
                        wet *= reduction / envelope
                    }
                    wet *= profile.saturation
                }

                if (useEcho || useReverb || useVocalChain) {
                    wet = saturate(wet)
                }

                val sample = wet
                    .toInt()
                    .coerceIn(Short.MIN_VALUE.toInt(), Short.MAX_VALUE.toInt())
                    .toShort()
                output[frame * 2] = sample
                output[frame * 2 + 1] = sample
            }
        }

        private fun saturate(value: Float): Float {
            val magnitude = abs(value)
            if (magnitude <= 12_000f) return value
            val compressed = 12_000f + (magnitude - 12_000f) * 0.35f
            return if (value < 0f) -compressed else compressed
        }

    }

    private data class AudioSession(
        val record: AudioRecord,
        val track: AudioTrack,
        val sampleRate: Int,
        val framesPerBurst: Int,
        val lowLatencyRequested: Boolean,
        val audioSource: Int,
        val inputDeviceId: Int?,
        val outputDeviceId: Int?,
        val inputDeviceSelected: Boolean,
        val outputDeviceSelected: Boolean,
        val fallbackDescription: String?,
    )
}

fun deviceTypeName(type: Int): String = when (type) {
    AudioDeviceInfo.TYPE_BUILTIN_MIC -> "Built-in microphone"
    AudioDeviceInfo.TYPE_USB_DEVICE -> "USB audio"
    AudioDeviceInfo.TYPE_USB_HEADSET -> "USB headset"
    AudioDeviceInfo.TYPE_WIRED_HEADSET -> "Wired headset"
    AudioDeviceInfo.TYPE_WIRED_HEADPHONES -> "Wired headphones"
    AudioDeviceInfo.TYPE_BLUETOOTH_SCO -> "Bluetooth headset"
    AudioDeviceInfo.TYPE_BLUETOOTH_A2DP -> "Bluetooth audio"
    AudioDeviceInfo.TYPE_BLE_HEADSET -> "Bluetooth LE headset"
    AudioDeviceInfo.TYPE_BLE_SPEAKER -> "Bluetooth LE audio"
    AudioDeviceInfo.TYPE_BUILTIN_SPEAKER -> "Built-in speaker"
    AudioDeviceInfo.TYPE_BUILTIN_EARPIECE -> "Earpiece"
    else -> "Android audio device"
}
