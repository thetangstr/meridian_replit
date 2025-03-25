import { storage } from './storage';
import { createTestStorage } from './testData';

// Export a function to initialize the storage with test data
export function initializeStorageWithTestData() {
  // Create test storage
  const testStorage = createTestStorage();
  
  // Copy all data from test storage to our main storage instance
  Object.assign(storage, testStorage);
  
  console.log('Storage initialized with test data');
  console.log(`Tasks, CUJs, and categories added to storage`);
}