#include <ESP8266WiFi.h>
#include <ESP8266WebServer.h>
#include <EEPROM.h>
#include <FirebaseESP8266.h>
#include <addons/TokenHelper.h>  // For tokenStatusCallback

// -------------------------
// Definitions and Constants
// -------------------------
#define EEPROM_SIZE 512           // Total EEPROM size available
#define FLAG_ADDR 450             // EEPROM flag address
#define FLAG_VALUE 0xAA           // Value indicating valid configuration exists

// Pin assignments
#define SSR_PIN 3                 // GPIO3 for SSR control
#define BUTTON_PIN 2              // GPIO2 for toggle switch input
#define LED_PIN 4                 // GPIO4 for LED indicator

// EEPROM Storage Addresses:
//  0 -  99: SSID
// 100 - 199: WiFi Password
// 200 - 299: Device Name
// 300 - ...: User UID  (new!)

// Firebase Credentials
#define API_KEY "AIzaSyAz4af9x1vMIL379tvFyrMU_GQXGQpm5Tw"
#define DATABASE_URL "https://motor-pump-control-default-rtdb.asia-southeast1.firebasedatabase.app"

// -------------------------
// Globals
// -------------------------
ESP8266WebServer server(80);
FirebaseData fbdo;
FirebaseAuth auth;
FirebaseConfig config;

String deviceID;         // Unique ID from chip
String storedSSID, storedPass, storedName, storedUID;
bool credentialsExist = false;

// Firebase device path: /users/<storedUID>/devices/<storedName>
String devicePath = "";
int localSwitchState = 0;

// Timer-related globals
bool timerActive = false;
unsigned long timerStartMillis = 0;
unsigned long timerDurationMillis = 0;   // in milliseconds

// -------------------------
// Button Debounce Variables
// -------------------------
bool lastButtonReading = HIGH;
bool lastStableButtonState = HIGH;
unsigned long lastDebounceTime = 0;
const unsigned long debounceDelay = 50;

// -------------------------
// Heartbeat Variables
// -------------------------
unsigned long lastHeartbeatSent = 0;

// -------------------------
// EEPROM Helper Functions
// -------------------------
void writeStringToEEPROM(int addr, const String &data) {
  int len = data.length();
  for (int i = 0; i < len; i++) {
    EEPROM.write(addr + i, data[i]);
  }
  EEPROM.write(addr + len, 0);  // Null terminator
}

String readStringFromEEPROM(int addr) {
  String data = "";
  while (true) {
    char ch = EEPROM.read(addr);
    if (ch == 0) break;
    data += ch;
    addr++;
    if (addr >= EEPROM_SIZE) break;
  }
  return data;
}

// -------------------------
// Load credentials (SSID, Password, Device Name, UID)
// -------------------------
void loadCredentials() {
  EEPROM.begin(EEPROM_SIZE);
  byte flag = EEPROM.read(FLAG_ADDR);
  if (flag == FLAG_VALUE) {
    storedSSID = readStringFromEEPROM(0);
    storedPass = readStringFromEEPROM(100);
    storedName = readStringFromEEPROM(200);
    storedUID  = readStringFromEEPROM(300);
    storedName.trim();
    storedUID.trim();
    credentialsExist = true;
    Serial.println("Loaded credentials from EEPROM:");
    Serial.println("SSID: " + storedSSID);
    Serial.println("WiFi Password: " + storedPass);
    Serial.println("Device Name: " + storedName);
    Serial.println("User UID: " + storedUID);
  } else {
    credentialsExist = false;
    Serial.println("No credentials found in EEPROM.");
  }
}

// -------------------------
// AP Mode: Configuration Page (includes UID field)
// -------------------------
void handleRoot() {
  String html = "<!DOCTYPE html><html><head><meta charset='utf-8'><title>ESP-01 Configuration</title></head><body>";
  html += "<h2>Configure Your Device</h2>";
  html += "<p>Device ID: " + deviceID + "</p>";
  html += "<form action='/submit' method='POST'>";
  html += "SSID: <input type='text' name='ssid'><br><br>";
  html += "WiFi Password: <input type='password' name='wifi_pass'><br><br>";
  html += "Device Name: <input type='text' name='device_name'><br><br>";
  html += "User UID: <input type='text' name='uid'><br><br>";
  html += "<input type='submit' value='Submit'>";
  html += "</form></body></html>";
  server.send(200, "text/html", html);
}

