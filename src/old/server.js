import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import { askOpenAI, searchInWeaviate } from './index.js';
import { sendMqttCommand } from './mqtt-client.js';
import { runWeaviateSetup } from './weaviate-setup.js'; //Importation du module Weaviate

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static('public')); // Sert les fichiers statiques depuis le dossier 'public'

app.use((req, res, next) => {
  console.log("Requête reçue :", req.url);
  next();
});


// Endpoint : poser une question
app.post('/ask', async (req, res) => {
  const { question } = req.body;
  console.log('Question reçue :', question);

  try {
    const result = await searchInWeaviate(question);

    if (result && result._additional && result._additional.vector) {
      const doc = result; // Le document trouvé

      // Si une commande MQTT est disponible, on l’envoie
      if (doc.mqtt_topic && doc.payload) {
        sendMqttCommand(doc.mqtt_topic, doc.payload);  // Utilisation de sendMqttCommand avec CommonJS
      }

      // Répondre avec le texte prédéfini
      return res.json({ answer: doc.reponse || "Commande effectuée." });
    }

    // Sinon fallback vers GPT
    const gptAnswer = await askOpenAI(question);
    return res.json({ answer: `Commande non reconnue. GPT propose : ${gptAnswer}` });

  } catch (error) {
    console.error('Erreur dans /ask :', error);
    res.status(500).json({ error: 'Erreur lors du traitement' });
  }
});

// Lancer le setup de Weaviate au démarrage du serveur (création des classes et objets)
runWeaviateSetup()
  .then(() => console.log('Weaviate Setup effectué avec succès'))
  .catch(err => console.error('Erreur lors du setup de Weaviate :', err));

// Lancement du serveur

const port = 8081;
//const port = 8080;

app.listen(port, () => {
  console.log(`Serveur démarré sur http://localhost:${port}`);
});
