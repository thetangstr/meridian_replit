import { useState, useRef, useEffect } from "react";
import { Camera } from "react-camera-pro";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Camera as CameraIcon, Video, X, AlertCircle, Upload, RefreshCw, Circle, Square, RotateCcw } from "lucide-react";
import { MediaItem } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";

interface MediaCaptureProps {
  media: MediaItem[];
  maxItems?: number;
  onChange: (media: MediaItem[]) => void;
  className?: string;
}

export function MediaCapture({
  media = [],
  maxItems = 5, // Default max of 5 items
  onChange,
  className
}: MediaCaptureProps) {
  // Constants
  const MAX_RECORDING_TIME = 120; // 2 minutes in seconds
  
  const { toast } = useToast();
  const cameraRef = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const [cameraMode, setCameraMode] = useState<'image' | 'video' | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [isLoading, setIsLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [cameraSupported, setCameraSupported] = useState(true);
  const [uploadType, setUploadType] = useState<'image' | 'video'>('image');
  
  // Ref for recording timer interval
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Helper function to format seconds into mm:ss format
  const formatTime = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  };
  
  // Check if device has camera
  useEffect(() => {
    const checkCameraSupport = async () => {
      try {
        // Check if mediaDevices exists
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          setCameraSupported(false);
          return;
        }
        
        // Test camera access
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        // If we got here, camera is supported. Clean up the test stream.
        stream.getTracks().forEach(track => track.stop());
        setCameraSupported(true);
      } catch (err) {
        console.error("Camera not supported or permission denied:", err);
        setCameraSupported(false);
      }
    };
    
    checkCameraSupport();
    
    // Cleanup function to ensure we don't leave any cameras on
    return () => {
      stopCamera();
    };
  }, []);

  // Camera Operations
  const switchCameraMode = (mode: 'image' | 'video' | null) => {
    // If we're already in the selected mode, just turn it off
    if (mode === cameraMode) {
      stopCamera();
      return;
    }
    
    // If we have an ongoing recording, stop it first
    if (isRecording) {
      stopRecording();
    }
    
    // Release any existing camera resources
    stopCamera(false); // don't reset cameraMode yet
    
    // If we're turning off the camera, we're done
    if (mode === null) {
      setCameraMode(null);
      return;
    }
    
    // If camera isn't supported, use file input instead
    if (!cameraSupported) {
      if (mode === 'image' && fileInputRef.current) {
        fileInputRef.current.click();
      } else if (mode === 'video' && videoInputRef.current) {
        videoInputRef.current.click();
      }
      return;
    }
    
    // Set the new camera mode
    setCameraMode(mode);
    
    // For video mode, initialize the preview
    if (mode === 'video') {
      try {
        initializeVideoPreview();
      } catch (error) {
        console.error("Failed to initialize video preview:", error);
        setCameraMode(null);
        toast({
          title: "Camera error",
          description: "Could not access camera. Please check permissions and try again.",
          variant: "destructive"
        });
      }
    }
  };

  const stopCamera = (resetMode = true) => {
    // Stop recording if it's active
    if (isRecording) {
      stopRecording();
    }
    
    // Stop any media streams
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }
    
    // Clear recorder
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current = null;
    }
    
    // Reset mode if needed
    if (resetMode) {
      setCameraMode(null);
    }
  };

  const switchFacingMode = () => {
    setFacingMode(prevMode => prevMode === 'environment' ? 'user' : 'environment');
    
    // For video mode, we need to restart the preview
    if (cameraMode === 'video' && mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
      
      // Re-initialize the preview
      initializeVideoPreview();
    }
  };

  // Image Operations
  const captureImage = async () => {
    if (!cameraRef.current) return;
    
    try {
      setIsLoading(true);
      const photo = cameraRef.current.takePhoto();
      await handleCapturedPhoto(photo);
    } catch (error) {
      console.error('Error taking photo:', error);
      toast({
        variant: "destructive",
        title: "Failed to capture photo",
        description: "There was an error while trying to take the photo."
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCapturedPhoto = async (photoDataUrl: string) => {
    try {
      // Convert data URL to blob for upload
      const response = await fetch(photoDataUrl);
      const blob = await response.blob();
      
      // Create a file from the blob
      const file = new File([blob], `photo_${Date.now()}.jpg`, { type: 'image/jpeg' });
      
      // Upload the file
      await handleFileUpload(file, 'image');
    } catch (error) {
      console.error("Error processing captured photo:", error);
      toast({
        variant: "destructive",
        title: "Failed to process photo",
        description: "There was an error processing the captured photo."
      });
    }
  };

  // Video Operations
  const initializeVideoPreview = async () => {
    setIsLoading(true);
    
    try {
      // Use reasonable settings to ensure stability
      const constraints = {
        video: {
          facingMode,
          width: { ideal: 640 },
          height: { ideal: 480 },
          frameRate: { ideal: 24 }
        },
        audio: true
      };
      
      // Stop any existing streams
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(track => track.stop());
        mediaStreamRef.current = null;
      }
      
      // Start the preview
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      mediaStreamRef.current = stream;
      
      // Setup video preview
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        try {
          await videoRef.current.play();
        } catch (playErr) {
          console.error("Error playing video preview:", playErr);
        }
      }
      
      // Setup MediaRecorder
      if ('MediaRecorder' in window) {
        // Try to use universally supported codecs
        let options = {};
        const possibleTypes = [
          'video/webm;codecs=vp9,opus',
          'video/webm;codecs=vp8,opus', 
          'video/webm;codecs=h264,opus',
          'video/mp4;codecs=h264,aac',
          'video/webm',
          'video/mp4'
        ];
        
        for (const type of possibleTypes) {
          if (MediaRecorder.isTypeSupported(type)) {
            options = { mimeType: type };
            console.log(`Using ${type} format for video recording`);
            break;
          }
        }
        
        const mediaRecorder = new MediaRecorder(stream, options);
        mediaRecorderRef.current = mediaRecorder;
        
        // Setup data handling
        mediaRecorder.ondataavailable = (event) => {
          if (event.data && event.data.size > 0) {
            recordedChunksRef.current.push(event.data);
          }
        };
        
        // Handle recording stop
        mediaRecorder.onstop = () => {
          if (recordedChunksRef.current.length > 0 && isRecording) {
            processVideoRecording();
          } else {
            setIsRecording(false);
          }
        };
        
        mediaRecorder.onerror = (err) => {
          console.error("MediaRecorder error:", err);
          toast({
            title: "Recording error",
            description: "An error occurred during recording. Please try again.",
            variant: "destructive"
          });
          setIsRecording(false);
        };
      } else {
        toast({
          title: "Limited recording support",
          description: "Your browser may not fully support video recording."
        });
      }
    } catch (error) {
      console.error("Error initializing video preview:", error);
      toast({
        title: "Camera access failed",
        description: "Could not access your camera. Please check permissions.",
        variant: "destructive"
      });
      
      setCameraMode(null);
    } finally {
      setIsLoading(false);
    }
  };

  const startRecording = () => {
    if (!isRecording && mediaRecorderRef.current) {
      try {
        // Reset recording time
        setRecordingTime(0);
        
        // Start the timer
        recordingTimerRef.current = setInterval(() => {
          setRecordingTime(prevTime => {
            const newTime = prevTime + 1;
            // Auto-stop recording at MAX_RECORDING_TIME (2 minutes)
            if (newTime >= MAX_RECORDING_TIME) {
              stopRecording();
              toast({
                title: "Recording complete",
                description: `Recording automatically stopped at ${MAX_RECORDING_TIME / 60} minutes.`
              });
            }
            return newTime;
          });
        }, 1000);
        
        // Clear any previous recorded chunks
        recordedChunksRef.current = [];
        
        // Start recording - request data every second
        mediaRecorderRef.current.start(1000);
        setIsRecording(true);
        
        toast({
          title: "Recording started",
          description: "Tap the square button when you want to stop recording."
        });
      } catch (error) {
        console.error("Error starting recording:", error);
        toast({
          variant: "destructive",
          title: "Recording failed",
          description: "Could not start video recording. Please try again."
        });
      }
    }
  };

  const stopRecording = () => {
    // Stop the recording timer
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    
    // Stop the recorder
    if (mediaRecorderRef.current && isRecording) {
      try {
        mediaRecorderRef.current.stop();
      } catch (error) {
        console.error("Error stopping recorder:", error);
        processVideoRecording(); // Try to process anyway
      }
    } else {
      setIsRecording(false);
    }
  };

  const processVideoRecording = async () => {
    try {
      if (recordedChunksRef.current.length === 0) {
        toast({
          variant: "destructive",
          title: "Recording failed",
          description: "No video data was captured. Please try again."
        });
        setIsRecording(false);
        return;
      }
      
      // Create a blob from all chunks
      const mimeType = recordedChunksRef.current[0].type || 'video/webm';
      const videoBlob = new Blob(recordedChunksRef.current, { type: mimeType });
      
      // Convert to file for upload
      const file = new File(
        [videoBlob],
        `video_${Date.now()}.${mimeType.includes('mp4') ? 'mp4' : 'webm'}`,
        { type: mimeType }
      );
      
      // Upload the file
      await handleFileUpload(file, 'video');
      
      // Clear the recorded chunks
      recordedChunksRef.current = [];
    } catch (error) {
      console.error("Error processing video:", error);
      toast({
        variant: "destructive",
        title: "Video processing failed",
        description: "There was an error processing the recorded video."
      });
    } finally {
      setIsRecording(false);
    }
  };

  // File Upload Operations
  const handleFileInput = async (event: React.ChangeEvent<HTMLInputElement>, type: 'image' | 'video') => {
    const files = event.target.files;
    if (!files || files.length === 0) return;
    
    // Process each file
    for (let i = 0; i < files.length; i++) {
      if (media.length + i >= maxItems) {
        toast({
          title: "Maximum media reached",
          description: `You can only add up to ${maxItems} media items.`
        });
        break;
      }
      
      const file = files[i];
      
      // Check video duration for videos
      if (type === 'video') {
        try {
          // Create a temporary URL to check the video duration
          const url = URL.createObjectURL(file);
          const video = document.createElement('video');
          
          // Wait for video metadata to load
          await new Promise((resolve, reject) => {
            video.onloadedmetadata = resolve;
            video.onerror = reject;
            video.src = url;
          });
          
          // Check if video is too long (duration is in seconds)
          if (video.duration > MAX_RECORDING_TIME) {
            URL.revokeObjectURL(url);
            toast({
              variant: "destructive",
              title: "Video too long",
              description: `Videos must be ${MAX_RECORDING_TIME / 60} minutes or less. This video is ${Math.ceil(video.duration / 60)} minutes.`
            });
            continue; // Skip this file
          }
          
          URL.revokeObjectURL(url);
        } catch (error) {
          console.error("Error checking video duration:", error);
          // Continue with upload if we can't check the duration
        }
      }
      
      await handleFileUpload(file, type);
    }
    
    // Reset the input value to allow re-selecting the same file
    event.target.value = '';
  };

  const handleFileUpload = async (file: File, type: 'image' | 'video') => {
    // Create a temporary media item with a local URL
    const tempId = `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const tempUrl = URL.createObjectURL(file);
    
    const tempItem: MediaItem = {
      id: tempId,
      type,
      url: tempUrl,
      createdAt: new Date().toISOString()
    };
    
    // Add it to the media array
    const updatedMedia = [...media, tempItem];
    onChange(updatedMedia);
    
    try {
      // Create form data for upload
      const formData = new FormData();
      formData.append('file', file);
      formData.append('type', type);
      
      // Upload to server
      const response = await fetch('/api/media/upload', {
        method: 'POST',
        body: formData
      });
      
      if (!response.ok) {
        throw new Error(`Upload failed with status: ${response.status}`);
      }
      
      // Get the media item from the response
      const mediaItem: MediaItem = await response.json();
      
      // Replace the temporary item with the real one
      const finalMedia = updatedMedia.map(item => 
        item.id === tempId ? mediaItem : item
      );
      
      onChange(finalMedia);
      
      // Clean up the temporary URL
      URL.revokeObjectURL(tempUrl);
      
      toast({
        title: "Upload successful",
        description: `${type === 'image' ? 'Image' : 'Video'} was uploaded successfully.`
      });
    } catch (error) {
      console.error("Upload error:", error);
      
      // Remove the temporary item
      const filteredMedia = updatedMedia.filter(item => item.id !== tempId);
      onChange(filteredMedia);
      
      // Clean up the temporary URL
      URL.revokeObjectURL(tempUrl);
      
      toast({
        variant: "destructive",
        title: "Upload failed",
        description: "There was an error uploading your media. Please try again."
      });
    }
  };

  const handleRemoveMedia = (index: number) => {
    const updatedMedia = [...media];
    const removedItem = updatedMedia[index];
    
    // Remove from array
    updatedMedia.splice(index, 1);
    onChange(updatedMedia);
    
    // If it's a temporary URL (blob), revoke it
    if (removedItem.url.startsWith('blob:')) {
      try {
        URL.revokeObjectURL(removedItem.url);
      } catch (e) {
        console.error("Error revoking URL:", e);
      }
    }
    
    // If it's a server-stored item, you may want to delete it from the server
    // This depends on your API design
    if (!removedItem.url.startsWith('blob:')) {
      fetch(`/api/media/${removedItem.id}`, { method: 'DELETE' })
        .catch(error => {
          console.error("Error deleting media from server:", error);
        });
    }
  };

  return (
    <div className={`space-y-4 ${className || ''}`}>
      {/* File inputs for upload */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={(e) => handleFileInput(e, 'image')}
        accept="image/*"
        className="hidden"
        capture="environment"
      />
      <input
        type="file"
        ref={videoInputRef}
        onChange={(e) => handleFileInput(e, 'video')}
        accept="video/*"
        className="hidden"
        capture="environment"
      />
      
      {/* Camera UI */}
      {cameraMode && (
        <div className="relative">
          {/* Camera mode toggle */}
          <div className="absolute top-4 left-0 right-0 z-10 flex justify-center">
            <div className="bg-black/50 inline-flex rounded-lg p-1">
              <button
                type="button"
                className={`px-3 py-1 rounded-md text-sm flex items-center ${cameraMode === 'image' ? 'bg-white text-primary font-medium' : 'text-white'}`}
                onClick={() => {
                  if (cameraMode !== 'image') {
                    // Stop current stream if needed
                    if (mediaStreamRef.current) {
                      mediaStreamRef.current.getTracks().forEach(track => track.stop());
                      mediaStreamRef.current = null;
                    }
                    // Update both state variables
                    setCameraMode('image');
                    setUploadType('image');
                  }
                }}
              >
                <CameraIcon className="h-4 w-4 mr-2" />
                Photo
              </button>
              <button
                type="button"
                className={`px-3 py-1 rounded-md text-sm flex items-center ${cameraMode === 'video' ? 'bg-white text-primary font-medium' : 'text-white'}`}
                onClick={() => {
                  if (cameraMode !== 'video') {
                    // Stop current recording if needed
                    if (isRecording) {
                      stopRecording();
                    }
                    // Switch to video mode
                    setCameraMode('video');
                    setUploadType('video');
                    // Initialize the video preview
                    initializeVideoPreview();
                  }
                }}
              >
                <Video className="h-4 w-4 mr-2" />
                Video
              </button>
            </div>
          </div>
          
          {cameraMode === 'image' && (
            <div className="w-full aspect-square overflow-hidden rounded-lg">
              <Camera
                ref={cameraRef}
                facingMode={facingMode}
                aspectRatio={1}
                errorMessages={{
                  noCameraAccessible: 'Camera not available. Please check permissions.',
                  permissionDenied: 'Camera permission denied. Please allow camera access.',
                  switchCamera: 'Cannot switch camera. Device may have only one camera.',
                  canvas: 'Canvas not supported.'
                }}
              />
            </div>
          )}
          
          {cameraMode === 'video' && (
            <div className="w-full aspect-video overflow-hidden rounded-lg bg-black">
              <video 
                ref={videoRef}
                className="w-full h-full object-cover"
                autoPlay 
                playsInline 
                muted
              />
              
              {!isRecording && (
                <div className="absolute top-14 left-4 right-4 bg-black/60 text-white text-xs rounded-md px-3 py-1.5">
                  <div className="text-center">
                    <span className="font-medium">Maximum recording time: {Math.floor(MAX_RECORDING_TIME / 60)} minutes</span>
                  </div>
                </div>
              )}
              
              {isRecording && (
                <div className="absolute top-14 right-4 bg-destructive text-white text-xs rounded-full px-2 py-1 flex items-center animate-pulse">
                  <span className="mr-1 h-2 w-2 rounded-full bg-white inline-block"></span>
                  {formatTime(recordingTime)} / {formatTime(MAX_RECORDING_TIME)}
                </div>
              )}
            </div>
          )}
          
          {/* Camera controls - common for both modes */}
          <div className="absolute bottom-0 left-0 right-0 flex justify-center p-4 gap-4">
            <button
              type="button"
              className="bg-white rounded-full p-3 shadow-lg focus:outline-none focus:ring-2 focus:ring-primary"
              onClick={switchFacingMode}
            >
              <RefreshCw className="h-6 w-6 text-primary" />
            </button>
            
            {cameraMode === 'image' ? (
              <button
                type="button"
                className="bg-primary rounded-full p-3 shadow-lg focus:outline-none focus:ring-2 focus:ring-primary"
                onClick={captureImage}
                disabled={isLoading}
              >
                <CameraIcon className="h-6 w-6 text-white" />
              </button>
            ) : (
              <button
                type="button"
                className={`${isRecording ? 'bg-destructive' : 'bg-primary'} rounded-full p-3 shadow-lg focus:outline-none focus:ring-2 focus:ring-primary relative`}
                onClick={() => {
                  if (isRecording) {
                    stopRecording();
                  } else {
                    startRecording();
                  }
                }}
                disabled={isLoading}
              >
                {isRecording ? (
                  <Square className="h-6 w-6 text-white" />
                ) : (
                  <Circle className="h-6 w-6 text-white fill-current" />
                )}
              </button>
            )}
            
            <button
              type="button"
              className="bg-white rounded-full p-3 shadow-lg focus:outline-none focus:ring-2 focus:ring-primary"
              onClick={() => switchCameraMode(null)}
            >
              <X className="h-6 w-6 text-destructive" />
            </button>
          </div>
        </div>
      )}
      
      {/* Camera mode selection buttons */}
      {cameraMode === null && (
        <div className="grid grid-cols-2 gap-4">
          <Button 
            variant="outline"
            size="lg"
            className="flex flex-col items-center justify-center h-24 py-2"
            onClick={() => switchCameraMode('image')} // Always start in image mode, toggle happens in camera
            disabled={isLoading || media.length >= maxItems}
          >
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-1">
              <CameraIcon className="h-6 w-6 text-primary" />
            </div>
            <span className="text-sm font-medium">
              Camera
            </span>
          </Button>
          
          <Button 
            variant="outline"
            size="lg"
            className="flex flex-col items-center justify-center h-24 py-2"
            onClick={() => {
              // Decide which file input to show based on current uploadType
              if (uploadType === 'image') {
                fileInputRef.current?.click();
              } else {
                // Show the time limit notification when using video
                toast({
                  title: "Video length limit",
                  description: `Videos must be ${MAX_RECORDING_TIME / 60} minutes or less.`
                });
                videoInputRef.current?.click();
              }
            }}
            disabled={isLoading || media.length >= maxItems}
          >
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-1">
              <Upload className="h-6 w-6 text-primary" />
            </div>
            <span className="text-sm font-medium">
              Upload File
            </span>
          </Button>
          
          {/* Photo/Video toggle for upload mode */}
          <div className="mt-4 flex justify-center">
            <div className="bg-muted inline-flex rounded-lg p-1">
              <button
                type="button"
                className={`px-3 py-1 rounded-md text-sm flex items-center ${uploadType === 'image' ? 'bg-white shadow' : 'text-muted-foreground'}`}
                onClick={() => setUploadType('image')}
              >
                <CameraIcon className="h-4 w-4 mr-2" />
                Photo
              </button>
              <button
                type="button"
                className={`px-3 py-1 rounded-md text-sm flex items-center ${uploadType === 'video' ? 'bg-white shadow' : 'text-muted-foreground'}`}
                onClick={() => {
                  setUploadType('video');
                  toast({
                    title: "Video length limit",
                    description: `Videos must be ${MAX_RECORDING_TIME / 60} minutes or less.`
                  });
                }}
              >
                <Video className="h-4 w-4 mr-2" />
                Video
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Media gallery */}
      {media.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 mt-6">
          {media.map((item, index) => (
            <Card key={item.id} className="overflow-hidden">
              <CardContent className="p-2 relative">
                {item.type === 'image' ? (
                  <div className="relative w-full aspect-square rounded-md bg-gray-100">
                    <img 
                      src={item.thumbnailUrl || item.url} 
                      alt={`Captured ${index + 1}`} 
                      className="w-full h-full object-cover rounded-md"
                      onError={(e) => {
                        const imgElement = e.currentTarget;
                        // First try: If not a full URL, add origin
                        if (!imgElement.src.startsWith('http') && !imgElement.src.startsWith('blob:') && !imgElement.src.startsWith('data:')) {
                          imgElement.src = window.location.origin + imgElement.src;
                        } 
                        // Second try: If thumbnailUrl failed, try the main URL
                        else if (item.thumbnailUrl && imgElement.src === item.thumbnailUrl) {
                          imgElement.src = item.url;
                        }
                        // Final fallback: Show error state
                        else {
                          imgElement.style.display = 'none';
                          const parent = imgElement.parentElement;
                          if (parent) {
                            const errorDiv = document.createElement('div');
                            errorDiv.className = 'absolute inset-0 flex items-center justify-center bg-gray-200 rounded-md';
                            errorDiv.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" class="h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>';
                            parent.appendChild(errorDiv);
                          }
                        }
                      }}
                    />
                  </div>
                ) : (
                  <div className="relative bg-black rounded-md aspect-video flex items-center justify-center overflow-hidden">
                    {/* Video thumbnail overlay (shown until play) */}
                    <div className="absolute inset-0 bg-gray-900 flex items-center justify-center">
                      <Video className="h-12 w-12 text-white opacity-70" />
                    </div>
                    
                    <video 
                      src={item.url} 
                      className="w-full h-full object-contain"
                      controls
                      preload="metadata"
                      poster={item.thumbnailUrl}
                      onLoadedData={(e) => {
                        // When video is loaded, hide the thumbnail overlay
                        const videoElement = e.currentTarget;
                        const parent = videoElement.parentElement;
                        if (parent) {
                          const overlay = parent.querySelector('div.absolute') as HTMLElement;
                          if (overlay) {
                            overlay.style.opacity = '0';
                            overlay.style.pointerEvents = 'none';
                          }
                        }
                      }}
                      onError={(e) => {
                        const videoElement = e.currentTarget;
                        // First try: add origin if not a full URL
                        if (!videoElement.src.startsWith('http') && !videoElement.src.startsWith('blob:') && !videoElement.src.startsWith('data:')) {
                          videoElement.src = window.location.origin + videoElement.src;
                        } 
                        // Final fallback: Show error state
                        else {
                          videoElement.style.display = 'none';
                          const parent = videoElement.parentElement;
                          if (parent) {
                            // Update the overlay to show error
                            const overlay = parent.querySelector('div.absolute') as HTMLElement;
                            if (overlay) {
                              overlay.innerHTML = '<div class="text-white text-center p-2"><svg xmlns="http://www.w3.org/2000/svg" class="h-12 w-12 mx-auto text-white opacity-70" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg><p class="text-xs mt-2">Video unavailable</p></div>';
                            }
                          }
                        }
                      }}
                    />
                  </div>
                )}
                
                <Button 
                  variant="destructive" 
                  size="icon" 
                  className="absolute -top-2 -right-2 h-6 w-6 rounded-full shadow-md"
                  onClick={() => handleRemoveMedia(index)}
                >
                  <X className="h-3 w-3" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      
      {!cameraSupported && (
        <div className="mt-4 bg-yellow-50 p-3 rounded-md flex items-start">
          <AlertCircle className="h-5 w-5 text-yellow-500 mr-2 shrink-0 mt-0.5" />
          <div className="text-sm text-yellow-700">
            <strong>Camera not available.</strong> Your device either doesn't support camera access, or permissions were denied. 
            You can use the upload buttons instead.
          </div>
        </div>
      )}
    </div>
  );
}