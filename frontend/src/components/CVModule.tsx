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
  const blinkTimestampsRef = useRef<number[]>([])
  const lastEARRef = useRef<number>(0.4)

  // Helper: Clamp value between 0 and 1
  const clamp = (value: number, min: number, max: number): number => {
    return Math.max(min, Math.min(max, value))
  }

  // Helper: Calculate eye aspect ratio (EAR)
  // EAR = ||p2 - p6|| + ||p3 - p5|| / (2 * ||p1 - p4||)
  const calculateEAR = (eye: any[]): number => {
    if (eye.length < 6) return 0.4

    const p1 = eye[0] // Top
    const p2 = eye[1] // Top-right
    const p3 = eye[2] // Bottom-right
    const p4 = eye[3] // Bottom
    const p5 = eye[4] // Bottom-left
    const p6 = eye[5] // Top-left

    const vertical1 = Math.hypot(p2.x - p6.x, p2.y - p6.y)
    const vertical2 = Math.hypot(p3.x - p5.x, p3.y - p5.y)
    const horizontal = Math.hypot(p1.x - p4.x, p1.y - p4.y)

    return (vertical1 + vertical2) / (2 * horizontal)
  }

  // Helper: Detect blink events
  const updateBlinkRate = (currentEAR: number): number => {
    const EAR_THRESHOLD = 0.2
    const now = Date.now()

    // Detect blink event (EAR crosses threshold)
    if (lastEARRef.current > EAR_THRESHOLD && currentEAR <= EAR_THRESHOLD) {
      blinkTimestampsRef.current.push(now)
    }

    lastEARRef.current = currentEAR

    // Remove timestamps older than 60 seconds
    const cutoffTime = now - 60000
    blinkTimestampsRef.current = blinkTimestampsRef.current.filter((ts) => ts > cutoffTime)

    // Calculate blinks per minute
    if (blinkTimestampsRef.current.length === 0) return 0

    const timeSpanMs = now - blinkTimestampsRef.current[0]
    const timeSpanMin = Math.max(timeSpanMs / 60000, 0.016) // At least one frame (30fps)
    const blink_rate = (blinkTimestampsRef.current.length / timeSpanMin) * 0.9 // Smooth factor

    return Math.round(blink_rate * 100) / 100
  }

  // Helper: Calculate normalized iris gaze position
  const calculateGaze = (landmarks: any): { gaze_x: number; gaze_y: number } => {
    // Iris landmarks: 468-472 (left iris), 473-477 (right iris)
    const leftIrisStart = 468
    const rightIrisStart = 473
    const irisPointCount = 5

    // Average left iris points
    let leftIrisX = 0,
      leftIrisY = 0
    for (let i = 0; i < irisPointCount; i++) {
      const point = landmarks[leftIrisStart + i]
      leftIrisX += point.x
      leftIrisY += point.y
    }
    leftIrisX /= irisPointCount
    leftIrisY /= irisPointCount

    // Average right iris points
    let rightIrisX = 0,
      rightIrisY = 0
    for (let i = 0; i < irisPointCount; i++) {
      const point = landmarks[rightIrisStart + i]
      rightIrisX += point.x
      rightIrisY += point.y
    }
    rightIrisX /= irisPointCount
    rightIrisY /= irisPointCount

    // Average both eyes and normalize to 0-1
    const gaze_x = clamp((leftIrisX + rightIrisX) / 2, 0, 1)
    const gaze_y = clamp((leftIrisY + rightIrisY) / 2, 0, 1)

    return { gaze_x, gaze_y }
  }

  // Helper: Calculate head pose yaw angle
  const calculateHeadPose = (landmarks: any): number => {
    const noseTip = landmarks[1]
    const chin = landmarks[152]
    const xDelta = chin.x - noseTip.x
    const head_pose_deg = xDelta * 90 // Scale to approximate degrees
    return Math.round(Math.abs(head_pose_deg) * 100) / 100
  }

  // Helper: Calculate focus score from biometric metrics
  const calculateFocusScore = (
    gaze_x: number,
    gaze_y: number,
    blink_rate: number,
    head_pose_deg: number
  ): number => {
    // Gaze score: higher when looking at center (0.5, 0.5)
    const gazeDist = Math.sqrt(Math.pow(gaze_x - 0.5, 2) + Math.pow(gaze_y - 0.5, 2))
    const gazeScore = clamp(1 - gazeDist * 2, 0, 1)

    // Blink normalization: higher when blink rate is lower
    const blinkNorm = clamp(blink_rate / 30, 0, 1)

    // Pose normalization: higher when head is upright
    const poseNorm = clamp(Math.abs(head_pose_deg) / 45, 0, 1)

    // Weighted focus score
    const focus_score = 0.4 * gazeScore + 0.3 * (1 - blinkNorm) + 0.3 * (1 - poseNorm)

    return Math.round(focus_score * 100) / 100
  }

  // Log studentId for data correlation
  useEffect(() => {
    if (active) {
      console.log(`CVModule: Tracking focus for student ${studentId}`)
    }
  }, [studentId, active])

  // FaceMesh onResults callback
  const handleFaceMeshResults = useCallback(
    (results: any) => {
      if (!results.multiFaceLandmarks || results.multiFaceLandmarks.length === 0) {
        // No face detected
        onFocusData({
          gaze_x: 0.5,
          gaze_y: 0.5,
          blink_rate: 0,
          head_pose_deg: 0,
          focus_score: 0.2,
          ts: Date.now()
        })
        return
      }

      const landmarks = results.multiFaceLandmarks[0]

      // Extract iris gaze normalized to 0-1
      const { gaze_x, gaze_y } = calculateGaze(landmarks)

      // Calculate left eye aspect ratio (landmarks: 159, 145, 33, 133)
      const leftEye = [
        landmarks[33], // Eye top
        landmarks[157], // Eye right
        landmarks[158], // Eye right-down
        landmarks[159], // Eye bottom
        landmarks[145], // Eye left-down
        landmarks[144] // Eye left
      ]

      // Calculate right eye aspect ratio (landmarks: 386, 374, 362, 263)
      const rightEye = [
        landmarks[362], // Eye top
        landmarks[385], // Eye right
        landmarks[386], // Eye right-down
        landmarks[374], // Eye bottom
        landmarks[263], // Eye left-down
        landmarks[362] // Eye left (reuse top as approximation)
      ]

      const leftEAR = calculateEAR(leftEye)
      const rightEAR = calculateEAR(rightEye)
      const avgEAR = (leftEAR + rightEAR) / 2

      // Calculate blink rate from eye aspect ratio
      const blink_rate = updateBlinkRate(avgEAR)

      // Calculate head pose from nose vs chin
      const head_pose_deg = calculateHeadPose(landmarks)

      // Calculate focus score
      const focus_score = calculateFocusScore(gaze_x, gaze_y, blink_rate, head_pose_deg)

      onFocusData({
        gaze_x,
        gaze_y,
        blink_rate,
        head_pose_deg,
        focus_score,
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

      // Use the handleFaceMeshResults callback
      faceMesh.onResults(handleFaceMeshResults)

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
  }, [onFocusData, handleFaceMeshResults])

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
