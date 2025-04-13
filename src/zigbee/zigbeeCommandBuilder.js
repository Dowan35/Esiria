import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Pour pouvoir construire un chemin absolu depuis ce fichier
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Chargement du mapping des appareils Zigbee (id Zigbee <-> noms logiques)
const zigbeeMapping = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'zigbee_mapping.json'), 'utf-8')
);

function buildZigbeeCommand(nomAppareil, action, etat = null) {
  const deviceId = zigbeeMapping[nomAppareil];
  if (!deviceId) {
    console.error(`Appareil introuvable : ${nomAppareil}`);
    return null;
  }

  const topic = `zigbee2mqtt/${deviceId}/set`;

  const payloads = {
    etat: {
      ON: { state: "ON" },
      OFF: { state: "OFF" },
    }
  };

  if (action === "etat" && payloads.etat[etat]) {
    return { deviceId, topic, payload: payloads.etat[etat] };
  }

  console.error(`Action non prise en charge : ${action}`);
  return null;
}

export { buildZigbeeCommand };
