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
          setRecordingTime(prevTime => prevTime + 1);
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
        capture="environment"
        className="hidden"
        multiple
      />
      <input
        type="file"
        ref={videoInputRef}
        onChange={(e) => handleFileInput(e, 'video')}
        accept="video/*"
        capture="environment"
        className="hidden"
      />
      
      {/* Media gallery */}
      {media.length > 0 && (
        <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
          {media.map((item, index) => (
            <div key={item.id} className="relative group aspect-square rounded-md overflow-hidden bg-muted">
              {item.type === 'image' ? (
                <img 
                  src={item.url} 
                  alt={`Evidence item ${index + 1}`}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              ) : (
                <video 
                  src={item.url} 
                  controls
                  className="w-full h-full object-cover"
                />
              )}
              
              <button
                type="button"
                onClick={() => handleRemoveMedia(index)}
                className="absolute top-2 right-2 bg-black/70 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                aria-label="Remove media"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}
      
      {/* Camera UI */}
      {cameraMode === 'image' && (
        <div className="relative rounded-lg overflow-hidden bg-black">
          <Camera
            ref={cameraRef}
            facingMode={facingMode}
            aspectRatio={4/3}
            errorMessages={{
              noCameraAccessible: 'No camera available.',
              permissionDenied: 'Camera permission denied.',
              switchCamera: 'Could not switch camera.'
              // Note: 'capture' is not a supported error message type in react-camera-pro
            }}
            errorComponent={({ error }: { error: string }) => (
              <div className="p-4 text-center text-red-500 flex flex-col items-center">
                <AlertCircle className="h-10 w-10 mb-2" />
                <p>{error}</p>
              </div>
            )}
          />
          
          <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent">
            <div className="flex justify-between items-center">
              <Button 
                variant="ghost" 
                size="icon"
                className="h-10 w-10 rounded-full bg-white text-black"
                onClick={switchFacingMode}
              >
                <RefreshCw className="h-5 w-5" />
              </Button>
              
              <Button
                variant="ghost"
                size="icon"
                className="h-14 w-14 rounded-full bg-white text-black"
                onClick={captureImage}
                disabled={isLoading}
              >
                <Circle className="h-12 w-12 stroke-2" />
              </Button>
              
              <Button
                variant="ghost"
                size="icon"
                className="h-10 w-10 rounded-full bg-white text-black"
                onClick={() => switchCameraMode(null)}
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </div>
      )}
      
      {/* Video recording UI */}
      {cameraMode === 'video' && (
        <div className="relative rounded-lg overflow-hidden bg-black">
          <video 
            ref={videoRef}
            autoPlay 
            playsInline 
            muted 
            className="w-full aspect-[4/3] object-cover" 
          />
          
          <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent">
            <div className="flex justify-between items-center">
              <Button 
                variant="ghost" 
                size="icon"
                className="h-10 w-10 rounded-full bg-white text-black"
                onClick={switchFacingMode}
                disabled={isRecording}
              >
                <RefreshCw className="h-5 w-5" />
              </Button>
              
              {isRecording ? (
                <div className="flex flex-col items-center">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-14 w-14 rounded-full bg-red-500 text-white"
                    onClick={stopRecording}
                  >
                    <Square className="h-6 w-6" />
                  </Button>
                  <span className="text-white text-xs mt-1">{formatTime(recordingTime)}</span>
                </div>
              ) : (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-14 w-14 rounded-full bg-red-500 text-white"
                  onClick={startRecording}
                  disabled={isLoading}
                >
                  <Circle className="h-6 w-6 fill-current" />
                </Button>
              )}
              
              <Button
                variant="ghost"
                size="icon"
                className="h-10 w-10 rounded-full bg-white text-black"
                onClick={() => switchCameraMode(null)}
                disabled={isRecording}
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </div>
      )}
      
      {/* Camera mode and file upload buttons with clear separation */}
      {cameraMode === null && (
        <Card>
          <CardContent className="p-4">
            <h4 className="font-medium mb-4">Add Evidence</h4>
            
            {/* Camera Access Button with Type Toggle */}
            <div className="grid gap-4">
              <div className="flex flex-col">
                <Button 
                  variant="outline"
                  className="flex justify-center items-center h-14 mb-2"
                  onClick={() => switchCameraMode(uploadType === 'image' ? 'image' : 'video')}
                  disabled={isLoading || media.length >= maxItems}
                >
                  <div className="flex items-center">
                    {uploadType === 'image' ? (
                      <CameraIcon className="h-5 w-5 mr-2 text-primary" />
                    ) : (
                      <Video className="h-5 w-5 mr-2 text-primary" />
                    )}
                    <span>Open Camera</span>
                  </div>
                </Button>
              
                {/* Toggle between image and video */}
                <div className="bg-muted inline-flex rounded-lg p-1 self-center">
                  <Button
                    variant={uploadType === 'image' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setUploadType('image')}
                    className="relative px-3"
                  >
                    <CameraIcon className="h-4 w-4 mr-1" />
                    Photo
                  </Button>
                  <Button
                    variant={uploadType === 'video' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setUploadType('video')}
                    className="relative px-3"
                  >
                    <Video className="h-4 w-4 mr-1" />
                    Video
                  </Button>
                </div>
              </div>
              
              {/* Separate File Upload Button */}
              <Button 
                variant="outline"
                className="flex justify-center items-center h-14"
                onClick={() => {
                  // Decide which file input to show based on current uploadType
                  if (uploadType === 'image') {
                    fileInputRef.current?.click();
                  } else {
                    videoInputRef.current?.click();
                  }
                }}
                disabled={isLoading || media.length >= maxItems}
              >
                <Upload className="h-5 w-5 mr-2 text-primary" />
                <span>Upload {uploadType === 'image' ? 'Photo' : 'Video'} File</span>
              </Button>
            </div>
            
            {media.length >= maxItems && (
              <p className="text-xs text-muted-foreground mt-2 text-center">
                Maximum of {maxItems} media items. Remove items to add more.
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}