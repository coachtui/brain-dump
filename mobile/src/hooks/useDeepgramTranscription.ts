import { useState, useCallback, useRef, useEffect } from 'react';
import { ExpoPlayAudioStream } from '@mykin-ai/expo-audio-stream';
import { Audio } from 'expo-av';
import { apiService } from '../services/api';
import type { GeoPoint } from '../types';

interface TranscriptionState {
  status: 'idle' | 'connecting' | 'recording' | 'processing' | 'done' | 'error';
  partialTranscript: string;
  finalTranscript: string;
  duration: number;
  error: string | null;
  savedObjectIds: string[];
}

interface UseDeepgramTranscriptionReturn extends TranscriptionState {
  startRecording: (location?: GeoPoint) => Promise<void>;
  stopRecording: () => Promise<void>;
  reset: () => void;
}

// Convert base64 to ArrayBuffer
function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

export function useDeepgramTranscription(): UseDeepgramTranscriptionReturn {
  const [state, setState] = useState<TranscriptionState>({
    status: 'idle',
    partialTranscript: '',
    finalTranscript: '',
    duration: 0,
    error: null,
    savedObjectIds: [],
  });

  const wsRef = useRef<WebSocket | null>(null);
  const audioSubscriptionRef = useRef<any>(null);
  const startTimeRef = useRef<number>(0);
  const locationRef = useRef<GeoPoint | undefined>(undefined);
  const finalTranscriptRef = useRef<string>('');
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (audioSubscriptionRef.current) {
        audioSubscriptionRef.current.remove();
      }
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
      }
    };
  }, []);

  const startRecording = useCallback(async (location?: GeoPoint) => {
    try {
      setState(prev => ({ ...prev, status: 'connecting', error: null }));
      locationRef.current = location;
      finalTranscriptRef.current = '';

      // Request audio permissions
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') {
        throw new Error('Microphone permission not granted');
      }

      // Set audio mode for recording
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      // Get temporary Deepgram token from our backend
      console.log('🔑 Getting Deepgram token...');
      const { token } = await apiService.getDeepgramToken();

      // Connect to Deepgram WebSocket
      const deepgramUrl = `wss://api.deepgram.com/v1/listen?encoding=linear16&sample_rate=16000&channels=1&punctuate=true&interim_results=true`;

      console.log('🔌 Connecting to Deepgram...');
      const ws = new WebSocket(deepgramUrl, ['token', token]);
      wsRef.current = ws;

      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Deepgram connection timeout'));
        }, 10000);

        ws.onopen = () => {
          clearTimeout(timeout);
          console.log('✅ Connected to Deepgram');
          resolve();
        };

        ws.onerror = (event) => {
          clearTimeout(timeout);
          console.error('❌ Deepgram WebSocket error:', event);
          reject(new Error('Failed to connect to Deepgram'));
        };
      });

      // Handle Deepgram messages
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          if (data.type === 'Results' && data.channel?.alternatives?.[0]) {
            const transcript = data.channel.alternatives[0].transcript;
            const isFinal = data.is_final;

            if (transcript) {
              if (isFinal) {
                // Append to final transcript
                finalTranscriptRef.current += (finalTranscriptRef.current ? ' ' : '') + transcript;
                setState(prev => ({
                  ...prev,
                  finalTranscript: finalTranscriptRef.current,
                  partialTranscript: '',
                }));
              } else {
                // Update partial transcript
                setState(prev => ({
                  ...prev,
                  partialTranscript: transcript,
                }));
              }
            }
          }
        } catch (error) {
          console.error('Error parsing Deepgram message:', error);
        }
      };

      ws.onclose = (event) => {
        console.log('🔌 Deepgram WebSocket closed:', event.code, event.reason);
      };

      ws.onerror = (event) => {
        console.error('❌ Deepgram WebSocket error:', event);
        setState(prev => ({ ...prev, error: 'Deepgram connection error' }));
      };

      // Start microphone streaming
      console.log('🎤 Starting microphone...');
      const { subscription } = await ExpoPlayAudioStream.startMicrophone({
        sampleRate: 16000,
        channels: 1,
        encoding: 'pcm_16bit',
        interval: 250,
        enableProcessing: false,
        onAudioStream: async (event) => {
          if (event.type === 'microphone' && wsRef.current?.readyState === WebSocket.OPEN) {
            const data = typeof event.data === 'string' ? event.data : '';
            if (data) {
              const arrayBuffer = base64ToArrayBuffer(data);
              wsRef.current.send(arrayBuffer);
            }
          }
        },
      });

      audioSubscriptionRef.current = subscription;
      startTimeRef.current = Date.now();

      // Start duration timer
      durationIntervalRef.current = setInterval(() => {
        setState(prev => ({
          ...prev,
          duration: Math.floor((Date.now() - startTimeRef.current) / 1000),
        }));
      }, 1000);

      setState(prev => ({
        ...prev,
        status: 'recording',
        partialTranscript: '',
        finalTranscript: '',
        duration: 0,
      }));

      console.log('✅ Recording started');
    } catch (error) {
      console.error('❌ Failed to start recording:', error);
      setState(prev => ({
        ...prev,
        status: 'error',
        error: error instanceof Error ? error.message : 'Failed to start recording',
      }));
    }
  }, []);

  const stopRecording = useCallback(async () => {
    console.log('🛑 Stopping recording...');

    // Stop duration timer
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = null;
    }

    // Stop microphone
    if (audioSubscriptionRef.current) {
      audioSubscriptionRef.current.remove();
      audioSubscriptionRef.current = null;
    }

    try {
      await ExpoPlayAudioStream.stopMicrophone();
    } catch (error) {
      console.warn('stopMicrophone error:', error);
    }

    // Close Deepgram connection
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    const finalDuration = Math.floor((Date.now() - startTimeRef.current) / 1000);
    const transcript = finalTranscriptRef.current;

    setState(prev => ({
      ...prev,
      status: 'processing',
      duration: finalDuration,
      finalTranscript: transcript,
      partialTranscript: '',
    }));

    // Save transcript to backend if there's content
    if (transcript.trim()) {
      try {
        console.log('💾 Saving transcript to backend...');
        const result = await apiService.saveTranscript({
          transcript,
          duration: finalDuration,
          location: locationRef.current,
        });

        setState(prev => ({
          ...prev,
          status: 'done',
          savedObjectIds: result.objectIds,
        }));

        console.log(`✅ Saved ${result.objectCount} objects`);
      } catch (error) {
        console.error('❌ Failed to save transcript:', error);
        setState(prev => ({
          ...prev,
          status: 'error',
          error: error instanceof Error ? error.message : 'Failed to save transcript',
        }));
      }
    } else {
      setState(prev => ({
        ...prev,
        status: 'done',
        savedObjectIds: [],
      }));
    }
  }, []);

  const reset = useCallback(() => {
    setState({
      status: 'idle',
      partialTranscript: '',
      finalTranscript: '',
      duration: 0,
      error: null,
      savedObjectIds: [],
    });
    finalTranscriptRef.current = '';
  }, []);

  return {
    ...state,
    startRecording,
    stopRecording,
    reset,
  };
}
