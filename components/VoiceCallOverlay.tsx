'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Persona, ReplyLanguage } from '@/types'
import { AnimatePresence, motion } from 'framer-motion'
import { Mic, MicOff, PhoneOff, Volume2, VolumeX } from 'lucide-react'
import { supabase } from '@/lib/supabase-browser'
import { apiUrl } from '@/lib/api-url'
import { useI18n } from '@/lib/i18n/context'

interface Props {
  persona: Persona
  isOpen: boolean
  onClose: () => void
  replyLanguage: ReplyLanguage
  onVoiceTurn: (text: string, lang: ReplyLanguage, sessionType?: 'text' | 'voice') => Promise<string | null>
}

function blobToFile(blob: Blob, filename: string): File {
  return new File([blob], filename, { type: blob.type || 'application/octet-stream' })
}

function getAudioLevel(analyser: AnalyserNode): number {
  const data = new Uint8Array(analyser.fftSize)
  analyser.getByteTimeDomainData(data)
  let sum = 0
  for (let i = 0; i < data.length; i += 1) {
    const sample = (data[i] - 128) / 128
    sum += sample * sample
  }
  return Math.sqrt(sum / data.length)
}

const VAD_SAMPLE_MS = 100
const VAD_MIN_VOICED_MS = 450
const VAD_MIN_VOICED_MS_FIRST = 220
const VAD_MAX_SILENT_WAIT_MS = 10000
const VAD_STOP_SILENCE_MS = 900
const VAD_MIN_PEAK_ABS = 0.045
const VAD_MIN_PEAK_ABS_FIRST = 0.03
const VAD_THRESHOLD_FLOOR = 0.02
const VAD_THRESHOLD_FLOOR_FIRST = 0.016
const VAD_THRESHOLD_CEIL = 0.05

async function speakWithBrowserTts(text: string, lang: ReplyLanguage): Promise<boolean> {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return false
  const synth = window.speechSynthesis
  if (!synth) return false

  const voiceLangPrefix = lang === 'zh' ? 'zh' : 'en'
  const pickVoice = (): SpeechSynthesisVoice | null => {
    const voices = synth.getVoices()
    if (!voices.length) return null
    const lower = voices.map(v => ({ raw: v, lang: v.lang.toLowerCase() }))
    if (lang === 'zh') {
      return (
        lower.find(v => v.lang === 'zh-cn')?.raw ||
        lower.find(v => v.lang.startsWith('zh-'))?.raw ||
        lower.find(v => v.lang.startsWith('zh'))?.raw ||
        voices[0] ||
        null
      )
    }
    return lower.find(v => v.lang.startsWith(voiceLangPrefix))?.raw || voices[0] || null
  }

  // Chrome may lazily populate voices; wait a bit for first list.
  let voice = pickVoice()
  if (!voice) {
    await new Promise<void>(resolve => {
      const done = () => {
        synth.removeEventListener('voiceschanged', done)
        resolve()
      }
      synth.addEventListener('voiceschanged', done, { once: true })
      window.setTimeout(done, 1200)
    })
    voice = pickVoice()
  }

  const utter = new SpeechSynthesisUtterance(text.slice(0, 1200))
  utter.lang = lang === 'zh' ? 'zh-CN' : 'en-US'
  utter.volume = 1
  utter.rate = 1
  utter.pitch = 1
  if (voice) utter.voice = voice

  return await new Promise<boolean>(resolve => {
    let settled = false
    const settle = (ok: boolean) => {
      if (settled) return
      settled = true
      resolve(ok)
    }
    utter.onend = () => settle(true)
    utter.onerror = () => settle(false)
    utter.onpause = () => synth.resume()

    // Avoid cancel->speak race in Chromium.
    synth.cancel()
    window.setTimeout(() => {
      try {
        synth.resume()
        synth.speak(utter)
      } catch {
        settle(false)
      }
    }, 40)

    // Hard timeout: if still not speaking, count as failed.
    window.setTimeout(() => settle(Boolean(synth.speaking || synth.pending)), 1200)
    // Max utterance timeout protection.
    window.setTimeout(() => settle(true), 20000)
  })
}

