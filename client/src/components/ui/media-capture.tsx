import { useState, useRef, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Camera, Video, X, AlertCircle } from "lucide-react";
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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [cameraSupported, setCameraSupported] = useState(true);
  const [streamActive, setStreamActive] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingMode, setRecordingMode] = useState<'image' | 'video'>('image');
  const videoPreviewRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);

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
    
    // Cleanup on unmount
    return () => {
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const startCamera = async (mode: 'image' | 'video') => {
    try {
      setIsCapturing(true);
      setRecordingMode(mode);
      
      if (!cameraSupported) {
        // Fall back to file input if camera isn't supported
        if (mode === 'image' && fileInputRef.current) {
          fileInputRef.current.click();
        } else if (mode === 'video' && videoInputRef.current) {
          videoInputRef.current.click();
        }
        return;
      }
      
      const constraints: MediaStreamConstraints = { 
        video: {
          facingMode: 'environment',
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      };
      
      // Add audio for video recording
      if (mode === 'video') {
        constraints.audio = true;
      }
      
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      mediaStreamRef.current = stream;
      
      if (videoPreviewRef.current) {
        videoPreviewRef.current.srcObject = stream;
        videoPreviewRef.current.play();
        setStreamActive(true);
      }
      
      // Set up video recording if in video mode
      if (mode === 'video') {
        try {
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
              try {
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
                
                // Close the camera preview
                stopCamera();
                
                toast({
                  title: "Video captured",
                  description: "Uploading to server..."
                });
                
                // Upload the video to the server
                const formData = new FormData();
                formData.append('file', videoBlob, `recording-${Date.now()}.webm`);
                
                const response = await fetch('/api/media/upload', {
                  method: 'POST',
                  body: formData,
                  credentials: 'include'
                });
                
                if (!response.ok) {
                  throw new Error(`Upload failed: ${response.statusText}`);
                }
                
                // Get the permanent media item from the server response
                const mediaItem: MediaItem = await response.json();
                
                // Replace the temporary item with the permanent one
                const updatedMedia = [...media];
                const tempIndex = updatedMedia.length; // Index of the item we just added
                
                // Revoke the temporary object URL
                URL.revokeObjectURL(tempItem.url);
                
                // Update with the permanent media item
                onChange([...updatedMedia.slice(0, tempIndex), mediaItem]);
                
                toast({
                  title: "Video captured",
                  description: "Video has been saved to the server."
                });
              } catch (uploadError) {
                console.error('Video upload error:', uploadError);
                toast({
                  title: "Upload failed",
                  description: "Video was captured but couldn't be uploaded to server.",
                  variant: "destructive"
                });
              } finally {
                // Reset recorder and stream
                recordedChunksRef.current = [];
                mediaRecorderRef.current = null;
              }
            };
            
            // Start recording immediately
            mediaRecorder.start();
            setIsRecording(true);
            
            toast({
              title: "Recording video",
              description: "Tap the stop button when finished.",
            });
          } else {
            throw new Error("MediaRecorder not supported in this browser");
          }
        } catch (recorderError) {
          console.error("Video recording error:", recorderError);
          toast({
            title: "Video recording failed",
            description: "Your device doesn't support video recording. Try uploading a video instead.",
            variant: "destructive"
          });
          
          // Fall back to file input
          if (videoInputRef.current) {
            stopCamera();
            videoInputRef.current.click();
          }
        }
      } else {
        toast({
          title: "Camera ready",
          description: "Tap the capture button to take a photo",
        });
      }
      
    } catch (error) {
      console.error("Camera access error:", error);
      toast({
        title: "Camera access failed",
        description: "Couldn't access your camera. Please check permissions.",
        variant: "destructive"
      });
      
      // Fall back to file input
      if (mode === 'image' && fileInputRef.current) {
        fileInputRef.current.click();
      } else if (mode === 'video' && videoInputRef.current) {
        videoInputRef.current.click();
      }
      
      setIsCapturing(false);
    }
  };

  const captureImage = () => {
    if (!streamActive || !videoPreviewRef.current || !canvasRef.current) return;
    
    try {
      const video = videoPreviewRef.current;
      const canvas = canvasRef.current;
      
      // Set canvas size to match video dimensions
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      // Draw the current video frame to canvas
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      // Convert canvas to blob
      canvas.toBlob(async (blob) => {
        if (!blob) return;
        
        try {
          // Create temporary object URL for immediate display
          const tempObjectUrl = URL.createObjectURL(blob);
          
          // Create temporary media item
          const tempItem: MediaItem = {
            id: `temp-${Date.now()}`,
            type: 'image',
            url: tempObjectUrl,
            thumbnailUrl: tempObjectUrl,
            createdAt: new Date().toISOString()
          };
          
          // Add to media collection with the temporary item
          onChange([...media, tempItem]);
          
          // Stop camera stream
          stopCamera();
          
          toast({
            title: "Image captured",
            description: "Uploading to server..."
          });
          
          // Upload the image to the server
          const formData = new FormData();
          formData.append('file', blob, `capture-${Date.now()}.jpg`);
          
          const response = await fetch('/api/media/upload', {
            method: 'POST',
            body: formData,
            credentials: 'include'
          });
          
          if (!response.ok) {
            throw new Error(`Upload failed: ${response.statusText}`);
          }
          
          // Get the permanent media item from the server response
          const mediaItem: MediaItem = await response.json();
          
          // Replace the temporary item with the permanent one
          const updatedMedia = [...media];
          const tempIndex = updatedMedia.length; // Index of the item we just added
          
          // Revoke the temporary object URL
          URL.revokeObjectURL(tempItem.url);
          if (tempItem.thumbnailUrl) {
            URL.revokeObjectURL(tempItem.thumbnailUrl);
          }
          
          // Update with the permanent media item
          onChange([...updatedMedia.slice(0, tempIndex), mediaItem]);
          
          toast({
            title: "Image captured",
            description: "Image has been saved to the server."
          });
        } catch (uploadError) {
          console.error('Image upload error:', uploadError);
          toast({
            title: "Upload failed",
            description: "Image was captured but couldn't be uploaded to server.",
            variant: "destructive"
          });
        }
      }, 'image/jpeg', 0.95);
      
    } catch (error) {
      console.error("Image capture error:", error);
      toast({
        title: "Failed to capture image",
        description: error instanceof Error ? error.message : "An unexpected error occurred",
        variant: "destructive"
      });
    }
  };

  const stopCamera = () => {
    // Stop recording if active
    if (isRecording && mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
    }
    
    // Stop all tracks in the media stream
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }
    
    // Clear video preview
    if (videoPreviewRef.current) {
      videoPreviewRef.current.srcObject = null;
    }
    
    // Reset state
    setStreamActive(false);
    setIsCapturing(false);
    setIsRecording(false);
  };

  const handleCaptureImage = () => {
    if (streamActive && recordingMode === 'image') {
      captureImage();
    } else {
      startCamera('image');
    }
  };

  const handleCaptureVideo = () => {
    if (streamActive && recordingMode === 'video') {
      // Stop recording - this will trigger the mediaRecorder.onstop handler
      if (isRecording && mediaRecorderRef.current) {
        mediaRecorderRef.current.stop();
      } else {
        stopCamera();
      }
    } else {
      startCamera('video');
    }
  };
  
  const toggleRecording = () => {
    if (isRecording && mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>, type: 'image' | 'video') => {
    const files = e.target.files;
    if (!files?.length) return;

    try {
      setIsCapturing(true);
      
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
            body: formData,
            credentials: 'include'
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
        title: "Failed to capture media",
        description: error instanceof Error ? error.message : "An unexpected error occurred",
        variant: "destructive"
      });
    } finally {
      setIsCapturing(false);
    }
  };

  const handleRemoveMedia = async (index: number) => {
    const newMedia = [...media];
    
    // Get the item to be removed
    const item = newMedia[index];
    
    try {
      // If it's a temporary object URL, release it
      if (item.url.startsWith('blob:')) {
        URL.revokeObjectURL(item.url);
        if (item.thumbnailUrl?.startsWith('blob:')) {
          URL.revokeObjectURL(item.thumbnailUrl);
        }
      } 
      // If it's a server item (has an ID not starting with 'temp-'), delete it from the server
      else if (item.id && !item.id.startsWith('temp-')) {
        const response = await fetch(`/api/media/${item.id}`, {
          method: 'DELETE',
          credentials: 'include'
        });
        
        if (!response.ok) {
          console.error('Failed to delete media from server:', response.statusText);
          // Continue with UI removal even if server deletion fails
        }
      }
    } catch (error) {
      console.error('Error removing media:', error);
      toast({
        title: "Error removing media",
        description: "The item was removed from the form but may still exist on the server.",
        variant: "destructive"
      });
    }
    
    // Remove from local array regardless of server response
    newMedia.splice(index, 1);
    onChange(newMedia);
  };

  return (
    <Card className={className}>
      <CardContent className="p-4">
        <h4 className="font-medium">Media Evidence</h4>
        <p className="text-sm text-muted-foreground mb-4">
          Capture up to {maxItems} images or videos to document your evaluation.
        </p>

        <div className="space-y-4">
          {/* Camera Preview (only shown when active) */}
          {streamActive && (
            <div className="relative">
              <div className="aspect-video bg-gray-800 rounded-lg overflow-hidden border border-gray-200">
                <video 
                  ref={videoPreviewRef}
                  autoPlay 
                  playsInline
                  muted={recordingMode === 'image'} // Only mute for image capture
                  className="w-full h-full object-cover"
                ></video>
                
                {/* Recording indicator */}
                {isRecording && (
                  <div className="absolute top-2 left-2 flex items-center gap-2 bg-black/60 text-white px-2 py-1 rounded-md text-xs">
                    <div className="h-2 w-2 rounded-full bg-red-500 animate-pulse"></div>
                    Recording
                  </div>
                )}
              </div>
              
              <div className="absolute bottom-3 left-0 right-0 flex justify-center">
                {recordingMode === 'image' ? (
                  <Button
                    type="button"
                    variant="default"
                    size="sm"
                    className="rounded-full w-12 h-12 bg-primary hover:bg-primary/90"
                    onClick={captureImage}
                  >
                    <Camera className="h-6 w-6" />
                  </Button>
                ) : (
                  <Button
                    type="button"
                    variant={isRecording ? "destructive" : "default"}
                    size="sm"
                    className={`rounded-full w-12 h-12 ${isRecording ? "bg-red-500 hover:bg-red-600" : "bg-primary hover:bg-primary/90"}`}
                    onClick={toggleRecording}
                  >
                    {isRecording ? <X className="h-6 w-6" /> : <Video className="h-6 w-6" />}
                  </Button>
                )}
              </div>
              
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="absolute top-2 right-2 rounded-full bg-white/70 p-1 hover:bg-white/90"
                onClick={stopCamera}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}

          {/* Hidden canvas used for capturing still images */}
          <canvas ref={canvasRef} className="hidden"></canvas>

          {/* Media Gallery */}
          {media.length > 0 && !streamActive && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {media.map((item, index) => (
                <div
                  key={item.id}
                  className="relative aspect-video bg-gray-100 rounded-lg overflow-hidden border border-gray-200"
                >
                  {item.type === 'image' ? (
                    <img 
                      src={item.url} 
                      alt="Evaluation evidence" 
                      className="w-full h-full object-cover" 
                    />
                  ) : (
                    <div className="relative w-full h-full flex items-center justify-center bg-gray-800">
                      <Video className="text-white opacity-50" />
                      <video 
                        src={item.url}
                        className="absolute inset-0 w-full h-full" 
                        controls
                      />
                    </div>
                  )}
                  <button
                    type="button"
                    className="absolute top-1 right-1 bg-white bg-opacity-70 rounded-full p-1"
                    onClick={() => handleRemoveMedia(index)}
                  >
                    <X className="h-4 w-4 text-destructive" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Camera support warning */}
          {!cameraSupported && (
            <div className="flex items-center gap-2 p-3 rounded-md bg-amber-50 text-amber-700 text-sm mb-2">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              <p>Camera access not available. You can still upload files directly.</p>
            </div>
          )}

          {/* Capture/Upload Buttons (hidden when camera active) */}
          {!streamActive && (
            <div className="flex gap-3">
              <Button
                type="button"
                variant="outline"
                className="flex-1 border-primary text-primary"
                onClick={handleCaptureImage}
                disabled={isCapturing || media.length >= maxItems}
              >
                <Camera className="mr-1 h-4 w-4" />
                Capture Image
              </Button>
              <Button
                type="button"
                variant="outline"
                className="flex-1 border-primary text-primary"
                onClick={handleCaptureVideo}
                disabled={isCapturing || media.length >= maxItems}
              >
                <Video className="mr-1 h-4 w-4" />
                Capture Video
              </Button>
            </div>
          )}
        </div>

        {/* Hidden file inputs for fallback */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => handleFileChange(e, 'image')}
          capture="environment"
          multiple
        />
        <input
          ref={videoInputRef}
          type="file"
          accept="video/*"
          className="hidden"
          onChange={(e) => handleFileChange(e, 'video')}
          capture="environment"
        />
      </CardContent>
    </Card>
  );
}