void handleSubmit() {
  if (server.hasArg("ssid") && server.hasArg("wifi_pass") &&
      server.hasArg("device_name") && server.hasArg("uid")) {
    String ssid = server.arg("ssid");
    String wifiPass = server.arg("wifi_pass");
    String deviceName = server.arg("device_name");
    String uid = server.arg("uid");
    
    Serial.println("Configuration received:");
    Serial.println("SSID: " + ssid);
    Serial.println("WiFi Password: " + wifiPass);
    Serial.println("Device Name: " + deviceName);
    Serial.println("User UID: " + uid);
    
    writeStringToEEPROM(0, ssid);
    writeStringToEEPROM(100, wifiPass);
    writeStringToEEPROM(200, deviceName);
    writeStringToEEPROM(300, uid);
    EEPROM.write(FLAG_ADDR, FLAG_VALUE);
    EEPROM.commit();
    
    String response = "<html><body><h3>Configuration Saved!</h3><p>Device will restart in STA mode.</p></body></html>";
    server.send(200, "text/html", response);
    delay(3000);
    ESP.restart();
  } else {
    server.send(400, "text/html", "Missing parameters. Please fill out all fields.");
  }
}

void setupAPMode() {
  WiFi.mode(WIFI_AP);
  WiFi.softAP("TRC_IoT_Config", "");
  Serial.print("AP IP address: ");
  Serial.println(WiFi.softAPIP());
  
  server.on("/", HTTP_GET, handleRoot);
  server.on("/submit", HTTP_POST, handleSubmit);
  server.begin();
  Serial.println("HTTP server started for configuration (AP mode).");
}

// -------------------------
// STA Mode: Connect to WiFi, initialize Firebase, and register device node
// -------------------------
void setupSTAMode() {
  WiFi.mode(WIFI_STA);
  Serial.println("Connecting to WiFi with the following credentials:");
  Serial.println("SSID: " + storedSSID);
  Serial.println("WiFi Password: " + storedPass);
  WiFi.begin(storedSSID.c_str(), storedPass.c_str());
  int count = 0;
  Serial.print("Connecting to WiFi ");
  while (WiFi.status() != WL_CONNECTED && count < 200) {
    delay(500);
    Serial.print(".");
    count++;
  }
  Serial.println();
  
  if (WiFi.status() == WL_CONNECTED) {
    Serial.print("Connected! IP address: ");
    Serial.println(WiFi.localIP());
    
    // Blink LED to indicate connection success
    pinMode(LED_PIN, OUTPUT);
    for (int i = 0; i < 5; i++) {
      digitalWrite(LED_PIN, LOW);
      delay(200);
      digitalWrite(LED_PIN, HIGH);
      delay(200);
    }
    
    // Build device path: /users/<UID>/devices/<DeviceName>
    devicePath = "/users/" + storedUID + "/devices/" + storedName;
    Serial.println("Firebase device path: " + devicePath);
    
    // -------------------------
    // Firebase Configuration
    // -------------------------
    config.api_key = API_KEY;
    config.database_url = DATABASE_URL;
    config.host = "motor-pump-control-default-rtdb.asia-southeast1.firebasedatabase.app";
    auth.user.email = "swdha@gmail.in";
    auth.user.password = "SWADHAMYMAU";
    config.token_status_callback = tokenStatusCallback;
    
    Firebase.begin(&config, &auth);
    Firebase.reconnectWiFi(true);
    delay(2000);
    
    // Initialize device node with default values
    if (Firebase.setInt(fbdo, devicePath + "/switch", 0)) {
      Serial.println("Default switch state set to 0.");
      localSwitchState = 0;
    } else {
      Serial.println("Failed to set default switch state: " + fbdo.errorReason());
    }
    if (Firebase.setInt(fbdo, devicePath + "/reset", 0)) {
      Serial.println("Default reset state set to 0.");
    } else {
      Serial.println("Failed to set default reset state: " + fbdo.errorReason());
    }
    if (Firebase.setInt(fbdo, devicePath + "/switchFeedback", 0)) {
      Serial.println("Default switchFeedback set to 0.");
    } else {
      Serial.println("Failed to set default switchFeedback: " + fbdo.errorReason());
    }
    // Initialize Timer defaults
    if (Firebase.setInt(fbdo, devicePath + "/timer", 0)) {
      Serial.println("Default timer flag set to 0.");
    } else {
      Serial.println("Failed to set default timer flag: " + fbdo.errorReason());
    }
    if (Firebase.setInt(fbdo, devicePath + "/timerDuration", 1)) {
      Serial.println("Default timer duration set to 1 minute.");
    } else {
      Serial.println("Failed to set default timer duration: " + fbdo.errorReason());
    }
    if (Firebase.setInt(fbdo, devicePath + "/timerFeedback", 0)) {
      Serial.println("Default timer feedback set to 0.");
    } else {
      Serial.println("Failed to set default timer feedback: " + fbdo.errorReason());
    }
    
  } else {
    Serial.println("Failed to connect to WiFi. Restarting in AP mode.");
    EEPROM.write(FLAG_ADDR, 0x00);
    EEPROM.commit();
    ESP.restart();
  }
}

