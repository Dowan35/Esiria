// Ce programme combine les infos reçues par
//  mosquitto_sub -h localhost -t zigbee2mqtt/bridge/devices :
// "model_id":"TRADFRI motion sensor"
// "friendly_name":"0x14b457fffe64eecb"
// "model":"E1525/E1745"
// et les infos reçues par mqtt://localhost zigbee2mqtt/#
// pour construire et mettre a jour en temps reel une bdd des appareils connectés

// Pour lancer au demarrage : 
// sudo apt update
// sudo apt install nodejs npm -y
// sudo npm install -g pm2

// pm2 start devices_manager.js
// pm2 save
// pm2 startup

import mqtt from "mqtt";
import sqlite3 from "sqlite3";
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);  // obtenir le chemin du fichier actuel
const __dirname = dirname(__filename);  // obtenir le répertoire du fichier actuel

// --- Configs ---
const SQLITE_PATH = path.join(__dirname, 'devices_database.db');
const MQTT_BROKER = "mqtt://localhost";
const MQTT_TOPIC_ALL = "zigbee2mqtt/#";
const MQTT_TOPIC_DEVICES = "zigbee2mqtt/bridge/devices";

// --- Init SQLite ---
const db = new sqlite3.Database(SQLITE_PATH, err => {
    if (err) return console.error("SQLite error:", err.message);
    db.run(`
        CREATE TABLE IF NOT EXISTS devices (
            id TEXT PRIMARY KEY,
            device_name TEXT DEFAULT 'Unknown',
            description TEXT DEFAULT 'Unknown',
            last_action TEXT DEFAULT NULL,
            humidity REAL DEFAULT NULL,
            temperature REAL DEFAULT NULL,
            occupancy TEXT DEFAULT NULL,
            status TEXT DEFAULT NULL,
            brightness INTEGER DEFAULT NULL,
            battery INTEGER DEFAULT NULL
        )
    `, () => {
        console.log("Initialisation de la db...");
        initializeDevices(); // init de la db
    });
});

// --- Lecture MQTT devices ---
function initializeDevices() {
    fetchBridgeDevices()
        .then(mqttDevices => {
            const stmt = db.prepare(`INSERT OR IGNORE INTO devices (id, device_name, description) VALUES (?, ?, ?)`);
            mqttDevices.forEach(d => {
                const id = d.friendly_name;
                const name = d.model_id || "Unknown";
                const model = d.definition?.model || "Unknown";
                stmt.run(id, name, model);
            });
            stmt.finalize(err => {
                if (err) console.error("Erreur insertion initiale:", err);
                else console.log("Base initialisée avec les appareils détectés.");
                startLiveUpdates();
            });
        });
}

// --- Lecture MQTT des bridge/devices connectés---
function fetchBridgeDevices() {
    return new Promise(resolve => {
        const client = mqtt.connect(MQTT_BROKER);
        client.on("connect", () => {
            client.subscribe(MQTT_TOPIC_DEVICES, err => {
                if (err) return resolve([]);
            });
        });

        client.on("message", (topic, msg) => {
            if (topic === MQTT_TOPIC_DEVICES) {
                try {
                    const payload = JSON.parse(msg.toString());
                    client.end();
                    resolve(payload);
                } catch (e) {
                    console.error("Erreur parsing bridge/devices:", e);
                    client.end();
                    resolve([]);
                }
            }
        });

        setTimeout(() => {
            console.warn("Timeout MQTT bridge/devices");
            client.end();
            resolve([]);
        }, 3000);
    });
}

// --- Etape 3 : Mise à jour continue via MQTT ---
function startLiveUpdates() {
    const client = mqtt.connect(MQTT_BROKER);

    client.on("connect", () => {
        console.log("Connecté au broker MQTT.");
        client.subscribe(MQTT_TOPIC_ALL, err => {
            if (err) console.error("Erreur d'abonnement:", err);
        });
    });

    client.on("message", (topic, msg) => {
        const parts = topic.split("/");
        if (parts.length < 2 || parts[1] === "bridge") return;
        const deviceId = parts[1];

        let payload;
        try {
            payload = JSON.parse(msg.toString());
        } catch {
            return;
        }

        const { action, humidity, temperature, occupancy, state, brightness, battery } = payload;

        db.run(`
            UPDATE devices SET
                last_action = COALESCE(?, last_action),
                humidity = COALESCE(?, humidity),
                temperature = COALESCE(?, temperature),
                occupancy = COALESCE(?, occupancy),
                status = COALESCE(?, status),
                brightness = COALESCE(?, brightness),
                battery = COALESCE(?, battery)
            WHERE id = ?
        `, [action, humidity, temperature, String(occupancy), state, brightness, battery, deviceId], err => {
            if (err) console.error("Erreur mise à jour:", err);
            else console.log(`${deviceId} mis à jour`);
        });
    });

    client.on("error", err => console.error("MQTT error:", err));

    process.on("SIGINT", () => {
        console.log("Arrêt...");
        client.end();
        db.close();
        process.exit();
    });
}
