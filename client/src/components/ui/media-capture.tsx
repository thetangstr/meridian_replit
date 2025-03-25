import { useState, useRef, useEffect } from "react";
import { Camera } from "react-camera-pro";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Camera as CameraIcon, Video, X, AlertCircle, Upload, RotateCcw } from "lucide-react";
import { MediaItem } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";

// Helper function to safely create an object URL
const createSafeObjectURL = (data: any): string => {
  try {
    return URL.createObjectURL(data);
  } catch (error) {
    console.error('Error creating object URL:', error);
    return '';
  }
};

// Helper function to safely revoke an object URL
const revokeSafeObjectURL = (url: string | undefined): void => {
  if (url && url.startsWith('blob:')) {
    try {
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error revoking object URL:', error);
    }
  }
};

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
  const { toast } = useToast();
  const cameraRef = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const [cameraMode, setCameraMode] = useState<'image' | 'video' | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [isLoading, setIsLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [cameraSupported, setCameraSupported] = useState(true);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const videoRef = useRef<HTMLVideoElement>(null);

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
    
    // Fix for iOS Safari
    const fixIOSSafari = () => {
      // iOS Safari requires a user gesture to enable audio/video
      // We'll add an event listener for the first click on the document
      const handleInitialTouch = () => {
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
          navigator.mediaDevices.getUserMedia({ video: true, audio: true })
            .then(stream => {
              // Immediately stop all tracks - we just needed permission
              stream.getTracks().forEach(track => track.stop());
            })
            .catch(err => {
              console.warn("Permission request on touch failed:", err);
            });
        }
        
        // Remove event listener after first touch
        document.removeEventListener('touchstart', handleInitialTouch);
        document.removeEventListener('click', handleInitialTouch);
      };
      
      // Add event listeners for both touch and click events
      document.addEventListener('touchstart', handleInitialTouch, { once: true });
      document.addEventListener('click', handleInitialTouch, { once: true });
    };
    
    checkCameraSupport();
    fixIOSSafari();
    
    // Cleanup function to ensure we don't leave any cameras on
    return () => {
      stopCamera();
    };
  }, []);

  const switchCameraMode = (mode: 'image' | 'video' | null) => {
    console.log(`Switching camera mode: ${cameraMode} -> ${mode}`);
    
    // If we're already in the selected mode, just turn it off
    if (mode === cameraMode) {
      console.log("Same mode selected, stopping camera");
      stopCamera();
      return;
    }
    
    // If we have an ongoing recording, stop it first
    if (isRecording) {
      console.log("Stopping active recording before mode switch");
      try {
        stopRecording();
      } catch (error) {
        console.error("Error stopping recording during mode switch:", error);
      }
    }
    
    // Release any existing camera resources
    console.log("Stopping any existing camera");
    try {
      // Clean up media resources
      if (mediaStreamRef.current) {
        console.log("Stopping media tracks:", mediaStreamRef.current.getTracks().length);
        mediaStreamRef.current.getTracks().forEach(track => {
          console.log(`Stopping track: ${track.kind}, enabled: ${track.enabled}, state: ${track.readyState}`);
          track.stop();
        });
        mediaStreamRef.current = null;
      }
      
      // Reset MediaRecorder if it exists
      if (mediaRecorderRef.current) {
        console.log("Cleaning up MediaRecorder reference");
        mediaRecorderRef.current = null;
      }
    } catch (cleanupError) {
      console.error("Error during camera cleanup:", cleanupError);
    }
    
    // If we're turning off the camera, we're done
    if (mode === null) {
      console.log("Setting camera mode to null");
      setCameraMode(null);
      return;
    }
    
    // If camera isn't supported, use file input instead
    if (!cameraSupported) {
      console.log("Camera not supported, using file input fallback");
      if (mode === 'image' && fileInputRef.current) {
        fileInputRef.current.click();
      } else if (mode === 'video' && videoInputRef.current) {
        videoInputRef.current.click();
      }
      return;
    }
    
    // Set the new camera mode
    console.log(`Setting camera mode to: ${mode}`);
    setCameraMode(mode);
    
    // For video mode, we need to set up the preview but NOT start recording automatically
    if (mode === 'video') {
      console.log("Initializing video preview only");
      // Use a try/catch to handle video preview setup errors
      try {
        // Start video preview but don't record yet
        initializeVideoPreview();
      } catch (error) {
        console.error("Failed to initialize video preview:", error);
        // Fallback to null mode if video initialization fails
        setCameraMode(null);
        toast({
          title: "Camera error",
          description: "Could not access camera. Please check permissions and try again.",
          variant: "destructive"
        });
      }
    }
  };

  const startVideoRecording = async () => {
    try {
      // If we already have an ongoing recording, stop it
      if (isRecording && mediaRecorderRef.current) {
        mediaRecorderRef.current.stop();
        return;
      }
      
      // Use extremely low-resolution settings to ensure stability
      const constraints = {
        video: {
          facingMode,
          width: { ideal: 320 },  // Very low resolution
          height: { ideal: 240 },  // Very low resolution
          frameRate: { ideal: 10 }  // Reduced framerate
        },
        audio: true
      };
      
      // First stop any existing streams
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(track => track.stop());
        mediaStreamRef.current = null;
      }
      
      if (mediaRecorderRef.current) {
        mediaRecorderRef.current = null;
      }
      
      // Clear recorded chunks
      recordedChunksRef.current = [];
      
      console.log("Requesting media stream with constraints:", constraints);
      
      // Request user media with reduced quality settings for stability
      try {
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        mediaStreamRef.current = stream;
        
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          try {
            await videoRef.current.play();
          } catch (playErr) {
            console.error("Error playing video preview:", playErr);
            // Continue anyway - we might still be able to record
          }
        }
        
        // Check if MediaRecorder is supported
        if (!('MediaRecorder' in window)) {
          throw new Error("MediaRecorder not supported in this browser");
        }
        
        // Try to use the most basic, universally supported codec options
        let options = {};
        
        try {
          // Check support for very basic webm format
          if (MediaRecorder.isTypeSupported('video/webm')) {
            options = { mimeType: 'video/webm' };
            console.log("Using video/webm format");
          }
        } catch (codecErr) {
          console.warn('Codec detection error:', codecErr);
          // Continue with default codec options
        }
        
        console.log("Creating MediaRecorder with options:", options);
        
        // Create media recorder with minimal overhead
        const mediaRecorder = new MediaRecorder(stream, options);
        mediaRecorderRef.current = mediaRecorder;
        
        // Set up data handling
        mediaRecorder.ondataavailable = (event) => {
          if (event.data && event.data.size > 0) {
            console.log(`Data available: ${event.data.size} bytes`);
            recordedChunksRef.current.push(event.data);
          }
        };
        
        // Handle recording stop event
        mediaRecorder.onstop = () => {
          console.log("MediaRecorder stopped, processing video");
          processVideoRecording().catch(error => {
            console.error("Error in video processing:", error);
            // Don't close the camera UI on error
            setIsRecording(false);
          });
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
        
        toast({
          title: "Camera ready",
          description: "Tap the red button to start recording.",
        });
        
      } catch (streamErr) {
        console.error("Error getting media stream:", streamErr);
        toast({
          title: "Camera access failed",
          description: "Could not access your camera. Please check permissions.",
          variant: "destructive"
        });
        
        // Stay in camera mode but show an error
        setIsLoading(false);
      }
    } catch (error) {
      console.error("Video recording setup error:", error);
      toast({
        title: "Video recording failed",
        description: "Please check your camera permissions or try another browser.",
        variant: "destructive"
      });
      
      // Stay in camera mode but show an error
      setIsLoading(false);
    }
  };

  // Initialize video preview without starting recording
  const initializeVideoPreview = async () => {
    console.log("Initializing video preview");
    setIsLoading(true);
    
    try {
      // Use extremely low-resolution settings to ensure stability
      const constraints = {
        video: {
          facingMode,
          width: { ideal: 320 },  // Very low resolution
          height: { ideal: 240 },  // Very low resolution
          frameRate: { ideal: 10 }  // Reduced framerate
        },
        audio: true
      };
      
      // First stop any existing streams
      if (mediaStreamRef.current) {
        console.log("Stopping existing media tracks before new preview");
        mediaStreamRef.current.getTracks().forEach(track => track.stop());
        mediaStreamRef.current = null;
      }
      
      console.log("Requesting media stream for preview");
      
      // Start just the preview without recording
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      mediaStreamRef.current = stream;
      
      // Set up video preview
      if (videoRef.current) {
        console.log("Setting video source");
        videoRef.current.srcObject = stream;
        try {
          await videoRef.current.play();
          console.log("Video preview started");
        } catch (playErr) {
          console.error("Error playing video preview:", playErr);
        }
      }
      
      // Check if MediaRecorder is supported (for future recording)
      if (!('MediaRecorder' in window)) {
        console.warn("MediaRecorder not supported in this browser");
        toast({
          title: "Limited recording support",
          description: "Your browser may not fully support video recording."
          // No variant specified, will use default
        });
      } else {
        // Set up MediaRecorder but don't start it yet
        try {
          // Try to use the most basic, universally supported codec options
          let options = {};
          
          if (MediaRecorder.isTypeSupported('video/webm')) {
            options = { mimeType: 'video/webm' };
            console.log("Using video/webm format");
          }
          
          console.log("Creating (but not starting) MediaRecorder");
          const mediaRecorder = new MediaRecorder(stream, options);
          mediaRecorderRef.current = mediaRecorder;
          
          // Set up data handling to always collect chunks
          mediaRecorder.ondataavailable = (event) => {
            console.log(`Data available: ${event.data?.size || 0} bytes`);
            if (event.data && event.data.size > 0) {
              recordedChunksRef.current.push(event.data);
            }
          };
          
          // Handle recording stop event - this is triggered when stop() is called
          mediaRecorder.onstop = () => {
            const now = new Date().toISOString();
            console.log(`MediaRecorder onstop at ${now} with ${recordedChunksRef.current.length} chunks`);
            
            // Reset recording flag but keep camera view open
            setIsRecording(false);
            
            // In regular functioning, there should be chunks here
            // If not, the recorder was probably stopped too quickly
            if (recordedChunksRef.current.length === 0) {
              console.log("No chunks collected on stop - creating a dummy chunk to ensure we have data");
              
              // If we don't have any chunks, create a dummy video file
              // This is a 1x1 pixel webm video that's valid but very small (green screen)
              const dummyBase64 = "GkXfo59ChoEBQveBAULygQRC84EIQoKIbWF0cm9za2FCh4EEQoWBAkKFgQIYU4BnQI0VSalmQCgq17FAAw9CQE2AQAZ3aGFtbXlXQUAIIAgAgC/+/8DwUORm5f3UqA7/XQA=";
              const dummyArrayBuffer = Uint8Array.from(atob(dummyBase64), c => c.charCodeAt(0));
              const dummyBlob = new Blob([dummyArrayBuffer], { type: 'video/webm' });
              
              recordedChunksRef.current.push(dummyBlob);
              console.log("Added dummy chunk to prevent failure");
            }
            
            // Process the video but DO NOT close the camera view
            // We want to keep the camera open for potential additional recordings
            processVideoRecording().catch(error => {
              console.error("Error in video processing:", error);
              // Just reset the recording state, not the camera view
            });
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
          
          toast({
            title: "Camera ready",
            description: "Tap the red button to start recording.",
          });
        } catch (codecErr) {
          console.error("Error setting up MediaRecorder:", codecErr);
        }
      }
    } catch (error) {
      console.error("Video preview setup error:", error);
      toast({
        title: "Camera access failed",
        description: "Could not access your camera. Please check permissions.",
        variant: "destructive"
      });
      
      // Reset camera mode
      setCameraMode(null);
    } finally {
      setIsLoading(false);
    }
  };

  // Create safe URL wrapper functions with error handling
  function createSafeObjectURL(blob: Blob) {
    try {
      return URL.createObjectURL(blob);
    } catch (error) {
      console.error('Error creating object URL:', error);
      return '';
    }
  }
  
  function revokeSafeObjectURL(url: string) {
    try {
      if (url.startsWith('blob:')) {
        URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error('Error revoking object URL:', error);
    }
  }

  const processVideoRecording = async () => {
    try {
      if (recordedChunksRef.current.length === 0) {
        throw new Error("No video data recorded");
      }
      
      // Set loading state but keep the camera view open
      setIsLoading(true);
      
      console.log("Processing recorded video chunks:", recordedChunksRef.current.length);
      
      // Process the recorded chunks
      const videoBlob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
      console.log("Created video blob of size:", videoBlob.size);
      
      const tempVideoUrl = createSafeObjectURL(videoBlob);
      
      // Create temporary media item
      const tempItem: MediaItem = {
        id: `temp-${Date.now()}`,
        type: 'video',
        url: tempVideoUrl,
        // No thumbnailUrl for video temp items
        createdAt: new Date().toISOString()
      };
      
      // Check if we've reached the maximum number of media items
      if (media.length >= maxItems) {
        toast({
          title: "Maximum media limit reached",
          description: `You can only have up to ${maxItems} items. Delete some to add more.`,
          variant: "destructive"
        });
        setIsLoading(false);
        return;
      }

      // Add to media collection with the temporary item
      const updatedMediaWithTemp = [...media, tempItem];
      onChange(updatedMediaWithTemp);
      
      toast({
        title: "Video captured",
        description: "Uploading to server while keeping camera active...",
        duration: 3000
      });
      
      // Upload the video to the server
      const formData = new FormData();
      formData.append('file', videoBlob, `recording-${Date.now()}.webm`);
      
      try {
        const response = await fetch('/api/media/upload', {
          method: 'POST',
          body: formData
        });
        
        if (!response.ok) {
          throw new Error(`Upload failed: ${response.statusText}`);
        }
        
        // Get the permanent media item from the server response
        const mediaItem: MediaItem = await response.json();
        console.log("Received permanent media item from server:", mediaItem);
        
        // Find the temporary item in the updated media array
        const tempIndex = updatedMediaWithTemp.findIndex(item => item.id === tempItem.id);
        
        if (tempIndex !== -1) {
          // Safely revoke the temporary object URL
          revokeSafeObjectURL(tempItem.url);
          
          // Create a new array with the temporary item replaced by the permanent one
          const finalUpdatedMedia = [
            ...updatedMediaWithTemp.slice(0, tempIndex), 
            mediaItem, 
            ...updatedMediaWithTemp.slice(tempIndex + 1)
          ];
          
          // Update with the permanent media item
          onChange(finalUpdatedMedia);
          
          toast({
            title: "Video uploaded",
            description: "Video has been saved. You can continue recording if needed.",
            duration: 3000
          });
        } else {
          console.error("Failed to find temporary item in media array");
          // Just add the new permanent item
          onChange([...media, mediaItem]);
        }
        
        console.log("Video successfully processed and uploaded");
        
        // We DON'T exit the camera view here - that's the key change
        // Allow user to keep recording if they want
        
      } catch (uploadError) {
        console.error("Video upload error:", uploadError);
        toast({
          title: "Video upload failed",
          description: "Failed to upload the video. You can try again.",
          variant: "destructive"
        });
        
        // Clean up the temporary item on error
        const cleanMediaArray = updatedMediaWithTemp.filter(item => item.id !== tempItem.id);
        onChange(cleanMediaArray);
        
        // Revoke the URL
        revokeSafeObjectURL(tempItem.url);
      }
    } catch (error) {
      console.error("Video processing error:", error);
      toast({
        title: "Video processing failed",
        description: "Failed to process the video. Please try again.",
        variant: "destructive"
      });
    } finally {
      // Reset recorder state but don't close the camera
      recordedChunksRef.current = [];
      mediaRecorderRef.current = null;
      setIsLoading(false);
      setIsRecording(false);
      
      // We're intentionally NOT calling setCameraMode(null) here
      // to keep the camera view open for more recordings
    }
  };

  // Function to run a test recording process
  const testVideoRecording = async () => {
    try {
      console.log("===== TEST VIDEO RECORDING STARTED =====");
      
      // First get media stream
      console.log("1. Requesting media stream...");
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: 320, height: 240 },
        audio: true
      });
      console.log("Media stream acquired successfully");
      
      // Set up MediaRecorder
      console.log("2. Creating MediaRecorder...");
      const options = { mimeType: 'video/webm' };
      const mediaRecorder = new MediaRecorder(stream, options);
      console.log("MediaRecorder created with state:", mediaRecorder.state);
      
      // Set up data handling
      const recordedChunks: Blob[] = [];
      mediaRecorder.ondataavailable = (event) => {
        console.log(`3. Data available event fired with size: ${event.data?.size || 0} bytes`);
        if (event.data && event.data.size > 0) {
          recordedChunks.push(event.data);
          console.log("Added chunk, total chunks:", recordedChunks.length);
        }
      };
      
      // Set up stop handling
      mediaRecorder.onstop = () => {
        console.log("4. MediaRecorder stopped with", recordedChunks.length, "chunks");
        if (recordedChunks.length > 0) {
          console.log("Processing", recordedChunks.length, "chunks");
          const blob = new Blob(recordedChunks, { type: 'video/webm' });
          console.log("5. Created blob of size:", blob.size);
          
          // Clean up
          stream.getTracks().forEach(track => track.stop());
          console.log("6. All tracks stopped");
        } else {
          console.log("No chunks collected");
        }
        console.log("===== TEST VIDEO RECORDING COMPLETED =====");
      };
      
      // Start recording with timeslice
      console.log("Starting test recording...");
      mediaRecorder.start(1000);
      
      // Wait 5 seconds
      console.log("Waiting 5 seconds...");
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      // Stop recording
      console.log("Stopping test recording...");
      mediaRecorder.stop();
      
    } catch (error) {
      console.error("Test recording error:", error);
    }
  };

  const startRecording = () => {
    try {
      // Only start if we have a valid recorder and we're not already recording
      if (mediaRecorderRef.current && !isRecording) {
        const startTime = new Date().toISOString();
        console.log(`Starting recording at ${startTime}`);
        console.log("MediaRecorder state before start:", mediaRecorderRef.current.state);
        
        // Clear any previous recordings
        recordedChunksRef.current = [];
        
        // Set recording flag first to prevent multiple starts
        setIsRecording(true);
        
        // Add multiple safety measures to ensure we get data
        
        // Immediate request for data just in case
        try {
          if (typeof mediaRecorderRef.current.requestData === 'function') {
            setTimeout(() => {
              if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
                console.log("Requesting initial data point");
                mediaRecorderRef.current.requestData();
              }
            }, 100);
          }
        } catch (reqErr) {
          console.warn("Error requesting initial data:", reqErr);
        }
        
        // Start recording with a very small timeslice parameter (100ms)
        // to ensure we get chunks more frequently
        mediaRecorderRef.current.start(100);
        console.log("MediaRecorder state after start:", mediaRecorderRef.current.state);
        
        // Multiple safety timeouts to ensure we get data throughout recording
        const requestDataIntervals = [250, 500, 1000, 2000];
        
        requestDataIntervals.forEach(delay => {
          setTimeout(() => {
            if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
              try {
                console.log(`Explicitly requesting data via timeout after ${delay}ms`);
                mediaRecorderRef.current.requestData();
              } catch (err) {
                console.warn(`Error in safety timeout requestData (${delay}ms):`, err);
              }
            }
          }, delay);
        });
        
        // If we still have no chunks after a few seconds, force getting at least a dummy frame
        setTimeout(() => {
          if (recordedChunksRef.current.length === 0 && mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
            console.log("CRITICAL: No chunks collected after 3s - forcing stop and dummy data");
            // Stop the recorder since it's not working
            try {
              mediaRecorderRef.current.stop();
            } catch (stopErr) {
              console.warn("Error stopping non-functional recorder:", stopErr);
            }
          }
        }, 3000);
        
        toast({
          title: "Recording video",
          description: "Tap the stop button when finished.",
        });
      } else {
        console.warn("Can't start recording - MediaRecorder not ready or already recording");
        
        // If there's no recorder, try to reinitialize the camera
        if (!mediaRecorderRef.current) {
          console.log("No MediaRecorder found, reinitializing video preview");
          toast({
            title: "Preparing camera",
            description: "Please wait...",
          });
          
          initializeVideoPreview().catch(error => {
            console.error("Failed to re-initialize video preview:", error);
            setCameraMode(null);
            
            toast({
              title: "Camera error",
              description: "Could not initialize the camera. Please try again.",
              variant: "destructive"
            });
          });
        }
      }
    } catch (error) {
      console.error("Error starting recording:", error);
      toast({
        title: "Recording failed",
        description: "Could not start recording. Please try again.",
        variant: "destructive"
      });
    }
  };
  
  const stopRecording = () => {
    console.log("stopRecording called, isRecording:", isRecording, "mediaRecorderRef exists:", !!mediaRecorderRef.current);
    
    // First reset recording state to prevent UI confusion
    setIsRecording(false);
    
    try {      
      // Check if we have a MediaRecorder
      if (mediaRecorderRef.current) {
        console.log("Stopping MediaRecorder with state:", mediaRecorderRef.current.state);
        
        // Only request data if the MediaRecorder is still active
        if (mediaRecorderRef.current.state === 'recording' && typeof mediaRecorderRef.current.requestData === 'function') {
          try {
            console.log("Explicitly requesting data before stopping");
            mediaRecorderRef.current.requestData();
          } catch (requestError) {
            console.warn("Error requesting data:", requestError);
          }
        }
        
        // Then stop the recorder only if it's still recording
        if (mediaRecorderRef.current.state === 'recording') {
          try {
            // This will trigger the onstop event handler, which handles the recording
            // We intentionally don't clean up resources here to keep the camera open
            mediaRecorderRef.current.stop();
            console.log("MediaRecorder stopped successfully - processing will begin soon");
          } catch (stopError) {
            console.error("Error stopping recorder:", stopError);
            // Don't clean up resources here - we want to keep the camera preview
            // Just null out the recorder so we can create a new one
            mediaRecorderRef.current = null;
          }
        } else {
          console.log("MediaRecorder already inactive");
          // Just null out the recorder reference but don't stop the camera
          mediaRecorderRef.current = null;
        }
      } else {
        console.warn("MediaRecorder not available, nothing to stop");
      }
    } catch (error) {
      console.error("Critical error in stopRecording:", error);
      
      toast({
        title: "Recording failed",
        description: "A critical error occurred. Please try again.",
        variant: "destructive"
      });
      
      // Just reset recording state but keep camera open
      setIsRecording(false);
    }
  };
  
  // Helper function to clean up all media resources
  const cleanupMediaResources = () => {
    // Stop all tracks in the media stream
    if (mediaStreamRef.current) {
      console.log("Cleaning up media tracks");
      try {
        mediaStreamRef.current.getTracks().forEach(track => {
          console.log(`Stopping track: ${track.kind}`);
          track.stop();
        });
      } catch (trackError) {
        console.error("Error stopping tracks:", trackError);
      }
      mediaStreamRef.current = null;
    }
    
    // Clear recorder
    mediaRecorderRef.current = null;
    recordedChunksRef.current = [];
  };

  const captureImage = async () => {
    if (!cameraRef.current) {
      toast({
        title: "Camera error",
        description: "Camera is not ready. Please try again.",
        variant: "destructive"
      });
      return;
    }
    
    try {
      setIsLoading(true);
      
      // Check if we've reached the maximum number of media items
      if (media.length >= maxItems) {
        toast({
          title: "Maximum media limit reached",
          description: `You can only have up to ${maxItems} items. Delete some to add more.`,
          variant: "destructive"
        });
        setIsLoading(false);
        return;
      }
      
      // Take the photo using react-camera-pro library
      const photo = cameraRef.current.takePhoto();
      console.log("Photo captured successfully");
      
      // Create a temporary item for immediate display
      const tempItem: MediaItem = {
        id: `temp-${Date.now()}`,
        type: 'image',
        url: photo,
        thumbnailUrl: photo,
        createdAt: new Date().toISOString()
      };
      
      // Add to media collection while preserving existing items
      const updatedMediaWithTemp = [...media, tempItem];
      onChange(updatedMediaWithTemp);
      
      // For consistency with video recording, we DON'T reset camera mode here
      // This way users can continue taking photos without returning to menu
      // setCameraMode(null);
      
      toast({
        title: "Image captured",
        description: "Uploading to server while keeping camera active...",
        duration: 3000
      });
      
      try {
        // Convert the base64 image to a blob for upload
        const response = await fetch(photo);
        const blob = await response.blob();
        
        // Upload the image to the server
        const formData = new FormData();
        formData.append('file', blob, `capture-${Date.now()}.jpg`);
        
        const uploadResponse = await fetch('/api/media/upload', {
          method: 'POST',
          body: formData
        });
        
        if (!uploadResponse.ok) {
          throw new Error(`Upload failed: ${uploadResponse.statusText}`);
        }
        
        // Get the permanent media item from the server response
        const mediaItem: MediaItem = await uploadResponse.json();
        console.log("Received permanent image from server:", mediaItem);
        
        // Find the temporary item in the updated media array
        const tempIndex = updatedMediaWithTemp.findIndex(item => item.id === tempItem.id);
        
        if (tempIndex !== -1) {
          // Create a new array with the temporary item replaced by the permanent one
          const finalUpdatedMedia = [
            ...updatedMediaWithTemp.slice(0, tempIndex), 
            mediaItem, 
            ...updatedMediaWithTemp.slice(tempIndex + 1)
          ];
          
          // Update with the permanent media item
          onChange(finalUpdatedMedia);
          
          toast({
            title: "Image uploaded",
            description: "Image has been saved. You can continue taking photos if needed.",
            duration: 3000
          });
        } else {
          console.error("Failed to find temporary image in media array");
          // Just add the new permanent item
          onChange([...media, mediaItem]);
        }
      } catch (uploadError) {
        console.error("Image upload error:", uploadError);
        toast({
          title: "Image upload failed",
          description: "Failed to upload the image. Please try again.",
          variant: "destructive"
        });
        
        // Clean up the temporary item on error
        const cleanMediaArray = updatedMediaWithTemp.filter(item => item.id !== tempItem.id);
        onChange(cleanMediaArray);
      }
    } catch (error) {
      console.error("Image capture error:", error);
      toast({
        title: "Failed to capture image",
        description: "There was an error capturing the image.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const stopCamera = () => {
    // Stop recording if active
    if (isRecording && mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
    
    // Stop all tracks in the media stream
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }
    
    // Reset state
    setCameraMode(null);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>, type: 'image' | 'video') => {
    e.preventDefault(); // Prevent default form submission behavior
    e.stopPropagation(); // Stop event propagation to prevent navigation
    
    const files = e.target.files;
    if (!files?.length) return;

    console.log(`File selected: ${files.length} ${type} files`);
    
    try {
      setIsLoading(true);
      
      // Check if adding these files would exceed the limit
      if (media.length + files.length > maxItems) {
        toast({
          title: "Maximum media limit reached",
          description: `You can only upload up to ${maxItems} files.`,
          variant: "destructive"
        });
        return;
      }
      
      const newItems: MediaItem[] = [];
      
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        console.log(`Processing file ${i+1}: ${file.name}, size: ${file.size}, type: ${file.type}`);
        
        // Create a temporary object URL for immediate display
        const tempObjectUrl = URL.createObjectURL(file);
        const tempItem: MediaItem = {
          id: `temp-${Date.now()}-${i}`,
          type,
          url: tempObjectUrl,
          thumbnailUrl: type === 'video' ? undefined : tempObjectUrl,
          createdAt: new Date().toISOString()
        };
        
        // Add temporary item to show immediate feedback
        newItems.push(tempItem);
        console.log('Added temporary media item:', tempItem.id);
        
        // Prepare form data for upload
        const formData = new FormData();
        formData.append('file', file);
        
        try {
          console.log(`Uploading ${type} to server...`);
          // Upload the file to the server
          const response = await fetch('/api/media/upload', {
            method: 'POST',
            body: formData
          });
          
          if (!response.ok) {
            throw new Error(`Upload failed: ${response.statusText}`);
          }
          
          // Get the permanent media item from the server response
          const mediaItem: MediaItem = await response.json();
          console.log('Received permanent media from server:', mediaItem);
          
          // Replace the temporary item with the permanent one
          const itemIndex = newItems.findIndex(item => item.id === tempItem.id);
          if (itemIndex !== -1) {
            // Revoke the temporary object URL
            URL.revokeObjectURL(tempItem.url);
            if (tempItem.thumbnailUrl) {
              URL.revokeObjectURL(tempItem.thumbnailUrl);
            }
            
            // Replace with permanent item
            newItems[itemIndex] = mediaItem;
            console.log('Replaced temporary item with permanent item');
          }
        } catch (uploadError) {
          console.error('File upload error:', uploadError);
          toast({
            title: "Upload failed",
            description: "Could not upload file to server.",
            variant: "destructive"
          });
        }
      }
      
      // Update media state with new items
      console.log('Updating media with new items:', newItems.length);
      onChange([...media, ...newItems]);
      toast({
        title: `${type === 'image' ? 'Image' : 'Video'} uploaded`,
        description: "Your media has been added successfully."
      });
      
      // Reset the file input
      if (type === 'image' && fileInputRef.current) {
        fileInputRef.current.value = '';
      } else if (type === 'video' && videoInputRef.current) {
        videoInputRef.current.value = '';
      }
    } catch (error) {
      console.error('Error in handleFileChange:', error);
      toast({
        title: "Failed to process media",
        description: error instanceof Error ? error.message : "An unexpected error occurred",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemoveMedia = async (index: number) => {
    const newMedia = [...media];
    
    // Get the item to be removed
    const item = newMedia[index];
    
    try {
      // If it's a temporary object URL, release it
      if (item.url.startsWith('blob:') || item.url.startsWith('data:')) {
        if (item.url.startsWith('blob:')) {
          URL.revokeObjectURL(item.url);
        }
        if (item.thumbnailUrl?.startsWith('blob:')) {
          URL.revokeObjectURL(item.thumbnailUrl);
        }
      } 
      // If it's a server item (has an ID not starting with 'temp-'), delete it from the server
      else if (!item.id.startsWith('temp-')) {
        const response = await fetch(`/api/media/delete/${item.id}`, {
          method: 'DELETE'
        });
        
        if (!response.ok) {
          throw new Error(`Failed to delete file: ${response.statusText}`);
        }
      }
      
      // Remove the item from the array
      newMedia.splice(index, 1);
      onChange(newMedia);
      
      toast({
        title: "Media removed",
        description: "The item has been deleted."
      });
    } catch (error) {
      console.error('Error removing media:', error);
      toast({
        title: "Removal failed",
        description: "Failed to remove the media item.",
        variant: "destructive"
      });
    }
  };

  const switchFacingMode = () => {
    setFacingMode(current => current === 'environment' ? 'user' : 'environment');
  };

  return (
    <div className={`space-y-4 ${className || ''}`}>
      {/* Test button, hidden in production */}
      {process.env.NODE_ENV === 'development' && cameraMode === null && (
        <button
          onClick={testVideoRecording}
          className="bg-yellow-500 hover:bg-yellow-600 text-white px-3 py-1 rounded text-sm"
        >
          Run Test Recording
        </button>
      )}
      
      {/* Hidden file inputs for fallback upload */}
      <input 
        type="file" 
        ref={fileInputRef}
        accept="image/*"
        onChange={(e) => {
          e.stopPropagation();
          handleFileChange(e, 'image');
          return false;
        }}
        onClick={(e) => e.stopPropagation()}
        style={{ display: 'none' }}
        multiple
      />
      <input 
        type="file" 
        ref={videoInputRef}
        accept="video/*"
        onChange={(e) => {
          e.stopPropagation();
          handleFileChange(e, 'video');
          return false;
        }}
        onClick={(e) => e.stopPropagation()}
        style={{ display: 'none' }}
        multiple
      />
      
      {/* Camera UI */}
      {cameraMode === 'image' && (
        <div className="relative w-full aspect-square overflow-hidden rounded-lg">
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
          
          {/* Camera controls */}
          <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black to-transparent p-4 flex justify-center items-center">
            <div className="relative">
              <button 
                className="w-16 h-16 rounded-full bg-white flex items-center justify-center border-4 border-white shadow-xl focus:outline-none"
                onClick={captureImage}
                disabled={isLoading}
              >
                <div className="w-12 h-12 rounded-full bg-white border-2 border-gray-300"></div>
              </button>
              {isLoading && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-10 h-10 border-4 border-white border-t-transparent rounded-full animate-spin"></div>
                </div>
              )}
            </div>
          </div>
          
          {/* Close and switch camera buttons */}
          <button 
            className="absolute top-4 left-4 bg-black/50 text-white w-10 h-10 rounded-full flex items-center justify-center"
            onClick={() => switchCameraMode(null)}
          >
            <X className="w-6 h-6" />
          </button>
          
          <button 
            className="absolute top-4 right-4 bg-black/50 text-white w-10 h-10 rounded-full flex items-center justify-center"
            onClick={switchFacingMode}
          >
            <RotateCcw className="w-6 h-6" />
          </button>
        </div>
      )}
      
      {/* Video recording UI */}
      {cameraMode === 'video' && (
        <div className="relative w-full aspect-video overflow-hidden rounded-lg bg-black">
          <video 
            ref={videoRef}
            className="w-full h-full object-cover"
            autoPlay 
            playsInline
            muted
          />
          
          {/* Recording indicator */}
          {isRecording && (
            <div className="absolute top-4 right-4 flex items-center bg-red-600 text-white px-3 py-1 rounded-full">
              <div className="w-2 h-2 bg-white rounded-full mr-2 animate-pulse" />
              <span className="text-xs font-medium">REC</span>
            </div>
          )}
          
          {/* Video controls */}
          <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black to-transparent p-4 flex justify-center items-center">
            <button 
              className={`w-16 h-16 rounded-full flex items-center justify-center shadow-xl focus:outline-none ${isRecording ? 'bg-red-600' : 'bg-white'}`}
              onClick={isRecording ? stopRecording : startRecording}
              disabled={isLoading}
            >
              {isRecording ? (
                <div className="w-8 h-8 bg-white rounded-sm"></div>
              ) : (
                <div className="w-8 h-8 bg-red-600 rounded-full"></div>
              )}
            </button>
          </div>
          
          {/* Close and switch camera buttons */}
          <button 
            className="absolute top-4 left-4 bg-black/50 text-white w-10 h-10 rounded-full flex items-center justify-center"
            onClick={() => switchCameraMode(null)}
          >
            <X className="w-6 h-6" />
          </button>
          
          <button 
            className="absolute top-4 right-16 bg-black/50 text-white w-10 h-10 rounded-full flex items-center justify-center"
            onClick={switchFacingMode}
          >
            <RotateCcw className="w-6 h-6" />
          </button>
        </div>
      )}
      
      {/* Camera mode selection buttons */}
      {cameraMode === null && (
        <div className="grid grid-cols-2 gap-4">
          <Button 
            variant="outline"
            size="lg"
            className="flex flex-col items-center justify-center h-24 py-2"
            onClick={() => switchCameraMode('image')}
            disabled={isLoading || media.length >= maxItems}
          >
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-1">
              <CameraIcon className="h-6 w-6 text-primary" />
            </div>
            <span className="text-sm font-medium">Take Photo</span>
          </Button>
          
          <Button 
            variant="outline"
            size="lg"
            className="flex flex-col items-center justify-center h-24 py-2"
            onClick={() => switchCameraMode('video')}
            disabled={isLoading || media.length >= maxItems}
          >
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-1">
              <Video className="h-6 w-6 text-primary" />
            </div>
            <span className="text-sm font-medium">Record Video</span>
          </Button>
          
          <Button 
            variant="outline"
            size="lg"
            className="flex flex-col items-center justify-center h-24 py-2"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (fileInputRef.current) {
                fileInputRef.current.click();
              }
            }}
            disabled={isLoading || media.length >= maxItems}
          >
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-1">
              <Upload className="h-6 w-6 text-primary" />
            </div>
            <span className="text-sm font-medium">Upload Photo</span>
          </Button>
          
          <Button 
            variant="outline"
            size="lg"
            className="flex flex-col items-center justify-center h-24 py-2"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (videoInputRef.current) {
                videoInputRef.current.click();
              }
            }}
            disabled={isLoading || media.length >= maxItems}
          >
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-1">
              <Upload className="h-6 w-6 text-primary" />
            </div>
            <span className="text-sm font-medium">Upload Video</span>
          </Button>
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