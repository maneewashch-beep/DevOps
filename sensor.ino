#include <WiFi.h>
#include <HTTPClient.h>
#include "DHT.h"

const char* ssid = "IT635";
const char* pass = "123456789";
const char* url  = "http://192.168.32.47:3000/api/data";

DHT dht(4, DHT22); 

void setup() {
  Serial.begin(115200); dht.begin(); WiFi.begin(ssid, pass);
  while (WiFi.status() != WL_CONNECTED) { delay(500); Serial.print("."); }
  Serial.printf("\nConnected! IP: %s\n", WiFi.localIP().toString().c_str());
}

void loop() {
  static unsigned long p = 0;
  if (millis() - p >= 5000) { 
    p = millis();
    float h = dht.readHumidity(), t = dht.readTemperature();

    if (isnan(h) || isnan(t)) { Serial.print("Failed to read DHT!"); return; }
    Serial.printf("Humidity: %.2f%%  Temperature: %.2f°C\n", h, t);

    if (WiFi.status() == WL_CONNECTED) {
      HTTPClient http; 
      http.begin(url); 
      http.addHeader("Content-Type", "application/json");
      
      int code = http.POST("{\"temperature\":" + String(t) + ",\"humidity\":" + String(h) + "}");     
      Serial.printf(code > 0 ? "Server Response code: %d\n%s\n" : "Error POST: %d\n", code, http.getString().c_str());  
      http.end();

    } else {
      Serial.println("WiFi Disconnected!");  
    }
  }
}