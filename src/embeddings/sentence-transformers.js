import axios from 'axios';
import huggingKey from '../ressources/hugging_key.json' assert { type: "json" };

const apiKey = huggingKey.HUGGING_FACE_API_KEY;

async function getEmbeddings(passages) {
  try {
    const response = await axios.post(
      'https://api-inference.huggingface.co/pipeline/feature-extraction/sentence-transformers/all-MiniLM-L6-v2',
      passages, // tableau directement ici, sans "inputs"
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      }
    );

    // L'API retourne soit un seul vecteur, soit une liste de vecteurs
    const data = response.data;
    return Array.isArray(data[0]) ? data : [data];

  } catch (error) {
    //console.error("Erreur lors de l'obtention des embeddings");
    console.error("Erreur lors de l'obtention des embeddings : ", error.response?.data || error);
    //throw error;
  }
}

export { getEmbeddings };

