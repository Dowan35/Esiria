//ce programme prend en compte la base merged_devices, et les infos mqtt reçues,
// et crée une nouvelle base devices_database avec ces infos mises a jour.
// contient id	device_name	description	last_action	humidity	temperature	occupancy	led_state	brightness	battery
const mqtt = require("mqtt");
const sqlite3 = require("sqlite3").verbose();
const fs = require("fs");

// --- Configuration ---
const MQTT_BROKER = "mqtt://localhost";
const MQTT_TOPIC = "zigbee2mqtt/#"; // Écoute tous les messages
const DATABASE_FILE = "devices_database.db";
const DEVICES_FILE = "./output/merged_devices.db";

// --- Connexion à SQLite ---
const db = new sqlite3.Database(DATABASE_FILE, (err) => {
    if (err) console.error("Erreur SQLite:", err.message);
    else console.log("Base de données SQLite ouverte.");
});

// Création de la table devices dans devices_database si elle n'existe pas
db.run(`
    CREATE TABLE IF NOT EXISTS devices (
        id TEXT PRIMARY KEY,
        device_name TEXT DEFAULT 'Unknown',
        description TEXT DEFAULT 'Unknown',
        last_action TEXT DEFAULT NULL,
        humidity REAL DEFAULT NULL,
        temperature REAL DEFAULT NULL,
        occupancy TEXT DEFAULT NULL,
        led_state TEXT DEFAULT NULL,
        brightness INTEGER DEFAULT NULL,
        battery INTEGER DEFAULT NULL
    )
`, () => {
    console.log("Table 'devices' prête.");
    initializeDatabase();
});

// --- Initialisation de la base devices_database.db depuis merged_devices.db ---
function initializeDatabase() {
    if (!fs.existsSync(DEVICES_FILE)) {
        console.error("Fichier merged_devices.db introuvable !");
        return;
    }

    const fileContent = fs.readFileSync(DEVICES_FILE, "utf-8").trim();
    const devices = fileContent.split("\n").map(line => JSON.parse(line));
    
     // Étape 1: Récupérer tous les ID des appareils dans la base de données
     db.all("SELECT id FROM devices", (err, rows) => {
        if (err) {
            console.error("Erreur récupération des appareils existants:", err);
            return;
        }

        const existingDeviceIds = rows.map(row => row.id);  // Tableau des IDs existants

        // Étape 2: Ajouter les appareils qui ne sont pas encore présents dans la base
        const newDevices = devices.filter(device => !existingDeviceIds.includes(device.id));
        //const updates = devices.filter(device => existingDeviceIds.includes(device.id));

        // Ajouter les nouveaux appareils
        db.serialize(() => {
            newDevices.forEach(device => {
                db.run(
                    `INSERT INTO devices (id, device_name, description) VALUES (?, ?, ?)`,
                    [device.id, device.deviceName, device.description],
                    (err) => {
                        if (err) console.error("Erreur insertion SQLite:", err);
                        else console.log(`Nouvel appareil ajouté : ${device.id}`);
                    }
                );
            });
        });
    });
}

// --- Connexion au broker MQTT ---
const client = mqtt.connect(MQTT_BROKER);

client.on("connect", () => {
    console.log("Connecté au broker MQTT");
    client.subscribe(MQTT_TOPIC, (err) => {
        if (err) console.error("Erreur d'abonnement:", err);
    });
});

// --- Fonction de mise à jour des appareils ---
function updateDeviceData(deviceId, data) {
    const { action, humidity, temperature, occupancy, state, brightness, battery } = data;

    db.run(`
        UPDATE devices SET 
            last_action = COALESCE(?, last_action),
            humidity = COALESCE(?, humidity),
            temperature = COALESCE(?, temperature),
            occupancy = COALESCE(?, occupancy),
            led_state = COALESCE(?, led_state),
            brightness = COALESCE(?, brightness),
            battery = COALESCE(?, battery)
        WHERE id = ?
    `, [action, humidity, temperature, String(occupancy), state, brightness, battery, deviceId], (err) => {
        if (err) console.error("Erreur mise à jour SQLite:", err.message);
        else console.log(`Mise à jour : ${deviceId}`);
    });
}

// --- Écoute des messages MQTT pour mettre a jour les données des appareils---
client.on("message", (topic, message) => {
    try {
        // Vérifiez si le message est un JSON valide
        let payload;
        try {
            payload = JSON.parse(message.toString());
        } catch (jsonError) {
            // Si le message n'est pas un JSON valide, loggez et ignorez-le
            console.error(`Message non JSON reçu sur le sujet ${topic}:`, message.toString());
            return; // Ignore le message non JSON
        }

        const topicParts = topic.split("/");

        if (topicParts.length >= 2 && topicParts[1] !== "bridge") {
            const deviceId = topicParts[1];
            updateDeviceData(deviceId, payload);
        }
    } catch (error) {
        console.error("Erreur traitement message MQTT:", error);
    }
});


// --- Gestion des erreurs MQTT ---
client.on("error", (error) => {
    console.error("Erreur MQTT:", error);
});

// --- Fermeture propre lors de l'arrêt ---
process.on("SIGINT", () => {
    console.log("Arrêt du script...");
    client.end();
    db.close();
    process.exit();
});
