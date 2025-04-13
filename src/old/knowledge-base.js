import { ChatOpenAI } from "@langchain/openai";
import weaviate from 'weaviate-ts-client';
import dotenv from 'dotenv';

dotenv.config();
 
//Configuration de Weaviate
const client = weaviate.client({
  scheme: 'http',
  host: 'localhost:8080', //Assure-toi que Weaviate fonctionne sur ce port
});

//Chargement du modèle LangChain (GPT-4 Mini)
const openAI = new ChatOpenAI({
  modelName: 'gpt-4-mini',
  apiKey: process.env.OPENAI_API_KEY,
});

//Fonction pour générer les embeddings avec LangChain
const getEmbeddings = async (passages) => {
  const embeddings = await openAI.embedDocuments(passages);
  return embeddings;
};

//Fonction pour trouver la meilleure correspondance
async function findBestMatch(query) {
  try {
    console.log(`Recherche pour : "${query}"`);

    //Utiliser LangChain pour obtenir l'embedding de la requête utilisateur
    const queryEmbedding = await getEmbeddings([query]);  // Nous passons ici une liste avec une seule requête

    //Requête à Weaviate pour trouver la correspondance la plus proche
    const response = await client.graphql
      .get()
      .withClassName('CommandeDomotique')
      .withFields('appareil question commandes _additional { distance }')
      .withNearVector({
        vector: queryEmbedding[0],  //L'embedding est retourné dans un tableau, nous récupérons le premier élément
        distance: 0.4,  //Ajuste cette valeur selon tes besoins
      })
      .withLimit(1)
      .do();

    const results = response.data.Get.CommandeDomotique;
    if (!results || results.length === 0) {
      console.log('Aucune correspondance trouvée.');
      return null;
    }

    const bestMatch = results[0];
    console.log('Meilleur match trouvé :', bestMatch);

    return {
      appareil: bestMatch.appareil,
      question: bestMatch.question,
      commandes: bestMatch.commandes,
    };
  } catch (error) {
    console.error('Erreur lors de la recherche :', error);
    return null;
  }
}

export { findBestMatch };
