// src/ressources/sentence_to_embeddings.js
import OpenAI from "openai";
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Charge .env depuis la racine du projet
dotenv.config({ path: join(__dirname, '../../.env') });

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

/**
 * Génère des embeddings pour une liste de phrases via OpenAI.
 * @param {string[]} sentences
 * @returns {Promise<number[][]>}
 */
export default async function getEmbeddings(sentences) {
  try {
    const response = await openai.embeddings.create({
      model: "text-embedding-ada-002",
      input: sentences
    });
    // response.data est un tableau d'objets { embedding: number[] }
    return response.data.map(item => item.embedding);
  } catch (err) {
    console.error("Erreur OpenAI embeddings:", err.message);
    // Renvoie un tableau de vecteurs vides en fallback
    return sentences.map(() => []);
  }
}
