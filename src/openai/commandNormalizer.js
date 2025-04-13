//utilise openai pour normaliser les entrées user et les faire correspondre à commandes.json
//on peut ajuster le prompt.
import { OpenAI } from 'openai'; // Importation de la nouvelle version
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Charge .env depuis la racine du projet
dotenv.config({ path: join(__dirname, '../../.env') });


const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,  // Utilisation de la clé API depuis .env
});

// Exemple de fonction qui utilise OpenAI pour faire une complétion
async function getNormalizedCommand(input, commandes) {
  try {
    // Extraire seulement les questions à partir de commandes.json
    const questions = commandes
    .map((device) =>
        device.interactions.map((interaction) => interaction.question)
    )
    .flat();
    const prompt = `Commandes disponibles: ${JSON.stringify(questions)}\n\nQuestion utilisateur: "${input.question}"\n
    Trouve la commande disponible la plus similaire, et retourne seulement cela, rien d'autre sans guillemets.`;

    const response = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',  // Choix du modèle
      messages: [{ role: 'user', content: prompt }],
    });

    const normalizedQuestion = response.choices[0]?.message.content.trim();
    //console.log('Normalized Question:', normalizedQuestion);

    return { question: normalizedQuestion };
  } catch (error) {
    console.error("Erreur lors de la normalisation de la commande:", error);
    return { question: undefined };
  }
}

export {getNormalizedCommand}