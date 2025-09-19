"use client"

// MediaUtils for cross-browser and mobile-compatible getUserMedia
export interface MediaConstraints {
  video: boolean | MediaTrackConstraints
  audio: boolean | MediaTrackConstraints
}

export interface MediaError {
  type: 'NOT_SUPPORTED' | 'PERMISSION_DENIED' | 'NOT_FOUND' | 'CONSTRAINT_ERROR' | 'UNKNOWN'
  message: string
  originalError?: Error
}

export interface MediaResult {
  success: boolean
  stream?: MediaStream
  error?: MediaError
}

class MediaUtils {
  // Check if getUserMedia is supported
  static isGetUserMediaSupported(): boolean {
    return !!(
      navigator?.mediaDevices?.getUserMedia ||
      navigator?.getUserMedia ||
      // @ts-ignore - Legacy browser support
      navigator?.webkitGetUserMedia ||
      // @ts-ignore - Legacy browser support  
      navigator?.mozGetUserMedia
    )
  }

  // Check if we're on a mobile device
  static isMobile(): boolean {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
  }

  // Check if we're on iOS
  static isIOS(): boolean {
    return /iPad|iPhone|iPod/.test(navigator.userAgent)
  }

  // Check if we're on Android
  static isAndroid(): boolean {
    return /Android/.test(navigator.userAgent)
  }

  // Get optimal constraints for the current device
  static getOptimalConstraints(requestVideo: boolean = true, requestAudio: boolean = true): MediaConstraints {
    const isMobile = this.isMobile()
    const isIOS = this.isIOS()
    
    // Base constraints
    let videoConstraints: boolean | MediaTrackConstraints = requestVideo
    let audioConstraints: boolean | MediaTrackConstraints = requestAudio

    if (requestVideo && isMobile) {
      videoConstraints = {
        width: { ideal: isIOS ? 640 : 1280 },
        height: { ideal: isIOS ? 480 : 720 },
        frameRate: { ideal: 30, max: 30 },
        facingMode: { ideal: 'user' }, // Front camera for video calls
      }
    }

    if (requestAudio) {
      audioConstraints = {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        sampleRate: { ideal: 48000 },
      }
    }

    return {
      video: videoConstraints,
      audio: audioConstraints
    }
  }

  // Modern getUserMedia with proper error handling
  static async getUserMediaModern(constraints: MediaConstraints): Promise<MediaResult> {
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('navigator.mediaDevices.getUserMedia is not supported')
      }

