import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { storage, isFirebaseConfigured } from '../shared/firebase';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { MediaItem } from '../shared/schema';

// Fallback to local storage when Firebase is not configured
const LOCAL_MEDIA_DIR = path.join(process.cwd(), 'uploads');

// Ensure local upload directory exists
if (!fs.existsSync(LOCAL_MEDIA_DIR)) {
  fs.mkdirSync(LOCAL_MEDIA_DIR, { recursive: true });
}

export class FirebaseMediaStorage {
  async saveMedia(file: Express.Multer.File): Promise<MediaItem> {
    const id = crypto.randomUUID();
    const fileExtension = path.extname(file.originalname);
    const fileName = `${id}${fileExtension}`;
    const type = file.mimetype.startsWith('image/') ? 'image' : 'video';
    
    try {
      // Try to use Firebase Storage if configured
      if (isFirebaseConfigured()) {
        return await this.saveToFirebase(id, fileName, file, type);
      } else {
        // Fallback to local storage
        return await this.saveToLocalStorage(id, fileName, file, type);
      }
    } catch (error) {
      console.error('Error saving media:', error);
      // Fallback to local storage if Firebase upload fails
      return await this.saveToLocalStorage(id, fileName, file, type);
    }
  }

  private async saveToFirebase(id: string, fileName: string, file: Express.Multer.File, type: 'image' | 'video'): Promise<MediaItem> {
    // Create a reference to the file in Firebase Storage
    const storageRef = ref(storage, `media/${type}s/${fileName}`);
    
    // Upload the file
    await uploadBytes(storageRef, file.buffer);
    
    // Get the download URL
    const url = await getDownloadURL(storageRef);
    
    // For images, we might want to create a thumbnail
    let thumbnailUrl: string | undefined = undefined;
    if (type === 'image') {
      // For now, we'll use the same URL
      thumbnailUrl = url;
    } else if (type === 'video') {
      // Generate a thumbnail if needed
      // For now, we'll leave this undefined
    }
    
    // Return the media item
    return {
      id,
      type,
      url,
      thumbnailUrl,
      createdAt: new Date().toISOString()
    };
  }

  private async saveToLocalStorage(id: string, fileName: string, file: Express.Multer.File, type: 'image' | 'video'): Promise<MediaItem> {
    // Save file to local storage
    const filePath = path.join(LOCAL_MEDIA_DIR, fileName);
    fs.writeFileSync(filePath, file.buffer);
    
    // Create URLs that can be accessed via the API
    const url = `/api/media/file/${fileName}`;
    let thumbnailUrl: string | undefined = undefined;
    
    if (type === 'image') {
      // For images, just use the same URL
      thumbnailUrl = url;
    }
    
    // Return the media item
    return {
      id,
      type,
      url,
      thumbnailUrl,
      createdAt: new Date().toISOString()
    };
  }

  async deleteMedia(id: string, fileName: string): Promise<boolean> {
    try {
      // Extract the file name
      const type = fileName.includes('/image') ? 'image' : 'video';
      const baseFileName = path.basename(fileName);
      
      // Try to delete from Firebase if configured
      if (isFirebaseConfigured()) {
        const storageRef = ref(storage, `media/${type}s/${baseFileName}`);
        await deleteObject(storageRef);
      } 
      
      // Also check and delete from local storage if exists
      const localFilePath = path.join(LOCAL_MEDIA_DIR, baseFileName);
      if (fs.existsSync(localFilePath)) {
        fs.unlinkSync(localFilePath);
      }
      
      return true;
    } catch (error) {
      console.error('Error deleting media:', error);
      return false;
    }
  }

  // Get the serving path for a local file
  getLocalFilePath(fileName: string): string {
    return path.join(LOCAL_MEDIA_DIR, fileName);
  }
}