export default function VoiceCallOverlay({ persona, isOpen, onClose, replyLanguage, onVoiceTurn }: Props) {
  const { t } = useI18n()
  const [isMuted, setIsMuted] = useState(false)
  const [isSpeakerOff, setIsSpeakerOff] = useState(false)
  const [callDuration, setCallDuration] = useState(0)
  const [aiSpeaking, setAiSpeaking] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [callError, setCallError] = useState('')
  const [lastHeardText, setLastHeardText] = useState('')

  const streamRef = useRef<MediaStream | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const meterTimerRef = useRef<number | null>(null)
  const nextTurnTimerRef = useRef<number | null>(null)
  const callActiveRef = useRef(false)
  const processingRef = useRef(false)
  const outputAudioRef = useRef<HTMLAudioElement | null>(null)
  const outputAudioUrlRef = useRef<string>('')
  const isMutedRef = useRef(false)
  const isSpeakerOffRef = useRef(false)
  const aiSpeakingRef = useRef(false)
  const speakSeqRef = useRef(0)
  const turnCountRef = useRef(0)
  const replyLanguageRef = useRef<ReplyLanguage>(replyLanguage)

  useEffect(() => {
    isMutedRef.current = isMuted
  }, [isMuted])

  useEffect(() => {
    isSpeakerOffRef.current = isSpeakerOff
    if (isSpeakerOff && outputAudioRef.current) {
      outputAudioRef.current.pause()
      outputAudioRef.current.currentTime = 0
      setAiSpeaking(false)
    }
  }, [isSpeakerOff])

  useEffect(() => {
    replyLanguageRef.current = replyLanguage
  }, [replyLanguage])

  useEffect(() => {
    aiSpeakingRef.current = aiSpeaking
  }, [aiSpeaking])

  const clearTimers = useCallback(() => {
    if (meterTimerRef.current) {
      window.clearInterval(meterTimerRef.current)
      meterTimerRef.current = null
    }
    if (nextTurnTimerRef.current) {
      window.clearTimeout(nextTurnTimerRef.current)
      nextTurnTimerRef.current = null
    }
  }, [])

  const stopOutputAudio = useCallback(() => {
    speakSeqRef.current += 1
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel()
    }
    const audio = outputAudioRef.current
    if (audio) {
      audio.pause()
      audio.currentTime = 0
      outputAudioRef.current = null
    }
    if (outputAudioUrlRef.current) {
      URL.revokeObjectURL(outputAudioUrlRef.current)
      outputAudioUrlRef.current = ''
    }
    setAiSpeaking(false)
  }, [])

  const releaseRecorderOnly = useCallback(() => {
    if (recorderRef.current) {
      try {
        if (recorderRef.current.state !== 'inactive') recorderRef.current.stop()
      } catch {
        // noop
      }
      recorderRef.current = null
    }
  }, [])

  const fullCleanup = useCallback(() => {
    clearTimers()
    releaseRecorderOnly()

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }

    if (audioCtxRef.current) {
      void audioCtxRef.current.close().catch(() => undefined)
      audioCtxRef.current = null
      analyserRef.current = null
    }

    stopOutputAudio()
    processingRef.current = false
    setIsProcessing(false)
  }, [clearTimers, releaseRecorderOnly, stopOutputAudio])

  const ensureAudioPipeline = useCallback(async (): Promise<MediaStream> => {
    if (streamRef.current && streamRef.current.getAudioTracks().some(t => t.readyState === 'live')) {
      return streamRef.current
    }

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    })

    streamRef.current = stream

    if (!audioCtxRef.current) {
      const Ctx = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!Ctx) throw new Error('AudioContext unavailable')
      const audioCtx = new Ctx()
      const source = audioCtx.createMediaStreamSource(stream)
      const analyser = audioCtx.createAnalyser()
      analyser.fftSize = 2048
      analyser.smoothingTimeConstant = 0.25
      source.connect(analyser)
      audioCtxRef.current = audioCtx
      analyserRef.current = analyser
    }

    return stream
  }, [])

  const speakText = useCallback(async (text: string, _token: string, lang: ReplyLanguage) => {
    if (isSpeakerOffRef.current) return
    const seq = ++speakSeqRef.current
    const ok = await speakWithBrowserTts(text, lang)
    if (seq !== speakSeqRef.current) return
    if (!ok) throw new Error('Browser TTS unavailable')
  }, [])

  const processUserTurn = useCallback(async (blob: Blob, durationSeconds: number) => {
    if (processingRef.current || !callActiveRef.current) return

    processingRef.current = true
    setIsProcessing(true)
    setCallError('')

    try {
      const sess = await supabase.auth.getSession()
      const token = sess.data.session?.access_token
      if (!token) throw new Error(t('voice.loginRequired'))

      const ext = blob.type.includes('mp4') ? 'mp4' : 'webm'
      const audioFile = blobToFile(blob, `voice-turn.${ext}`)
      const form = new FormData()
      form.append('audio', audioFile)

      const sttRes = await fetch(apiUrl('/api/voice'), {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'x-audio-duration-ms': String(Math.max(1000, Math.round(durationSeconds * 1000))),
        },
        body: form,
      })
      if (!sttRes.ok) {
        // 422 means "no valid speech recognized"; treat as a silent turn.
        if (sttRes.status === 422) return
        throw new Error(t('voice.speechRecognitionFailed'))
      }

      const { text } = (await sttRes.json()) as { text?: string }
      const transcribed = text?.trim() || ''
      if (!transcribed) return

      setLastHeardText(transcribed)
      const aiText = await onVoiceTurn(transcribed, replyLanguageRef.current, 'voice')
      if (!aiText?.trim()) return
      if (isSpeakerOffRef.current || !callActiveRef.current) return

      setAiSpeaking(true)
      await speakText(aiText, token, replyLanguageRef.current)
    } catch (e) {
      const msg = e instanceof Error ? e.message : t('voice.voiceFailed')
      setCallError(msg)
    } finally {
      setAiSpeaking(false)
      setIsProcessing(false)
      processingRef.current = false
    }
  }, [onVoiceTurn, speakText, t])

  const scheduleNextTurn = useCallback((delayMs = 180) => {
    if (!callActiveRef.current) return
    if (nextTurnTimerRef.current) window.clearTimeout(nextTurnTimerRef.current)
    nextTurnTimerRef.current = window.setTimeout(() => {
      void (async () => {
        if (!callActiveRef.current || isMutedRef.current || processingRef.current || aiSpeakingRef.current) {
          scheduleNextTurn(200)
          return
        }

        let stream: MediaStream
        try {
          stream = await ensureAudioPipeline()
        } catch {
          setCallError(t('voice.cannotAccessMic'))
          scheduleNextTurn(600)
          return
        }

        if (!callActiveRef.current || isMutedRef.current) {
          scheduleNextTurn(200)
          return
        }

        const preferred = 'audio/webm;codecs=opus'
        const mimeType = MediaRecorder.isTypeSupported(preferred) ? preferred : 'audio/webm'
        const recorder = new MediaRecorder(stream, { mimeType })
        recorderRef.current = recorder

        const chunks: Blob[] = []
        const startedAt = Date.now()
        let hasVoice = false
        let lastVoiceAt = 0
        let voicedMs = 0
        let peakLevel = 0
        let noiseFloor = 0.008
        const isFirstTurn = turnCountRef.current === 0
        let adaptiveThreshold = isFirstTurn ? VAD_THRESHOLD_FLOOR_FIRST : VAD_THRESHOLD_FLOOR

        recorder.ondataavailable = event => {
          if (event.data.size > 0) chunks.push(event.data)
        }

        recorder.onstop = async () => {
          recorderRef.current = null
          if (meterTimerRef.current) {
            window.clearInterval(meterTimerRef.current)
            meterTimerRef.current = null
          }

          if (!callActiveRef.current) return

          const elapsedMs = Date.now() - startedAt
          const elapsedSec = Math.max(1, Math.ceil(elapsedMs / 1000))
          // Filter out noise taps and ultra-short clips before hitting STT.
          const minVoicedMs = isFirstTurn ? VAD_MIN_VOICED_MS_FIRST : VAD_MIN_VOICED_MS
          if (!hasVoice || chunks.length === 0 || elapsedMs < 650 || voicedMs < minVoicedMs) {
            scheduleNextTurn(120)
            return
          }

          const blob = new Blob(chunks, { type: mimeType })
          await processUserTurn(blob, elapsedSec)
          turnCountRef.current += 1
          scheduleNextTurn(120)
        }

        recorder.onerror = () => {
          setCallError(t('voice.recorderError'))
          scheduleNextTurn(400)
        }

        recorder.start(250)

        meterTimerRef.current = window.setInterval(() => {
          if (!callActiveRef.current || recorder.state !== 'recording') return
          const now = Date.now()
          const analyser = analyserRef.current
          const level = analyser ? getAudioLevel(analyser) : 0
          peakLevel = Math.max(peakLevel, level)

          // Update noise floor when current frame is quiet.
          if (level < adaptiveThreshold) {
            noiseFloor = noiseFloor * 0.92 + level * 0.08
            const floor = isFirstTurn ? VAD_THRESHOLD_FLOOR_FIRST : VAD_THRESHOLD_FLOOR
            adaptiveThreshold = Math.min(VAD_THRESHOLD_CEIL, Math.max(floor, noiseFloor * 2.2))
          }

          const speaking = level > adaptiveThreshold

          if (speaking) {
            voicedMs += VAD_SAMPLE_MS
            // Effective speech: enough voiced duration + peak level over hard floor.
            const minVoicedMs = isFirstTurn ? VAD_MIN_VOICED_MS_FIRST : VAD_MIN_VOICED_MS
            const minPeak = isFirstTurn ? VAD_MIN_PEAK_ABS_FIRST : VAD_MIN_PEAK_ABS
            if (voicedMs >= minVoicedMs && peakLevel >= minPeak) {
              hasVoice = true
            }
            lastVoiceAt = now
          }

          const elapsed = now - startedAt
          if (hasVoice && now - lastVoiceAt > VAD_STOP_SILENCE_MS && elapsed > 900) {
            if (recorder.state === 'recording') recorder.stop()
          }
          if (!hasVoice && elapsed > VAD_MAX_SILENT_WAIT_MS) {
            if (recorder.state === 'recording') recorder.stop()
          }
        }, VAD_SAMPLE_MS)
      })()
    }, delayMs)
  }, [ensureAudioPipeline, processUserTurn, t])

  useEffect(() => {
    if (!isOpen) {
      callActiveRef.current = false
      turnCountRef.current = 0
      fullCleanup()
      setCallDuration(0)
      setIsProcessing(false)
      setAiSpeaking(false)
      setCallError('')
      setLastHeardText('')
      return
    }

    callActiveRef.current = true
    turnCountRef.current = 0
    setCallDuration(0)
    setCallError('')
    setLastHeardText('')

    const timer = window.setInterval(() => setCallDuration(d => d + 1), 1000)
    scheduleNextTurn(0)

    return () => {
      window.clearInterval(timer)
      callActiveRef.current = false
      fullCleanup()
    }
  }, [fullCleanup, isOpen, scheduleNextTurn])

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60)
    const sec = s % 60
    return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`
  }

  const statusText = callError
    ? callError
    : aiSpeaking
      ? t('voice.speaking')
      : isMuted
        ? t('voice.muted')
        : isProcessing
          ? t('voice.processing')
          : t('voice.listening')

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center"
        >
          <div className="absolute inset-0 bg-background/90 backdrop-blur-2xl" />

          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ type: 'spring', damping: 20 }}
            className="relative z-10 flex flex-col items-center gap-8 px-8"
          >
            <div className="relative">
              {aiSpeaking && (
                <>
                  <motion.div
                    animate={{ scale: [1, 1.6], opacity: [0.3, 0] }}
                    transition={{ duration: 1.5, repeat: Infinity, ease: 'easeOut' }}
                    className="absolute inset-0 rounded-full border-2 border-primary"
                  />
                  <motion.div
                    animate={{ scale: [1, 1.4], opacity: [0.2, 0] }}
                    transition={{ duration: 1.5, repeat: Infinity, ease: 'easeOut', delay: 0.3 }}
                    className="absolute inset-0 rounded-full border-2 border-primary"
                  />
                </>
              )}

              <div
                className={`w-28 h-28 rounded-full flex items-center justify-center text-5xl border-2 transition-all duration-500 ${
                  aiSpeaking
                    ? 'bg-primary/20 border-primary shadow-[0_0_40px_hsl(var(--glow-primary)/0.4)]'
                    : 'bg-primary/10 border-primary/20'
                }`}
              >
                {persona.avatar || '*'}
              </div>
            </div>

            <div className="text-center max-w-[340px]">
              <h2 className="font-serif text-2xl text-foreground mb-1">{persona.name}</h2>
              <p className={`text-sm ${callError ? 'text-destructive' : 'text-muted-foreground'}`}>{statusText}</p>
              <p className="text-primary text-sm mt-2 font-mono">{formatTime(callDuration)}</p>
              {lastHeardText && !callError && (
                <p className="mt-2 text-xs text-muted-foreground line-clamp-2">{t('voice.youSaid')} {lastHeardText}</p>
              )}
            </div>

            <div className="flex items-center gap-5">
              <button
                onClick={() => setIsMuted(v => !v)}
                className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${
                  isMuted
                    ? 'bg-destructive/20 text-destructive border border-destructive/30'
                    : 'bg-secondary text-foreground border border-border hover:bg-secondary/80'
                }`}
                title={isMuted ? t('voice.unmute') : t('voice.mute')}
              >
                {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
              </button>

              <button
                onClick={onClose}
                className="w-16 h-16 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center hover:brightness-110 transition-all shadow-[0_0_20px_hsl(0_70%_50%/0.3)]"
                title={t('voice.endCall')}
              >
                <PhoneOff className="w-6 h-6" />
              </button>

              <button
                onClick={() => setIsSpeakerOff(v => !v)}
                className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${
                  isSpeakerOff
                    ? 'bg-destructive/20 text-destructive border border-destructive/30'
                    : 'bg-secondary text-foreground border border-border hover:bg-secondary/80'
                }`}
                title={isSpeakerOff ? t('voice.speakerOn') : t('voice.speakerOff')}
              >
                {isSpeakerOff ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
