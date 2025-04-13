// ce programme fusionne les données de /opt/zigbee2mqtt/data/database.db pour obtenir l'id et la description ("ieeeAddr"<->id, "modelId"<->description)
// et de la commande mosquitto_sub -h localhost -t zigbee2mqtt/bridge/devices pour avoir "model"<->device_name.
// pour creer une nouvelle base merged_device avec les 3 infos reunies
const fs = require('fs');
const mqtt = require('mqtt');

const dbPath = '/opt/zigbee2mqtt/data/database.db';
const mergedDbPath = './output/merged_devices.db'; //chemin vers fichier créé
const mqttBroker = 'mqtt://localhost';

// Lire la base locale
function readDb() {
    if (!fs.existsSync(dbPath)) {
        console.warn("Fichier database.db introuvable.");
        return {};
    }

    const data = fs.readFileSync(dbPath, 'utf8');
    const devices = data.split('\n')
        .filter(line => line.trim() !== '') // Supprime les lignes vides
        .map(line => JSON.parse(line)); // Convertit en JSON

    return devices.reduce((acc, d) => {
        if (d.ieeeAddr && d.modelId) {
            acc[d.ieeeAddr] = d.modelId; // Stocke le modelId pour l'identifier
        }
        return acc;
    }, {});
}

// Écouter MQTT et comparer les données
async function getDevices() {
    return new Promise((resolve, reject) => {
        const client = mqtt.connect(mqttBroker);
        const dbDevices = readDb();
        const mergedDevices = {};

        client.on('connect', () => {
            console.log('Connecté à MQTT, attente des données...');
            client.subscribe('zigbee2mqtt/bridge/devices');
        });

        client.on('message', (topic, message) => {
            if (topic === 'zigbee2mqtt/bridge/devices') {
                try {
                    const mqttDevices = JSON.parse(message.toString());

                    mqttDevices.forEach(d => {
                        const id = d.ieee_address;
                        const deviceName = d.definition?.model;

                        if (id && deviceName) {
                            mergedDevices[id] = {
                                id,
                                deviceName,
                                description: dbDevices[id] || ""
                            };
                        }
                    });

                    // Ajouter les appareils présents uniquement en DB
                    Object.keys(dbDevices).forEach(id => {
                        if (!mergedDevices[id]) {
                            mergedDevices[id] = {
                                id,
                                description: dbDevices[id]
                            };
                        }
                    });

                    console.log("Données reçues, fermeture de MQTT...");
                    client.end();
                    resolve(mergedDevices);
                } catch (error) {
                    reject("Erreur de parsing JSON MQTT : " + error);
                }
            }
        });

        client.on('error', err => {
            reject("Erreur MQTT : " + err);
        });
    });
}

// Sauvegarde dans merged_devices.db
function save(devices, append = false) {
    try {
        const dataToSave = Object.values(devices)
            .map(d => JSON.stringify(d))
            .join('\n');

        fs.writeFileSync(mergedDbPath, dataToSave, 'utf8');

        const writeMode = append ? { flag: 'a' } : {}; // 'a' pour append, sinon écrase
        fs.writeFileSync(mergedDbPath, dataToSave, { encoding: 'utf8', ...writeMode });

        console.log(`Appareils ${append ? 'ajoutés à' : 'enregistrés dans'} ${mergedDbPath} :\n${dataToSave}`);
    

    } catch (e) {
        throw `Merci de fournir une liste d'appareils à la fonction save() : ${e}`;
    }
}

module.exports = {
    getDevices,
    save
};
