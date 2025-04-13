// weaviate-client.js
import { getEmbeddings } from '../embeddings/sentence-transformers.js';
import weaviate from "weaviate-ts-client";
import commandes from '../ressources/commandes.json' assert { type: "json" };
import weaviateSchema from '../ressources/weaviate_schema.json' assert { type: "json" };

const client = weaviate.client({
  scheme: 'http',
  host: 'localhost:8080', // Adresse de ton instance Weaviate
});
// initialiser la classe dans Weaviate
async function initSchema(schema) {
  const schemaRes = await client.schema.classCreator()
  .withClass(schema)
  .do();

  console.log('Classe "Commande" créée dans Weaviate.');
  return schemaRes;
}

// verifier quon cree pas deux fois la meme
async function ensureSchema(givenSchema) {
  const schema = await client.schema.getter().do();
  const exists = schema.classes.some(cls => cls.class === 'Commande');
  if (!exists) {
    await initSchema(givenSchema);
  } else {
    console.log('Classe "Commande" déjà existante.');
  }
}


async function buildFlatList(data) {
  const flat = [];

  for (const appareil of data) {
    for (const interaction of appareil.interactions) {
      flat.push({
        question: interaction.question,
        appareil: appareil.appareil,
        commande: interaction.commande
      });
    }
  }

  return flat;
}

async function storeEmbeddings(commands) {
  await ensureSchema(weaviateSchema);

  console.log("Génération des embeddings...");
  const flatData = await buildFlatList(commands);
  const questions = flatData.map(item => item.question);
  var embeddings;
  try {
    embeddings = await getEmbeddings(questions);// doit retourner un tableau de vecteurs
  } catch (err) {
    console.error("Erreur lors de l'obtention des embeddings :", err.message);
    return;
  }

  console.log("Stockage dans Weaviate...");

  for (let i = 0; i < flatData.length; i++) {
    try {
      await client.data
        .creator()
        .withClassName('Commande') // Classe définie dans Weaviate
        .withProperties({
          question: flatData[i].question,
          appareil: flatData[i].appareil,
          commande: flatData[i].commande,
        })
        .withVector(embeddings[i])
        .do();
    } catch (err) {
      console.error(`Erreur à l'index ${i}:`, err.message);
    }
  }

  console.log("Base vectorielle construite !");
}

async function searchCommand(embedding) {
  try {
    const result = await client.graphql
      .get()
      .withClassName('Commande')
      .withFields('question appareil commande { action mqtt_topic payload reponse } _additional { distance }')
      .withNearVector({
        vector: embedding,
        certainty: 0.7 // ajuste selon ton besoin
      })
      .withLimit(1)
      .do();

    const match = result.data.Get.Commande[0];
    return match;
  } catch (err) {
    console.error("Erreur lors de la recherche Weaviate :", err.message);
    return null;
  }
}

export { ensureSchema, storeEmbeddings, searchCommand };

