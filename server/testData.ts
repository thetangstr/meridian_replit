import { MemStorage } from './storage';
import type { Cuj, CujCategory, Task, Car, User, Review, InsertTaskEvaluation, InsertCategoryEvaluation } from '../shared/schema';

/**
 * Initializes a new MemStorage instance with test data based on the provided table
 * using the synchronous approach to avoid promise-related issues
 */
export function createTestStorage(): MemStorage {
  const storage = new MemStorage();
  
  // Reset all data - we'll add our own
  storage.users = new Map();
  storage.cujCategories = new Map();
  storage.cujs = new Map();
  storage.tasks = new Map();
  storage.cars = new Map();
  storage.reviews = new Map();
  storage.taskEvaluations = new Map();
  storage.categoryEvaluations = new Map();
  storage.reports = new Map();
  
  // Reset counters
  storage.userIdCounter = 1;
  storage.categoryIdCounter = 1;
  storage.cujIdCounter = 1;
  storage.taskIdCounter = 1;
  storage.carIdCounter = 1;
  storage.reviewIdCounter = 1;
  
  // Create users
  const admin: User = { id: storage.userIdCounter++, username: "admin", password: "admin123", name: "Admin User", role: "admin" };
  const reviewer: User = { id: storage.userIdCounter++, username: "reviewer", password: "review123", name: "Test Reviewer", role: "reviewer" };
  const internal: User = { id: storage.userIdCounter++, username: "internal", password: "internal123", name: "Internal Stakeholder", role: "internal" };
  const external: User = { id: storage.userIdCounter++, username: "external", password: "external123", name: "External Viewer", role: "external" };
  
  storage.users.set(admin.id, admin);
  storage.users.set(reviewer.id, reviewer);
  storage.users.set(internal.id, internal);
  storage.users.set(external.id, external);
  
  // Create categories
  const navigationCategory: CujCategory = { 
    id: storage.categoryIdCounter++, 
    name: "Navigation", 
    description: "All navigation related functions", 
    icon: "navigation" 
  };
  
  const mediaCategory: CujCategory = { 
    id: storage.categoryIdCounter++, 
    name: "Media", 
    description: "Audio, video and entertainment functions", 
    icon: "headphones" 
  };
  
  const communicationCategory: CujCategory = { 
    id: storage.categoryIdCounter++, 
    name: "Communications", 
    description: "Phone, messaging and voice assistant features", 
    icon: "phone" 
  };
  
  const generalCategory: CujCategory = { 
    id: storage.categoryIdCounter++, 
    name: "General", 
    description: "System-wide settings and features", 
    icon: "settings" 
  };
  
  storage.cujCategories.set(navigationCategory.id, navigationCategory);
  storage.cujCategories.set(mediaCategory.id, mediaCategory);
  storage.cujCategories.set(communicationCategory.id, communicationCategory);
  storage.cujCategories.set(generalCategory.id, generalCategory);
  
  // Create CUJs
  // Navigation CUJs
  const navDestinationCuj: Cuj = {
    id: storage.cujIdCounter++,
    categoryId: navigationCategory.id,
    name: "Destination Entry",
    description: "Entering and navigating to destinations"
  };
  
  const navRouteCuj: Cuj = {
    id: storage.cujIdCounter++,
    categoryId: navigationCategory.id,
    name: "Route Management",
    description: "Managing navigation routes and waypoints"
  };
  
  const navPoiCuj: Cuj = {
    id: storage.cujIdCounter++,
    categoryId: navigationCategory.id,
    name: "Points of Interest",
    description: "Finding and navigating to points of interest"
  };
  
  const navTrafficCuj: Cuj = {
    id: storage.cujIdCounter++,
    categoryId: navigationCategory.id,
    name: "Traffic and Route Options",
    description: "Managing traffic updates and route preferences"
  };
  
  const navMapsCuj: Cuj = {
    id: storage.cujIdCounter++,
    categoryId: navigationCategory.id,
    name: "Maps Management",
    description: "Managing offline maps and map display"
  };
  
  // Media CUJs
  const mediaConnectionCuj: Cuj = {
    id: storage.cujIdCounter++,
    categoryId: mediaCategory.id,
    name: "Device Connection",
    description: "Connecting and managing media devices"
  };
  
  const mediaPlaybackCuj: Cuj = {
    id: storage.cujIdCounter++,
    categoryId: mediaCategory.id,
    name: "Media Playback",
    description: "Playing and controlling media content"
  };
  
  const mediaRadioCuj: Cuj = {
    id: storage.cujIdCounter++,
    categoryId: mediaCategory.id,
    name: "Radio",
    description: "Listening to and managing radio stations"
  };
  
  const mediaStreamingCuj: Cuj = {
    id: storage.cujIdCounter++,
    categoryId: mediaCategory.id,
    name: "Streaming Services",
    description: "Accessing and controlling streaming media"
  };
  
  const mediaRearSeatCuj: Cuj = {
    id: storage.cujIdCounter++,
    categoryId: mediaCategory.id,
    name: "Rear-Seat Entertainment",
    description: "Managing rear-seat media playback"
  };
  
  // Communications CUJs
  const commCallsCuj: Cuj = {
    id: storage.cujIdCounter++,
    categoryId: communicationCategory.id,
    name: "Phone Calls",
    description: "Making and managing phone calls"
  };
  
  const commMessagesCuj: Cuj = {
    id: storage.cujIdCounter++,
    categoryId: communicationCategory.id,
    name: "Messaging",
    description: "Sending and receiving text messages"
  };
  
  const commVoiceAssistantCuj: Cuj = {
    id: storage.cujIdCounter++,
    categoryId: communicationCategory.id,
    name: "Voice Assistant",
    description: "Using voice commands and assistant features"
  };
  
  // General CUJs
  const generalSettingsCuj: Cuj = {
    id: storage.cujIdCounter++,
    categoryId: generalCategory.id,
    name: "System Settings",
    description: "Adjusting system-wide settings"
  };
  
  // Add all CUJs to the map
  const allCujs = [
    navDestinationCuj, navRouteCuj, navPoiCuj, navTrafficCuj, navMapsCuj,
    mediaConnectionCuj, mediaPlaybackCuj, mediaRadioCuj, mediaStreamingCuj, mediaRearSeatCuj,
    commCallsCuj, commMessagesCuj, commVoiceAssistantCuj,
    generalSettingsCuj
  ];
  
  allCujs.forEach(cuj => storage.cujs.set(cuj.id, cuj));
  
  // Create tasks based on the provided table
  const tasks: Task[] = [
    // Navigation Tasks
    {
      id: storage.taskIdCounter++,
      cujId: navDestinationCuj.id,
      name: "Enter a destination using voice commands",
      prerequisites: "Vehicle is on, Infotainment system is powered on, Microphone is enabled",
      expectedOutcome: "Navigation route is calculated and displayed on the map."
    },
    {
      id: storage.taskIdCounter++,
      cujId: navRouteCuj.id,
      name: "Start turn-by-turn navigation",
      prerequisites: "Destination is entered, Route is calculated",
      expectedOutcome: "Clear and timely voice prompts and visual cues guide the driver along the route."
    },
    {
      id: storage.taskIdCounter++,
      cujId: navRouteCuj.id,
      name: "View alternative routes",
      prerequisites: "Navigation is active, Multiple routes are available",
      expectedOutcome: "A list of alternative routes is displayed on the map with estimated time of arrival."
    },
    {
      id: storage.taskIdCounter++,
      cujId: navRouteCuj.id,
      name: "Add a waypoint to the current route",
      prerequisites: "Navigation is active",
      expectedOutcome: "Waypoint is added to the route, and the route is recalculated."
    },
    {
      id: storage.taskIdCounter++,
      cujId: navRouteCuj.id,
      name: "Cancel current navigation",
      prerequisites: "Navigation is active",
      expectedOutcome: "Navigation is stopped, and the map returns to a default view."
    },
    {
      id: storage.taskIdCounter++,
      cujId: navPoiCuj.id,
      name: "Search for nearby Points of Interest (POI)",
      prerequisites: "Vehicle is on, Infotainment system is powered on",
      expectedOutcome: "A list of nearby POIs matching the search criteria is displayed on the map."
    },
    {
      id: storage.taskIdCounter++,
      cujId: navPoiCuj.id,
      name: "Get directions to a selected POI",
      prerequisites: "A POI is selected from the search results",
      expectedOutcome: "Navigation route to the selected POI is calculated and displayed."
    },
    {
      id: storage.taskIdCounter++,
      cujId: navTrafficCuj.id,
      name: "Receive and view traffic updates",
      prerequisites: "Navigation is active, Traffic data is available",
      expectedOutcome: "Real-time traffic information is displayed on the navigation map, potentially with route adjustments."
    },
    {
      id: storage.taskIdCounter++,
      cujId: navTrafficCuj.id,
      name: "Avoid toll roads on the navigation route",
      prerequisites: "Navigation route is being calculated or is active",
      expectedOutcome: "The navigation route is recalculated to avoid toll roads."
    },
    {
      id: storage.taskIdCounter++,
      cujId: navMapsCuj.id,
      name: "Download offline maps for a specific region",
      prerequisites: "Infotainment system has storage capacity, Internet connectivity is available",
      expectedOutcome: "Offline map data for the selected region is downloaded and stored for use without internet."
    },
    
    // Media Tasks
    {
      id: storage.taskIdCounter++,
      cujId: mediaConnectionCuj.id,
      name: "Connect smartphone via Bluetooth",
      prerequisites: "Smartphone Bluetooth is enabled",
      expectedOutcome: "Smartphone is successfully paired and audio can be streamed."
    },
    {
      id: storage.taskIdCounter++,
      cujId: mediaPlaybackCuj.id,
      name: "Play music from connected smartphone",
      prerequisites: "Smartphone is connected via Bluetooth or USB, Music app is open on the phone",
      expectedOutcome: "Audio playback from the smartphone begins through the car speakers."
    },
    {
      id: storage.taskIdCounter++,
      cujId: mediaPlaybackCuj.id,
      name: "Control music playback (play, pause, skip) using steering wheel controls",
      prerequisites: "Music is playing from a connected device",
      expectedOutcome: "Music playback is controlled according to the steering wheel button pressed."
    },
    {
      id: storage.taskIdCounter++,
      cujId: mediaPlaybackCuj.id,
      name: "Browse music library on connected USB drive",
      prerequisites: "USB drive with music files is connected",
      expectedOutcome: "A list of folders and music files on the USB drive is displayed on the infotainment screen."
    },
    {
      id: storage.taskIdCounter++,
      cujId: mediaPlaybackCuj.id,
      name: "Adjust audio equalizer settings",
      prerequisites: "Audio is playing",
      expectedOutcome: "The sound output is modified according to the adjusted equalizer settings."
    },
    {
      id: storage.taskIdCounter++,
      cujId: mediaRadioCuj.id,
      name: "Listen to FM/AM radio",
      prerequisites: "Vehicle is on, Infotainment system is powered on",
      expectedOutcome: "Audio from the selected FM/AM radio station plays through the car speakers."
    },
    {
      id: storage.taskIdCounter++,
      cujId: mediaRadioCuj.id,
      name: "Scan for available radio stations",
      prerequisites: "Radio is active",
      expectedOutcome: "A list of available FM/AM radio stations is displayed."
    },
    {
      id: storage.taskIdCounter++,
      cujId: mediaStreamingCuj.id,
      name: "Stream audio from a built-in music streaming service",
      prerequisites: "Vehicle has a subscription to a built-in streaming service, Internet connectivity is available",
      expectedOutcome: "Audio playback from the selected streaming service begins."
    },
    {
      id: storage.taskIdCounter++,
      cujId: mediaStreamingCuj.id,
      name: "Browse and search the catalog of the built-in streaming service",
      prerequisites: "Built-in streaming service is active",
      expectedOutcome: "The user can explore the music library of the streaming service."
    },
    {
      id: storage.taskIdCounter++,
      cujId: mediaRearSeatCuj.id,
      name: "Control playback of rear-seat entertainment (if available)",
      prerequisites: "Rear-seat entertainment system is active and linked to the main infotainment",
      expectedOutcome: "Audio and/or video playback in the rear seats is controlled from the main infotainment unit."
    },
    
    // Communications Tasks
    {
      id: storage.taskIdCounter++,
      cujId: commCallsCuj.id,
      name: "Make a phone call using Bluetooth contacts",
      prerequisites: "Smartphone is connected via Bluetooth, Contacts are synced",
      expectedOutcome: "The selected contact is called, and the call connects through the car speakers and microphone."
    },
    {
      id: storage.taskIdCounter++,
      cujId: commCallsCuj.id,
      name: "Answer an incoming phone call",
      prerequisites: "Smartphone is connected via Bluetooth, Incoming call notification is displayed",
      expectedOutcome: "The incoming call is answered and connected through the car speakers and microphone."
    },
    {
      id: storage.taskIdCounter++,
      cujId: commCallsCuj.id,
      name: "End an ongoing phone call",
      prerequisites: "A phone call is active",
      expectedOutcome: "The active phone call is disconnected."
    },
    {
      id: storage.taskIdCounter++,
      cujId: commCallsCuj.id,
      name: "View recent call history",
      prerequisites: "Smartphone is connected via Bluetooth (if required by the system)",
      expectedOutcome: "A list of recent incoming, outgoing, and missed calls is displayed."
    },
    {
      id: storage.taskIdCounter++,
      cujId: commMessagesCuj.id,
      name: "Send a pre-defined text message",
      prerequisites: "Smartphone is connected via Bluetooth (if required by the system), Pre-defined messages are configured",
      expectedOutcome: "The selected pre-defined text message is sent."
    },
    {
      id: storage.taskIdCounter++,
      cujId: commMessagesCuj.id,
      name: "Receive and view SMS messages",
      prerequisites: "Smartphone is connected via Bluetooth (if required by the system), SMS access is granted",
      expectedOutcome: "New SMS messages are displayed on the infotainment screen."
    },
    {
      id: storage.taskIdCounter++,
      cujId: commMessagesCuj.id,
      name: "Reply to an SMS message using voice commands",
      prerequisites: "An SMS message is open, Voice commands are enabled",
      expectedOutcome: "A reply message dictated by voice is sent."
    },
    {
      id: storage.taskIdCounter++,
      cujId: commVoiceAssistantCuj.id,
      name: "Initiate a voice assistant command (e.g., 'Hey [Car Brand]')",
      prerequisites: "Vehicle is on, Infotainment system is powered on, Voice assistant is enabled",
      expectedOutcome: "The voice assistant is activated and ready to receive voice commands."
    },
    {
      id: storage.taskIdCounter++,
      cujId: commVoiceAssistantCuj.id,
      name: "Ask the voice assistant to make a call",
      prerequisites: "Voice assistant is active, Contact name is provided",
      expectedOutcome: "The voice assistant attempts to initiate a call to the specified contact."
    },
    
    // General Tasks
    {
      id: storage.taskIdCounter++,
      cujId: generalSettingsCuj.id,
      name: "Adjust the infotainment system volume",
      prerequisites: "Infotainment system is powered on",
      expectedOutcome: "The audio volume of the system is increased or decreased."
    },
    {
      id: storage.taskIdCounter++,
      cujId: generalSettingsCuj.id,
      name: "Adjust the display brightness",
      prerequisites: "Infotainment system display is active",
      expectedOutcome: "The brightness of the infotainment screen is adjusted."
    },
    {
      id: storage.taskIdCounter++,
      cujId: generalSettingsCuj.id,
      name: "Navigate through the infotainment system menus",
      prerequisites: "Infotainment system is powered on",
      expectedOutcome: "The user can access different features and settings of the system."
    }
  ];
  
  // Add all tasks to the map
  tasks.forEach(task => storage.tasks.set(task.id, task));
  
  // Create cars
  const car1: Car = {
    id: storage.carIdCounter++,
    make: "Tesla",
    model: "Model 3",
    year: 2025,
    androidVersion: "15.2",
    buildFingerprint: "TM3-2025Q1-14.8.6",
    location: "Mountain View, CA",
    imageUrl: "https://images.unsplash.com/photo-1619767886558-f20ee7a30bc6?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=80"
  };
  
  const car2: Car = {
    id: storage.carIdCounter++,
    make: "BMW",
    model: "i7",
    year: 2025,
    androidVersion: "15.0",
    buildFingerprint: "BMW-i7-2025Q1-13.7.2",
    location: "San Francisco, CA",
    imageUrl: "https://images.unsplash.com/photo-1617914900071-532377d42425?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=80"
  };
  
  storage.cars.set(car1.id, car1);
  storage.cars.set(car2.id, car2);
  
  // Create reviews
  const now = new Date();
  const oneWeekLater = new Date(now);
  oneWeekLater.setDate(oneWeekLater.getDate() + 7);
  
  const review1: Review = {
    id: storage.reviewIdCounter++,
    carId: car1.id,
    reviewerId: reviewer.id,
    status: "in_progress",
    startDate: now.toISOString(),
    endDate: oneWeekLater.toISOString(),
    createdAt: now.toISOString(),
    updatedAt: now.toISOString()
  };
  
  const review2: Review = {
    id: storage.reviewIdCounter++,
    carId: car2.id,
    reviewerId: reviewer.id,
    status: "pending",
    startDate: now.toISOString(),
    endDate: oneWeekLater.toISOString(),
    createdAt: now.toISOString(),
    updatedAt: now.toISOString()
  };
  
  storage.reviews.set(review1.id, review1);
  storage.reviews.set(review2.id, review2);
  
  // Set default scoring config
  storage.scoringConfig = {
    id: 1,
    taskDoableWeight: 43.75,
    taskUsabilityWeight: 37.5,
    taskVisualsWeight: 18.75,
    categoryTasksWeight: 80,
    categoryResponsivenessWeight: 15,
    categoryWritingWeight: 5,
    categoryEmotionalWeight: 5,
    updatedAt: now.toISOString(),
    updatedBy: null
  };
  
  storage.cujSyncData = {
    lastSync: now.toISOString(),
    status: "up_to_date"
  };
  
  return storage;
}