// -------------------------
// Factory Reset: Clear EEPROM and remove device node from Firebase
// -------------------------
void factoryReset() {
  Serial.println("Factory reset triggered. Clearing credentials and removing device node from Firebase.");
  if (Firebase.deleteNode(fbdo, devicePath)) {
    Serial.println("Device node removed from Firebase.");
  } else {
    Serial.println("Failed to remove device node: " + fbdo.errorReason());
  }
  EEPROM.write(FLAG_ADDR, 0x00);
  EEPROM.commit();
  ESP.restart();
}

// -------------------------
// Setup: Decide AP or STA mode based on EEPROM flag
// -------------------------
void setup() {
  Serial.begin(115200);
  deviceID = String(ESP.getChipId());
  Serial.println("Device ID: " + deviceID);
  loadCredentials();
  
  pinMode(SSR_PIN, OUTPUT);
  digitalWrite(SSR_PIN, LOW);
  pinMode(BUTTON_PIN, INPUT_PULLUP);
  
  // Seed random generator for heartbeat
  randomSeed(analogRead(0));
  
  if (credentialsExist) {
    Serial.println("Credentials found. Starting in STA mode.");
    setupSTAMode();
  } else {
    Serial.println("No valid credentials. Starting in AP mode for configuration.");
    setupAPMode();
  }
}

