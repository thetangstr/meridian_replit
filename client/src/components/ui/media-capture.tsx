import { useState, useRef, useEffect } from "react";
import { Camera } from "react-camera-pro";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Camera as CameraIcon, Video, X, AlertCircle, Upload, RotateCcw } from "lucide-react";
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
  maxItems = 5,
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
    // If we're already in the selected mode, just turn it off
    if (mode === cameraMode) {
      stopCamera();
      return;
    }
    
    // Stop any ongoing recording
    if (isRecording) {
      stopRecording();
    }
    
    // Stop any existing camera
    stopCamera();
    
    // If we're turning off the camera, we're done
    if (mode === null) {
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
    
    // For video mode, we need to set up video recording
    if (mode === 'video') {
      startVideoRecording();
    }
  };

  const startVideoRecording = async () => {
    try {
      // If we already have an ongoing recording, stop it
      if (isRecording && mediaRecorderRef.current) {
        mediaRecorderRef.current.stop();
        return;
      }
      
      // Setup video recording
      const constraints = {
        video: {
          facingMode,
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: true
      };
      
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      mediaStreamRef.current = stream;
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(err => {
          console.error("Error playing video:", err);
        });
      }
      
      // Reset recorded chunks
      recordedChunksRef.current = [];
      
      // Check if MediaRecorder is supported
      if ('MediaRecorder' in window) {
        const mediaRecorder = new MediaRecorder(stream, {
          mimeType: 'video/webm;codecs=vp9,opus',
        });
        
        mediaRecorderRef.current = mediaRecorder;
        
        mediaRecorder.ondataavailable = (event) => {
          if (event.data && event.data.size > 0) {
            recordedChunksRef.current.push(event.data);
          }
        };
        
        mediaRecorder.onstop = async () => {
          processVideoRecording();
        };
        
        // Don't start recording automatically - wait for user to press record button
        
        toast({
          title: "Camera ready",
          description: "Tap the red button to start recording.",
        });
      } else {
        throw new Error("MediaRecorder not supported in this browser");
      }
    } catch (error) {
      console.error("Video recording error:", error);
      toast({
        title: "Video recording failed",
        description: "Please check your camera permissions or try another browser.",
        variant: "destructive"
      });
      
      // Fallback to file input
      if (videoInputRef.current) {
        videoInputRef.current.click();
      }
      
      // Reset camera mode
      setCameraMode(null);
    }
  };

  const processVideoRecording = async () => {
    try {
      if (recordedChunksRef.current.length === 0) {
        throw new Error("No video data recorded");
      }
      
      // Set loading state
      setIsLoading(true);
      
      // Process the recorded chunks
      const videoBlob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
      const tempVideoUrl = URL.createObjectURL(videoBlob);
      
      // Create temporary media item
      const tempItem: MediaItem = {
        id: `temp-${Date.now()}`,
        type: 'video',
        url: tempVideoUrl,
        createdAt: new Date().toISOString()
      };
      
      // Add to media collection with the temporary item
      onChange([...media, tempItem]);
      
      toast({
        title: "Video captured",
        description: "Uploading to server..."
      });
      
      // Don't stop camera yet - we'll do that after successful upload
      
      // Upload the video to the server
      const formData = new FormData();
      formData.append('file', videoBlob, `recording-${Date.now()}.webm`);
      
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
      const updatedMedia = [...media];
      const tempIndex = updatedMedia.length - 1; // Index of the item we just added
      
      // Revoke the temporary object URL
      URL.revokeObjectURL(tempItem.url);
      
      // Update with the permanent media item
      onChange([...updatedMedia.slice(0, tempIndex), mediaItem, ...updatedMedia.slice(tempIndex + 1)]);
      
      toast({
        title: "Video captured",
        description: "Video has been saved to the server."
      });
      
      // Now we can safely stop the camera
      stopCamera();
    } catch (error) {
      console.error("Video processing error:", error);
      toast({
        title: "Video processing failed",
        description: "Failed to process or upload the video.",
        variant: "destructive"
      });
      
      // Don't stop camera on error - let user try again
      setIsRecording(false);
    } finally {
      // Reset recorder and stream
      recordedChunksRef.current = [];
      mediaRecorderRef.current = null;
      setIsLoading(false);
    }
  };

  const startRecording = () => {
    if (mediaRecorderRef.current && !isRecording) {
      // Start recording with 100ms time slices to get data frequently
      mediaRecorderRef.current.start(100);
      setIsRecording(true);
      
      toast({
        title: "Recording video",
        description: "Tap the stop button when finished.",
      });
    }
  };
  
  const stopRecording = () => {
    if (isRecording && mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
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
      
      // Take the photo using react-camera-pro library
      const photo = cameraRef.current.takePhoto();
      
      // Create a temporary item for immediate display
      const tempItem: MediaItem = {
        id: `temp-${Date.now()}`,
        type: 'image',
        url: photo,
        thumbnailUrl: photo,
        createdAt: new Date().toISOString()
      };
      
      // Add to media collection
      onChange([...media, tempItem]);
      
      // Reset camera state
      setCameraMode(null);
      
      toast({
        title: "Image captured",
        description: "Uploading to server..."
      });
      
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
      
      // Replace the temporary item with the permanent one
      const updatedMedia = [...media];
      const tempIndex = updatedMedia.length - 1; // Index of the item we just added
      
      // Update with the permanent media item
      onChange([...updatedMedia.slice(0, tempIndex), mediaItem, ...updatedMedia.slice(tempIndex + 1)]);
      
      toast({
        title: "Image captured",
        description: "Image has been saved to the server."
      });
    } catch (error) {
      console.error("Image capture error:", error);
      toast({
        title: "Failed to capture image",
        description: "There was an error capturing or uploading the image.",
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
                  <img 
                    src={item.url} 
                    alt={`Captured ${index + 1}`} 
                    className="w-full aspect-square object-cover rounded-md"
                  />
                ) : (
                  <div className="relative bg-black rounded-md aspect-video flex items-center justify-center">
                    <video 
                      src={item.url} 
                      className="w-full h-full object-contain"
                      controls
                    />
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <Video className="h-8 w-8 text-white opacity-50" />
                    </div>
                  </div>
                )}
                
                <Button 
                  variant="destructive" 
                  size="icon" 
                  className="absolute -top-2 -right-2 h-6 w-6 rounded-full"
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