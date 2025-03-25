import { useState, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Camera, Video, X } from "lucide-react";
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

  const handleCaptureImage = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleCaptureVideo = () => {
    if (videoInputRef.current) {
      videoInputRef.current.click();
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>, type: 'image' | 'video') => {
    const files = e.target.files;
    if (!files?.length) return;

    try {
      setIsCapturing(true);
      
      // In a real implementation, this would upload to server
      // Here we're just simulating with a local URL
      const newItems: MediaItem[] = [];
      
      // Check if adding these files would exceed the limit
      if (media.length + files.length > maxItems) {
        toast({
          title: "Maximum media limit reached",
          description: `You can only upload up to ${maxItems} files.`,
          variant: "destructive"
        });
        return;
      }
      
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const objectUrl = URL.createObjectURL(file);
        
        // In a real implementation, we would get this URL from the server
        newItems.push({
          id: `temp-${Date.now()}-${i}`,
          type,
          url: objectUrl,
          thumbnailUrl: type === 'video' ? undefined : objectUrl,
          createdAt: new Date().toISOString()
        });
        
        // Prepare form data for upload
        const formData = new FormData();
        formData.append('file', file);
        formData.append('type', type);
        
        // This would normally send to the server
        // const response = await fetch('/api/media/upload', {
        //   method: 'POST',
        //   body: formData
        // });
      }
      
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

  const handleRemoveMedia = (index: number) => {
    const newMedia = [...media];
    
    // Release object URL if it's a local URL
    const item = newMedia[index];
    if (item.url.startsWith('blob:')) {
      URL.revokeObjectURL(item.url);
      if (item.thumbnailUrl?.startsWith('blob:')) {
        URL.revokeObjectURL(item.thumbnailUrl);
      }
    }
    
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

        <div className="space-y-3">
          {media.length > 0 && (
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
        </div>

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
