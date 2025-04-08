-- Add CUJs for each category
-- Navigation CUJs
INSERT INTO cujs (name, description, category_id) VALUES
('Destination Entry', 'Entering and navigating to destinations', 1),
('Route Management', 'Managing navigation routes and waypoints', 1),
('Points of Interest', 'Finding and navigating to points of interest', 1),
('Traffic and Route Options', 'Managing traffic updates and route preferences', 1),
('Maps Management', 'Managing offline maps and map display', 1);

-- Media CUJs
INSERT INTO cujs (name, description, category_id) VALUES
('Device Connection', 'Connecting and managing media devices', 2),
('Media Playback', 'Playing and controlling media content', 2),
('Radio', 'Listening to and managing radio stations', 2),
('Streaming Services', 'Accessing and controlling streaming media', 2),
('Rear-Seat Entertainment', 'Managing rear-seat media playback', 2);

-- Communications CUJs
INSERT INTO cujs (name, description, category_id) VALUES
('Phone Calls', 'Making and managing phone calls', 3),
('Messaging', 'Sending and receiving text messages', 3),
('Voice Assistant', 'Using voice commands and assistant features', 3);

-- General CUJs
INSERT INTO cujs (name, description, category_id) VALUES
('System Settings', 'Adjusting system-wide settings', 4);

-- Add tasks for each CUJ
-- Navigation Tasks
INSERT INTO tasks (name, prerequisites, expected_outcome, cuj_id) VALUES
('Enter a destination using voice commands', 'Vehicle is on, Infotainment system is powered on, Microphone is enabled', 'Navigation route is calculated and displayed on the map.', 1),
('Start turn-by-turn navigation', 'Destination is entered, Route is calculated', 'Clear and timely voice prompts and visual cues guide the driver along the route.', 2),
('View alternative routes', 'Navigation is active, Multiple routes are available', 'A list of alternative routes is displayed on the map with estimated time of arrival.', 2),
('Add a waypoint to the current route', 'Navigation is active', 'Waypoint is added to the route, and the route is recalculated.', 2),
('Cancel current navigation', 'Navigation is active', 'Navigation is stopped, and the map returns to a default view.', 2),
('Search for nearby Points of Interest (POI)', 'Vehicle is on, Infotainment system is powered on', 'A list of nearby POIs matching the search criteria is displayed on the map.', 3),
('Get directions to a selected POI', 'A POI is selected from the search results', 'Navigation route to the selected POI is calculated and displayed.', 3),
('Receive and view traffic updates', 'Navigation is active, Traffic data is available', 'Real-time traffic information is displayed on the navigation map, potentially with route adjustments.', 4),
('Avoid toll roads on the navigation route', 'Navigation route is being calculated or is active', 'The navigation route is recalculated to avoid toll roads.', 4),
('Download offline maps for a specific region', 'Infotainment system has storage capacity, Internet connectivity is available', 'Offline map data for the selected region is downloaded and stored for use without internet.', 5);

-- Media Tasks
INSERT INTO tasks (name, prerequisites, expected_outcome, cuj_id) VALUES
('Connect smartphone via Bluetooth', 'Smartphone Bluetooth is enabled', 'Smartphone is successfully paired and audio can be streamed.', 6),
('Play music from connected smartphone', 'Smartphone is connected via Bluetooth or USB, Music app is open on the phone', 'Audio playback from the smartphone begins through the car speakers.', 7),
('Control music playback (play, pause, skip) using steering wheel controls', 'Music is playing from a connected device', 'Music playback is controlled according to the steering wheel button pressed.', 7),
('Browse music library on connected USB drive', 'USB drive with music files is connected', 'Media library from the USB drive is displayed and can be browsed.', 7),
('Adjust audio equalizer settings', 'Media system is active', 'Audio output is adjusted according to the equalizer settings.', 7),
('Listen to FM/AM radio', 'Vehicle is on, Infotainment system is powered on', 'Radio station is tuned and audio is played through the car speakers.', 8),
('Scan for available radio stations', 'Radio is active', 'Available radio stations are found and can be selected.', 8),
('Stream audio from a built-in music streaming service', 'Internet connectivity is available, User is logged into the streaming service', 'Audio from the streaming service begins playing through the car speakers.', 9),
('Browse and search the catalog of the built-in streaming service', 'Internet connectivity is available, User is logged into the streaming service', 'Streaming service catalog is displayed and can be browsed or searched.', 9),
('Control playback of rear-seat entertainment (if available)', 'Rear-seat entertainment system is active', 'Playback on the rear-seat displays is controlled from the front console.', 10);

-- Communications Tasks
INSERT INTO tasks (name, prerequisites, expected_outcome, cuj_id) VALUES
('Make a phone call using Bluetooth contacts', 'Smartphone is connected via Bluetooth, Contact information is synced', 'Phone call is initiated to the selected contact.', 11),
('Answer an incoming phone call', 'Smartphone is connected via Bluetooth, Incoming call is being received', 'Phone call is connected and audio is routed through the car speakers.', 11),
('End an ongoing phone call', 'Phone call is active', 'Phone call is terminated and the infotainment system returns to the previous state.', 11),
('View recent call history', 'Smartphone is connected via Bluetooth, Call history is synced', 'Recent call history is displayed and calls can be initiated from the list.', 11),
('Send a pre-defined text message', 'Smartphone is connected via Bluetooth', 'Text message is sent to the selected contact using a pre-defined template.', 12),
('Receive and view SMS messages', 'Smartphone is connected via Bluetooth, SMS permissions are enabled', 'Incoming SMS is displayed on the infotainment screen.', 12),
('Reply to an SMS message using voice commands', 'Smartphone is connected via Bluetooth, SMS permissions are enabled, Microphone is enabled', 'Voice input is converted to text and sent as an SMS reply.', 12),
('Initiate a voice assistant command (e.g., "Hey [Car Brand]")', 'Vehicle is on, Infotainment system is powered on, Microphone is enabled', 'Voice assistant is activated and ready to receive commands.', 13),
('Ask the voice assistant to make a call', 'Voice assistant is active, Smartphone is connected via Bluetooth', 'Voice assistant initiates a call to the specified contact.', 13);

-- General Tasks
INSERT INTO tasks (name, prerequisites, expected_outcome, cuj_id) VALUES
('Adjust the infotainment system volume', 'Infotainment system is active', 'System volume is adjusted to the desired level.', 14),
('Adjust the display brightness', 'Infotainment system is active', 'Display brightness is adjusted to the desired level.', 14),
('Navigate through the infotainment system menus', 'Infotainment system is active', 'User can successfully navigate the menu structure to reach desired functions.', 14);

-- Add reviewer assignments
INSERT INTO reviewer_assignments (category_id, car_id, reviewer_id, created_by)
VALUES 
(1, 1, 3, 1), -- Assign Tony (id=3) to Navigation category for Tesla Model 3
(2, 1, 4, 1); -- Assign Victor (id=4) to Media category for Tesla Model 3