import React, { useState } from 'react';
import { MediaCapture } from '@/components/ui/media-capture';
import { MediaItem } from '@shared/schema';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function MediaTestPage() {
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  
  const handleMediaChange = (newMedia: MediaItem[]) => {
    console.log('Media updated:', newMedia);
    setMediaItems(newMedia);
  };
  
  return (
    <div className="container mx-auto py-8">
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Media Capture Test</CardTitle>
          <CardDescription>
            This page allows you to test the media capture functionality.
            Try adding images and videos, then check if they persist after page refresh.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <MediaCapture 
            media={mediaItems} 
            onChange={handleMediaChange} 
            maxItems={5}
          />
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle>Debug Information</CardTitle>
        </CardHeader>
        <CardContent>
          <h3 className="font-medium mb-2">Media Items ({mediaItems.length})</h3>
          <pre className="bg-gray-100 p-4 rounded-md overflow-auto max-h-[300px] text-xs">
            {JSON.stringify(mediaItems, null, 2)}
          </pre>
        </CardContent>
      </Card>
    </div>
  );
}