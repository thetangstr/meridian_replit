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
          
          // Set up data handling for future recording
          // Only request data when the recording is stopped, not continuously
          mediaRecorder.ondataavailable = (event) => {
            if (event.data && event.data.size > 0) {
              console.log(`Data available: ${event.data.size} bytes`);
              recordedChunksRef.current.push(event.data);
            }
          };
          
          // Handle recording stop event - this is triggered when stop() is called
          mediaRecorder.onstop = () => {
            console.log("MediaRecorder stopped, processing video");
            // Only process if we actually have some data and are in recording state
            if (recordedChunksRef.current.length > 0 && isRecording) {
              processVideoRecording().catch(error => {
                console.error("Error in video processing:", error);
                setIsRecording(false);
              });
            } else {
              console.log("MediaRecorder stopped but no data collected or not in recording state");
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
      
      // Set loading state
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
        description: "Uploading to server..."
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
            title: "Video captured",
            description: "Video has been saved to the server."
          });
        } else {
          console.error("Failed to find temporary item in media array");
          // Just add the new permanent item
          onChange([...media, mediaItem]);
        }
        
        console.log("Video successfully processed and uploaded, returning to gallery view");
        
        // First stop all media tracks properly
        if (mediaStreamRef.current) {
          console.log("Stopping media tracks after successful upload");
          mediaStreamRef.current.getTracks().forEach(track => {
            console.log(`Stopping track: ${track.kind}`);
            track.stop();
          });
          mediaStreamRef.current = null;
        }
        
        // Then reset camera mode to avoid React state updates during navigation
        console.log("Setting camera mode to null");
        setCameraMode(null);
      } catch (uploadError) {
        console.error("Video upload error:", uploadError);
        toast({
          title: "Video upload failed",
          description: "Failed to upload the video. Please try again.",
          variant: "destructive"
        });
        
        // Clean up the temporary item on error
        const cleanMediaArray = updatedMediaWithTemp.filter(item => item.id !== tempItem.id);
        onChange(cleanMediaArray);
        
        // Revoke the URL
        revokeSafeObjectURL(tempItem.url);
        
        // Don't stop camera on error - just reset the recording state
        setIsRecording(false);
      }
    } catch (error) {
      console.error("Video processing error:", error);
      toast({
        title: "Video processing failed",
        description: "Failed to process the video. Please try again.",
        variant: "destructive"
      });
      
      // Don't stop camera on error - just reset the recording state
      setIsRecording(false);
    } finally {
      // Reset recorder state
      recordedChunksRef.current = [];
      mediaRecorderRef.current = null;
      setIsLoading(false);
    }
  };

  const startRecording = () => {
    try {
      if (mediaRecorderRef.current && !isRecording) {
        console.log("Starting recording with MediaRecorder");
        
        // Make sure recorded chunks are empty before starting a new recording
        recordedChunksRef.current = [];
        
        // Start recording WITHOUT a timeslice parameter, but explicitly request data
        // on stop
        mediaRecorderRef.current.start();
        
        // Explicitly request data when recording stops
        mediaRecorderRef.current.addEventListener('stop', () => {
          console.log("Adding stop event listener to explicitly request data");
          // This ensures data is available even if the browser doesn't automatically trigger it
          if (mediaRecorderRef.current && typeof mediaRecorderRef.current.requestData === 'function') {
            mediaRecorderRef.current.requestData();
          }
        });
        
        // Update UI state
        setIsRecording(true);
        
        toast({
          title: "Recording video",
          description: "Tap the stop button when finished.",
        });
      } else {
        console.warn("Can't start recording - MediaRecorder not ready or already recording");
        if (!mediaRecorderRef.current) {
          // Try to reinitialize video preview instead of auto-recording
          initializeVideoPreview().catch(error => {
            console.error("Failed to re-initialize video preview:", error);
            // On critical error, close camera view
            setCameraMode(null);
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
    
    try {
      // First reset recording state to prevent UI confusion
      setIsRecording(false);
      
      // Then try to properly stop the recording
      if (mediaRecorderRef.current) {
        console.log("Stopping MediaRecorder");
        try {
          // First explicitly request the data
          if (typeof mediaRecorderRef.current.requestData === 'function') {
            console.log("Explicitly requesting data before stopping");
            mediaRecorderRef.current.requestData();
          }
          
          // Small delay to ensure the data is processed before stopping
          setTimeout(() => {
            if (mediaRecorderRef.current) {
              mediaRecorderRef.current.stop();
              console.log("MediaRecorder stopped successfully after data request");
            }
          }, 100);
        } catch (stopError) {
          console.error("Error stopping MediaRecorder:", stopError);
          // If stopping fails, immediately clean up everything
          recordedChunksRef.current = [];
          mediaRecorderRef.current = null;
          
          if (mediaStreamRef.current) {
            console.log("Stopping all media tracks due to MediaRecorder stop error");
            mediaStreamRef.current.getTracks().forEach(track => {
              console.log(`Force stopping track: ${track.kind}`);
              track.stop();
            });
            mediaStreamRef.current = null;
          }
          
          // Reset camera mode
          console.log("Resetting camera mode due to error");
          setCameraMode(null);
          
          // Let user know about the error
          toast({
            title: "Recording error",
            description: "Error while stopping recording. Media may not be saved.",
            variant: "destructive"
          });
        }
      } else {
        console.warn("MediaRecorder not available, nothing to stop");
        
        // Still clean up media stream just in case
        if (mediaStreamRef.current) {
          console.log("Stopping orphaned media tracks");
          mediaStreamRef.current.getTracks().forEach(track => track.stop());
          mediaStreamRef.current = null;
        }
      }
    } catch (error) {
      console.error("Critical error in stopRecording:", error);
      
      // Safety cleanup in case of catastrophic error
      if (mediaStreamRef.current) {
        try {
          console.log("Emergency media track cleanup");
          mediaStreamRef.current.getTracks().forEach(track => track.stop());
        } catch (cleanupError) {
          console.error("Even cleanup failed:", cleanupError);
        }
        mediaStreamRef.current = null;
      }
      
      mediaRecorderRef.current = null;
      recordedChunksRef.current = [];
      setIsRecording(false);
      setCameraMode(null);
      
      toast({
        title: "Recording failed",
        description: "A critical error occurred. Please try again.",
        variant: "destructive"
      });
    }
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
      
      // Reset camera state
      setCameraMode(null);
      
      toast({
        title: "Image captured",
        description: "Uploading to server..."
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
            title: "Image captured",
            description: "Image has been saved to the server."
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
    const files = e.target.files;
    if (!files?.length) return;

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
        
        // Prepare form data for upload
        const formData = new FormData();
        formData.append('file', file);
        
        try {
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
      onChange([...media, ...newItems]);
      
      // Reset the file input
      if (type === 'image' && fileInputRef.current) {
        fileInputRef.current.value = '';
      } else if (type === 'video' && videoInputRef.current) {
        videoInputRef.current.value = '';
      }
    } catch (error) {
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
      {/* Hidden file inputs for fallback upload */}
      <input 
        type="file" 
        ref={fileInputRef}
        accept="image/*"
        onChange={(e) => handleFileChange(e, 'image')}
        style={{ display: 'none' }}
        multiple
      />
      <input 
        type="file" 
        ref={videoInputRef}
        accept="video/*"
        onChange={(e) => handleFileChange(e, 'video')}
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
            onClick={() => fileInputRef.current?.click()}
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
            onClick={() => videoInputRef.current?.click()}
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