// -------------------------
// Loop: Monitor button, poll Firebase, update heartbeat, and update switch & timer feedback
// -------------------------
void loop() {
  if (!credentialsExist) {
    server.handleClient();
  } else {
    // --- Button Monitoring Section (physical toggle) ---
    bool currentReading = digitalRead(BUTTON_PIN);
    if (currentReading != lastButtonReading) {
      lastDebounceTime = millis();
    }
    if ((millis() - lastDebounceTime) > debounceDelay) {
      if (currentReading != lastStableButtonState) {
        lastStableButtonState = currentReading;
        localSwitchState = (localSwitchState == 0) ? 1 : 0;
        if (Firebase.setInt(fbdo, devicePath + "/switch", localSwitchState)) {
          Serial.print("Toggle switch event detected. New switch state: ");
          Serial.println(localSwitchState);
          // Update switchFeedback as well
          if (Firebase.setInt(fbdo, devicePath + "/switchFeedback", localSwitchState)) {
            Serial.print("Switch feedback updated to: ");
            Serial.println(localSwitchState);
          } else {
            Serial.print("Failed to update switch feedback: ");
            Serial.println(fbdo.errorReason());
          }
          digitalWrite(SSR_PIN, (localSwitchState == 1 ? HIGH : LOW));
          // If switch turned off manually, cancel any running timer
          if(localSwitchState == 0 && timerActive) {
            timerActive = false;
            Firebase.setInt(fbdo, devicePath + "/timerFeedback", 0);
            Serial.println("Switch turned off manually, timer canceled.");
          }
        } else {
          Serial.print("Failed to update Firebase from toggle event: ");
          Serial.println(fbdo.errorReason());
        }
      }
    }
    lastButtonReading = currentReading;
  
    // --- Firebase Polling Section ---
    if (Firebase.ready()) {
      // Poll for external switch update
      if (Firebase.getInt(fbdo, devicePath + "/switch")) {
        int fetchedSwitchState = fbdo.intData();
        if (fetchedSwitchState != localSwitchState) {
          localSwitchState = fetchedSwitchState;
          Serial.print("Firebase switch state updated to: ");
          Serial.println(localSwitchState);
          digitalWrite(SSR_PIN, (localSwitchState == 1 ? HIGH : LOW));
          if (Firebase.setInt(fbdo, devicePath + "/switchFeedback", localSwitchState)) {
            Serial.print("Switch feedback updated to: ");
            Serial.println(localSwitchState);
          } else {
            Serial.print("Failed to update switch feedback: ");
            Serial.println(fbdo.errorReason());
          }
        }
      } else {
        Serial.println("Failed to get switch value: " + fbdo.errorReason());
      }
      
      // Poll for reset command
      if (Firebase.getInt(fbdo, devicePath + "/reset")) {
        int resetState = fbdo.intData();
        Serial.print("Reset state from Firebase: ");
        Serial.println(resetState);
        if (resetState == 1) {
          factoryReset();
        }
      } else {
        Serial.println("Failed to get reset value: " + fbdo.errorReason());
      }
      
      // --- Timer Mode Section ---
      if (Firebase.getInt(fbdo, devicePath + "/timer")) {
        int firebaseTimerFlag = fbdo.intData();
        if (firebaseTimerFlag == 1 && localSwitchState == 1) {
          // Read timer duration (in minutes)
          if (Firebase.getInt(fbdo, devicePath + "/timerDuration")) {
            int timerMinutes = fbdo.intData();
            if (!timerActive) {
              timerDurationMillis = timerMinutes * 60000UL;
              timerStartMillis = millis();
              timerActive = true;
              Serial.print("Timer started for ");
              Serial.print(timerMinutes);
              Serial.println(" minute(s).");
            }
          } else {
            Serial.println("Failed to get timerDuration: " + fbdo.errorReason());
          }
        } else {
          // Either timer flag is disabled or switch is off so cancel timer if running
          if (timerActive) {
            timerActive = false;
            Firebase.setInt(fbdo, devicePath + "/timerFeedback", 0);
            Serial.println("Timer mode deactivated or switch off; timer canceled.");
          }
        }
      
        // Update timer feedback if timer is running
        if (timerActive) {
          unsigned long elapsed = millis() - timerStartMillis;
          if (elapsed >= timerDurationMillis) {
            // Timer expired: turn off switch and reset timer
            localSwitchState = 0;
            digitalWrite(SSR_PIN, LOW);
            if (Firebase.setInt(fbdo, devicePath + "/switch", 0)) {
              Serial.println("Timer expired: Switch turned off.");
            } else {
              Serial.println("Failed to update switch after timer expiry: " + fbdo.errorReason());
            }
            Firebase.setInt(fbdo, devicePath + "/switchFeedback", 0);
            timerActive = false;
            Firebase.setInt(fbdo, devicePath + "/timerFeedback", 0);
          } else {
            unsigned long remaining = timerDurationMillis - elapsed;
            int remainingSeconds = remaining / 1000;
            if (Firebase.setInt(fbdo, devicePath + "/timerFeedback", remainingSeconds)) {
              Serial.print("Timer feedback updated: ");
              Serial.println(remainingSeconds);
            } else {
              Serial.println("Failed to update timerFeedback: " + fbdo.errorReason());
            }
          }
        }
      } else {
        Serial.println("Failed to get timer flag: " + fbdo.errorReason());
      }
      
      // --- Heartbeat (Alive) Update Section ---
      if (Firebase.ready() && (millis() - lastHeartbeatSent > 3000)) {
        lastHeartbeatSent = millis();
        int heartbeat = random(1000, 10000);  // Generate a random 4-digit number
        if (Firebase.setInt(fbdo, devicePath + "/alive", heartbeat)) {
          Serial.print("Heartbeat updated: ");
          Serial.println(heartbeat);
        } else {
          Serial.print("Failed to update heartbeat: ");
          Serial.println(fbdo.errorReason());
        }
      }
    }
    delay(500);
  }
}
