// pour activer la memorisation de messages, on update sudo nano /opt/zigbee2mqtt/data/configuration.yaml
// et on met 
// device_options:
//     retain: true
// on check le dernier message reçu avec
// mosquitto_sub -h localhost -t "zigbee2mqtt/0x14b457fffe64eecb" -C 1


//ce code ecoute zigbee2mqtt et update la base en fonction des données recues pour le capteur de mouvement.

const sqlite3 = require('sqlite3').verbose();
const mqtt = require('mqtt');

const mqttBroker = 'mqtt://localhost';
const dbPath = 'zigbee_states.db';

// Connexion à SQLite
const db = new sqlite3.Database(dbPath);
db.run(`CREATE TABLE IF NOT EXISTS device_states (
    id TEXT PRIMARY KEY,
    occupancy BOOLEAN,
    battery INTEGER,
    linkquality INTEGER,
    lastUpdated TEXT
)`);

// Connexion à MQTT
const client = mqtt.connect(mqttBroker);
client.on('connect', () => {
    console.log("🔗 Connecté à MQTT, écoute des capteurs...");
    client.subscribe('zigbee2mqtt/+');
});

client.on('message', (topic, message) => {
    try {
        const deviceId = topic.split('/')[1];
        const data = JSON.parse(message.toString());

        const occupancy = data.occupancy ?? null;
        const battery = data.battery ?? null;
        const linkquality = data.linkquality ?? null;
        const lastUpdated = new Date().toISOString();

        db.run(`INSERT INTO device_states (id, occupancy, battery, linkquality, lastUpdated)
                VALUES (?, ?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET 
                    occupancy = excluded.occupancy,
                    battery = excluded.battery,
                    linkquality = excluded.linkquality,
                    lastUpdated = excluded.lastUpdated`,
            [deviceId, occupancy, battery, linkquality, lastUpdated]
        );

        console.log(`💾 Mise à jour de ${deviceId} enregistrée dans SQLite`);

    } catch (error) {
        console.error("Erreur de parsing JSON :", error.message);
    }
});
