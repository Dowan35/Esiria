import { OpenAIEmbeddings } from "@langchain/openai";
import weaviate from 'weaviate-ts-client';
import dotenv from 'dotenv';
import OpenAI from "openai";

dotenv.config({ path: './ressources/key.env' });

// OpenAI avec OpenRouter
const openai = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENAI_API_KEY,
});

// Client Weaviate
const client = weaviate.client({
  scheme: 'http',
  host: 'localhost:8080',
});

// Embeddings
const embeddingsModel = new OpenAIEmbeddings({
  openAIApiKey: process.env.OPENAI_API_KEY,
});

// Recherche dans toutes les classes dynamiques
export const searchInWeaviate = async (question) => {
  try {
    const schema = await client.schema.get();
    const allClasses = schema.classes.map(c => c.class);

    for (const className of allClasses) {
      const result = await client.graphql
        .get()
        .withClassName(className)
        .withFields("question action mqtt_topic payload reponse _additional {certainty}")
        .withNearText({ concepts: [question] })
        .withLimit(1)
        .do();

      const data = result.data.Get[className];
      if (data && data.length > 0) {
        return data[0]; // On retourne dès qu'on trouve un résultat
      }
    }

    return null; // Aucun résultat trouvé dans toutes les classes
  } catch (error) {
    console.error("Erreur lors de la recherche Weaviate :", error);
    return null;
  }
};

//Appel à OpenAI en fallback
export async function askOpenAI(question) {
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: question }],
    });

    return response.choices[0].message.content;
  } catch (error) {
    console.error('Erreur lors de l\'interrogation d\'OpenAI:', error);
    throw new Error('Erreur OpenAI');
  }
}
