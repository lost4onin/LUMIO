import React, { useEffect, useRef, useCallback } from 'react'
import { FocusPayload } from '../types'

interface CVModuleProps {
  studentId: string
  onFocusData: (payload: FocusPayload) => void
  active: boolean
}

// Extend window to include MediaPipe globals
declare global {
  interface Window {
    FaceMesh: any
    Camera: any
  }
}

const CVModule: React.FC<CVModuleProps> = ({ studentId, onFocusData, active }) => {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const faceMeshRef = useRef<any>(null)
  const cameraRef = useRef<any>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const frameCounterRef = useRef<number>(0)
  const blinksRef = useRef<number>(0)
  const lastEyeOpenRef = useRef<number>(0)

  // Log studentId for data correlation (used in onFocusData callback)
  useEffect(() => {
    if (active) {
      console.log(`CVModule: Tracking focus for student ${studentId}`)
    }
  }, [studentId, active])

  // Calculate focus metrics from face landmarks
  const calculateFocusMetrics = useCallback(
    (landmarks: any) => {
      if (!landmarks || landmarks.length === 0) {
        // No face detected
        onFocusData({
          gaze_x: 0,
          gaze_y: 0,
          blink_rate: 0,
          head_pose_deg: 0,
          focus_score: 0.3,
          ts: Date.now()
        })
        return
      }

      const faceLandmarks = landmarks[0]

      // Detect eye openness (landmarks 145-159 are eyes)
      const leftEyeTop = faceLandmarks[159]
      const leftEyeBottom = faceLandmarks[145]
      const rightEyeTop = faceLandmarks[386]
      const rightEyeBottom = faceLandmarks[374]

      const leftEyeOpenness =
        Math.abs(leftEyeTop.y - leftEyeBottom.y) /
        Math.abs(leftEyeTop.x - leftEyeBottom.x)
      const rightEyeOpenness =
        Math.abs(rightEyeTop.y - rightEyeBottom.y) /
        Math.abs(rightEyeTop.x - rightEyeBottom.x)

      const eyeOpenness = (leftEyeOpenness + rightEyeOpenness) / 2

      // Detect blinks (eye openness drops below threshold)
      const blink_threshold = 0.15
      if (eyeOpenness > lastEyeOpenRef.current && lastEyeOpenRef.current < blink_threshold) {
        blinksRef.current += 1
      }
      lastEyeOpenRef.current = eyeOpenness

      // Gaze position (use nose tip and eye center)
      const noseTip = faceLandmarks[1]
      const leftEyeCenter = {
        x: (faceLandmarks[133].x + faceLandmarks[173].x) / 2,
        y: (faceLandmarks[133].y + faceLandmarks[173].y) / 2
      }
      const rightEyeCenter = {
        x: (faceLandmarks[362].x + faceLandmarks[263].x) / 2,
        y: (faceLandmarks[362].y + faceLandmarks[263].y) / 2
      }

      const eyeCenter = {
        x: (leftEyeCenter.x + rightEyeCenter.x) / 2,
        y: (leftEyeCenter.y + rightEyeCenter.y) / 2
      }

      // Calculate gaze offset from face center
      const faceCenter = {
        x: (faceLandmarks[10].x + noseTip.x) / 2,
        y: (faceLandmarks[10].y + noseTip.y) / 2
      }

      const gaze_x = (eyeCenter.x - faceCenter.x) * 100
      const gaze_y = (eyeCenter.y - faceCenter.y) * 100

      // Head pose estimation (use forehead and chin)
      const forehead = faceLandmarks[10]
      const chin = faceLandmarks[152]
      const headVector = Math.atan2(chin.y - forehead.y, chin.x - forehead.x) * (180 / Math.PI)
      const head_pose_deg = Math.abs(headVector)

      // Focus score calculation
      // Higher when: eyes open, looking forward, head upright
      let focus_score = 0.5
      focus_score += eyeOpenness > 0.15 ? 0.3 : -0.2 // Eye openness
      focus_score += Math.abs(gaze_x) < 20 && Math.abs(gaze_y) < 20 ? 0.2 : -0.1 // Looking forward
      focus_score += head_pose_deg < 30 ? 0.2 : -0.1 // Head upright
      focus_score = Math.max(0, Math.min(1, focus_score))

      // Calculate blink rate (per minute)
      frameCounterRef.current += 1
      let blink_rate = 0
      if (frameCounterRef.current % 300 === 0) {
        // Calculate every 10 seconds (assuming 30fps)
        blink_rate = (blinksRef.current / 10) * 6 // Convert to per minute
        blinksRef.current = 0
      }

      onFocusData({
        gaze_x: Math.round(gaze_x * 100) / 100,
        gaze_y: Math.round(gaze_y * 100) / 100,
        blink_rate,
        head_pose_deg: Math.round(head_pose_deg * 100) / 100,
        focus_score: Math.round(focus_score * 100) / 100,
        ts: Date.now()
      })
    },
    [onFocusData]
  )

  // Initialize MediaPipe FaceMesh
  const initillizeFaceMesh = useCallback(async () => {
    try {
      // Request camera access
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user' }
      })
      streamRef.current = stream

      // Create video element
      const video = videoRef.current
      if (!video) return

      video.srcObject = stream
      video.onloadedmetadata = () => {
        video.play()
      }

      // Initialize FaceMesh
      const faceMesh = new window.FaceMesh({
        locateFile: (file: string) => {
          return `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh@0.4.1633559619/${file}`
        }
      })

      faceMesh.setOptions({
        maxNumFaces: 1,
        refineLandmarks: true,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5
      })

      faceMesh.onResults((results: any) => {
        if (results.multiFaceLandmarks) {
          calculateFocusMetrics(results.multiFaceLandmarks)
        } else {
          // No face detected
          onFocusData({
            gaze_x: 0,
            gaze_y: 0,
            blink_rate: 0,
            head_pose_deg: 0,
            focus_score: 0.2,
            ts: Date.now()
          })
        }
      })

      // Initialize Camera and start processing
      const camera = new window.Camera(video, {
        onFrame: async () => {
          await faceMesh.send({ image: video })
        },
        width: 640,
        height: 480
      })

      camera.start()
      faceMeshRef.current = faceMesh
      cameraRef.current = camera
    } catch (error) {
      console.error('getUserMedia error:', error)
      // Graceful degradation: send degraded focus data
      onFocusData({
        gaze_x: 0,
        gaze_y: 0,
        blink_rate: 0,
        head_pose_deg: 0,
        focus_score: 0.5,
        ts: Date.now()
      })
    }
  }, [onFocusData, calculateFocusMetrics])

  // Cleanup function
  const cleanup = useCallback(() => {
    // Stop camera processing
    if (cameraRef.current) {
      try {
        cameraRef.current.stop()
      } catch (error) {
        console.error('Error stopping camera:', error)
      }
      cameraRef.current = null
    }

    // Stop FaceMesh
    if (faceMeshRef.current) {
      try {
        faceMeshRef.current.close()
      } catch (error) {
        console.error('Error closing FaceMesh:', error)
      }
      faceMeshRef.current = null
    }

    // Stop media stream tracks (GDPR: no video leaves device)
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        track.stop()
      })
      streamRef.current = null
    }

    // Clear video element
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
  }, [])

  // Mount/unmount lifecycle
  useEffect(() => {
    if (active) {
      initillizeFaceMesh()
    } else {
      cleanup()
    }

    return () => {
      cleanup()
    }
  }, [active, initillizeFaceMesh, cleanup])

  // Hidden video element for MediaPipe processing
  return (
    <>
      <video
        ref={videoRef}
        style={{ display: 'none' }}
        width={640}
        height={480}
      />
      <canvas
        ref={canvasRef}
        style={{ display: 'none' }}
        width={640}
        height={480}
      />
    </>
  )
}

export default CVModule
