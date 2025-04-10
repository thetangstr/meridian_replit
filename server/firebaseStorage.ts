import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs';
import * as crypto from 'crypto';
import { MediaItem } from '../shared/schema';


export class FirebaseMediaStorage {
  private mediaDir: string;

  constructor() {
    this.mediaDir = path.join(process.cwd(), 'public', 'uploads');
    if (!fs.existsSync(this.mediaDir)) {
      fs.mkdirSync(this.mediaDir, { recursive: true });
    }
  }

  async saveMedia(file: Express.Multer.File): Promise<MediaItem> {
    const id = uuidv4();
    const fileExtension = path.extname(file.originalname);
    const fileName = `${id}${fileExtension}`;
    const type = file.mimetype.startsWith('image/') ? 'image' : 'video';
    const filePath = path.join(this.mediaDir, fileName);
    fs.writeFileSync(filePath, file.buffer);


    const url = `/uploads/${fileName}`;
    let thumbnailUrl: string | undefined = undefined;

    if (type === 'image') {
      thumbnailUrl = url;
    }

    return {
      id,
      type,
      url,
      thumbnailUrl,
      createdAt: new Date().toISOString()
    };
  }

  getLocalFilePath(filename: string): string {
    return path.join(this.mediaDir, filename);
  }

  async deleteMedia(id: string, url: string): Promise<boolean> {
    const filename = path.basename(url);
    const filePath = this.getLocalFilePath(filename);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    return true;
  }
}