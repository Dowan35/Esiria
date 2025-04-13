import { getEmbeddings } from '../embeddings/sentence-transformers.js';
import weaviate from "weaviate-ts-client";
import weaviateSchema from './weaviate_schema.json' assert { type: "json" };

const client = weaviate.client({ scheme: 'http', host: 'localhost:8080' });

async function initSchema(schema) {
  return await client.schema.classCreator().withClass(schema).do();
}

async function ensureSchema(givenSchema) {
  const schema = await client.schema.getter().do();
  const exists = schema.classes.some(cls => cls.class === 'Commande');
  if (!exists) await initSchema(givenSchema);
}

async function buildFlatList(data) {
  const flat = [];
  for (const appareil of data) {
    for (const interaction of appareil.interactions) {
      flat.push({
        question: interaction.question,
        appareil: appareil.appareil,
        commande: JSON.stringify(interaction.commande)
      });
    }
  }
  return flat;
}

async function storeEmbeddings(commands, deleter) {
  try {
    if (deleter) {await deleteAllCommandes();}

    await ensureSchema(weaviateSchema);
    const flatData = await buildFlatList(commands);
    const questions = flatData.map(item => item.question);
    const embeddings = await getEmbeddings(questions);
  
    for (let i = 0; i < flatData.length; i++) {
      await client.data.creator()
        .withClassName('Commande')
        .withProperties(flatData[i])
        .withVector(embeddings[i])
        .do();
    }
  
    console.log("Embeddings stockés dans Weaviate.");
  } catch (err) {
    console.error("Erreur lors du stockage des embeddings :", err.message);
  }
  
}

async function searchCommand(embedding) {
  await ensureSchema(weaviateSchema);
  const result = await client.graphql
    .get()
    .withClassName('Commande')
    .withFields('question appareil commande _additional { distance }')
    .withNearVector({ vector: embedding, certainty: 0.75 })
    .withLimit(3)
    .do();

    console.log("Résultats similaires trouvés :", result.data.Get.Commande.map(c => c.question));
    

  return result.data.Get.Commande?.[0] || null;
}

async function getDatabase() {
  await ensureSchema(weaviateSchema);
  const result = await client.graphql
  .get()
  .withClassName('Commande')
  .withFields('question appareil commande')
  .withLimit(20)
  .do();
  return result.data.Get.Commande || null;
}

async function deleteAllCommandes() {
  const objects = await client.graphql
    .get()
    .withClassName('Commande')
    .withFields('_additional { id }')
    .withLimit(100)
    .do();

  const commandes = objects.data.Get.Commande || [];
  for (const obj of commandes) {
    const id = obj._additional.id;
    await client.data.deleter().withClassName('Commande').withId(id).do();
  }
  console.log("Anciennes commandes supprimées de Weaviate.");
}


export {storeEmbeddings, searchCommand,getDatabase };