      const stream = await navigator.mediaDevices.getUserMedia(constraints)
      return { success: true, stream }
    } catch (error: any) {
      return this.handleGetUserMediaError(error)
    }
  }

  // Legacy getUserMedia fallback
  static async getUserMediaLegacy(constraints: MediaConstraints): Promise<MediaResult> {
    return new Promise((resolve) => {
      // @ts-ignore - Legacy browser support
      const getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia

      if (!getUserMedia) {
        resolve({
          success: false,
          error: {
            type: 'NOT_SUPPORTED',
            message: 'getUserMedia is not supported in this browser'
          }
        })
        return
      }

      getUserMedia.call(
        navigator,
        constraints,
        (stream: MediaStream) => {
          resolve({ success: true, stream })
        },
        (error: Error) => {
          resolve(this.handleGetUserMediaError(error))
        }
      )
    })
  }

  // Main getUserMedia function with fallbacks
  static async getUserMedia(
    requestVideo: boolean = true,
    requestAudio: boolean = true
  ): Promise<MediaResult> {
    console.log(`🎥 Requesting media access - Video: ${requestVideo}, Audio: ${requestAudio}`)
    console.log(`📱 Device info - Mobile: ${this.isMobile()}, iOS: ${this.isIOS()}, Android: ${this.isAndroid()}`)

    if (!this.isGetUserMediaSupported()) {
      return {
        success: false,
        error: {
          type: 'NOT_SUPPORTED',
          message: 'Camera and microphone access is not supported in this browser. Please use a modern browser like Chrome, Safari, or Firefox.'
        }
      }
    }

    const constraints = this.getOptimalConstraints(requestVideo, requestAudio)
    console.log('🔧 Using constraints:', constraints)

    // Try modern API first
    let result = await this.getUserMediaModern(constraints)
    
    // If modern API fails, try legacy fallback
    if (!result.success && navigator.getUserMedia) {
      console.log('⚡ Modern API failed, trying legacy fallback...')
      result = await this.getUserMediaLegacy(constraints)
    }

    // If video + audio fails, try audio only
    if (!result.success && requestVideo && requestAudio) {
      console.log('🔄 Video + Audio failed, trying audio only...')
      result = await this.getUserMediaModern({ video: false, audio: constraints.audio })
    }

    // If still failing and on mobile, try with basic constraints
    if (!result.success && this.isMobile()) {
      console.log('📱 Trying basic mobile constraints...')
      const basicConstraints = {
        video: requestVideo ? { facingMode: 'user' } : false,
        audio: requestAudio
      }
      result = await this.getUserMediaModern(basicConstraints)
    }

    if (result.success) {
      console.log('✅ Media access granted successfully')
      console.log(`🎬 Stream details - Video tracks: ${result.stream?.getVideoTracks().length}, Audio tracks: ${result.stream?.getAudioTracks().length}`)
    } else {
      console.error('❌ Media access failed:', result.error)
    }

    return result
  }

  // Error handling with user-friendly messages
  private static handleGetUserMediaError(error: any): MediaResult {
    let errorType: MediaError['type'] = 'UNKNOWN'
    let message = 'An unknown error occurred while accessing camera and microphone'

    if (error.name || error.message) {
      const errorName = error.name?.toLowerCase() || error.message?.toLowerCase() || ''
      
      if (errorName.includes('permission') || errorName.includes('denied') || error.name === 'NotAllowedError') {
        errorType = 'PERMISSION_DENIED'
        message = this.isMobile() 
          ? 'Camera and microphone access denied. Please check your browser settings and allow permissions for this site.'
          : 'Permission denied. Please click "Allow" when prompted for camera and microphone access.'
      } else if (errorName.includes('notfound') || errorName.includes('devicenotfound') || error.name === 'NotFoundError') {
        errorType = 'NOT_FOUND'
        message = 'No camera or microphone found. Please check that your devices are connected and not being used by another application.'
      } else if (errorName.includes('constraint') || errorName.includes('overconstrained') || error.name === 'OverconstrainedError') {
        errorType = 'CONSTRAINT_ERROR'
        message = 'Camera or microphone settings not supported. Trying with basic settings...'
      } else if (errorName.includes('notsupported') || errorName.includes('notreadable') || error.name === 'NotSupportedError') {
        errorType = 'NOT_SUPPORTED'
        message = 'Camera and microphone access is not supported in this browser or device.'
      }
    }

    // Special handling for iOS Safari
    if (this.isIOS() && errorType === 'PERMISSION_DENIED') {
      message += ' On iOS, make sure Safari has permission to access camera and microphone in Settings > Safari > Camera & Microphone.'
    }

    // Special handling for Android Chrome
    if (this.isAndroid() && errorType === 'PERMISSION_DENIED') {
      message += ' On Android, make sure Chrome has camera and microphone permissions in your device settings.'
    }

    return {
      success: false,
      error: {
        type: errorType,
        message,
        originalError: error
      }
    }
  }

  // Stop all tracks in a stream
  static stopMediaStream(stream: MediaStream | null): void {
    if (stream) {
      stream.getTracks().forEach(track => {
        console.log(`🛑 Stopping ${track.kind} track`)
        track.stop()
      })
    }
  }

  // Check if a stream has active tracks
  static isStreamActive(stream: MediaStream | null): boolean {
    if (!stream) return false
    return stream.getTracks().some(track => track.readyState === 'live')
  }

  // Get user-friendly device info
  static getDeviceInfo(): { platform: string; browser: string; mobile: boolean } {
    const ua = navigator.userAgent
    let browser = 'Unknown'
    let platform = 'Unknown'

    // Detect browser
    if (ua.includes('Chrome')) browser = 'Chrome'
    else if (ua.includes('Safari') && !ua.includes('Chrome')) browser = 'Safari'
    else if (ua.includes('Firefox')) browser = 'Firefox'
    else if (ua.includes('Edge')) browser = 'Edge'

    // Detect platform
    if (ua.includes('iPhone')) platform = 'iPhone'
    else if (ua.includes('iPad')) platform = 'iPad'
    else if (ua.includes('Android')) platform = 'Android'
    else if (ua.includes('Windows')) platform = 'Windows'
    else if (ua.includes('Mac')) platform = 'Mac'
    else if (ua.includes('Linux')) platform = 'Linux'

    return {
      platform,
      browser,
      mobile: this.isMobile()
    }
  }
}

export default MediaUtils