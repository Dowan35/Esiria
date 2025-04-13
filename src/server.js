import fs from 'fs';
import express from 'express';
import cors from 'cors';
import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { getEmbeddings } from './embeddings/sentence-transformers.js';
import { storeEmbeddings, searchCommand, getDatabase } from './weaviate/weaviate-client.js';
import { buildZigbeeCommand } from './zigbee/zigbeeCommandBuilder.js';
import { sendMqttCommand } from './mqtt/mqtt-client.js';
import { getNormalizedCommand } from './openai/commandNormalizer.js'
import commandes from './ressources/commandes.json' assert { type: "json" };

const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Chargement du mapping des appareils Zigbee (id Zigbee <-> noms logiques)
const zigbeeMapping = JSON.parse(
  fs.readFileSync(path.join(__dirname, './zigbee/zigbee_mapping.json'), 'utf-8')
);

// Chargement de la db
const db = new sqlite3.Database(path.join(__dirname, './database/devices_database.db'));

app.use(cors({origin: '*',  // Cela permet à toutes les origines d'accéder à l'API
}));
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public', 'home.html'));
});

await storeEmbeddings(commandes,true);//true pour supprimer les anciennes commandes et les remplacer par les nouvelles
//console.log("Commandes stockées dans Weaviate: ", await getDatabase());

app.post('/ask', async (req, res) => {
  console.log('\nRequête reçue:', req.body);
  //const { question } = req.body;
  const { question } = await getNormalizedCommand(req.body, commandes)// normalisation avec l'aide d'openAi
  console.log("Reponse OpenAI :", question);
  try {
    const [embedding] = await getEmbeddings(question);
    const doc = await searchCommand(embedding);
    if (!doc) return res.json({ answer: "Commande non reconnue." });

    console.log("Résultat de la recherche :", doc);

    const commande = JSON.parse(doc.commande); // action, etat, reponse stockés  dans une string, on la parse en json pour les recuperer
    
    const appareil = doc.appareil;// recupere le nom configuré dans ./ressources/commandes.json
    const action = commande.action;
    const etat = commande.etat || null;

    //si on veut controler un appareil
    if (action === 'etat') {
      console.log("Action détéctée");
      const cmd = buildZigbeeCommand(appareil, action, etat);// fait correspondre le nom a l'id grace a zigbee_mapping.json
      if (cmd) sendMqttCommand(cmd.topic, cmd.payload);
      return res.json({ answer: commande.reponse });
    }

    // si on veut avoir des données de la DB
    else if (["lire_temperature", "lire_humidite", "etat_recherche", "lire_mouvement", "lire_luminosite"].includes(action)) {
      console.log("Question détéctée");
      const query = `SELECT * FROM devices WHERE id = ?`;
      const deviceId = zigbeeMapping[appareil]; // retrouver l'id du device grace au mapping
      console.log(appareil, ' : ',deviceId , ' : ', action);
      db.get(query, deviceId, (err, row) => {
        if (err){return res.json({ answer: `Erreur bdd: ${err}`})} else if(!row){ return res.json({ answer: "Appareil non trouvé." })};

        let value;
        switch (action) {
          case "lire_temperature":
            value = `${commande.reponse} ${row.temperature}°C`;
            break;
          case "lire_humidite":
            value = `${commande.reponse} ${row.humidity}%`;
            break;
          case "etat_recherche":
            value = `${commande.reponse} ${row.status}`;
            break;
          case "lire_mouvement":
            value = `${commande.reponse} ${row.occupancy}`;
            break;
          case "lire_luminosite":
            value = `${commande.reponse} ${row.brightness}`;
            break;
        }
        return res.json({ answer: value });
      });
    } else {
      res.json({ answer: "Action inconnue." });
    }

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

const port = 8081;
app.listen(port, '0.0.0.0', () => console.log(`Serveur démarré sur http://0.0.0.0:${port}`));
