// weaviate_client.js
import weaviate from "weaviate-ts-client";
import weaviateSchema from './weaviate_schema.json' with { type: "json" };
import getEmbeddings from '../ressources/sentence_to_embedings.js';

const client = weaviate.client({
  scheme: 'http',
  host: '127.0.0.1:8082',  // IPv4 + port
});

async function initSchema(schema) {
  try {
    console.log("Initialisation du schéma dans Weaviate...");
    await withTimeout( client.schema.classCreator().withClass(schema).do(),15000, "Erreur de timeout lors de l'initialisation du schéma");
    console.log("Schéma initialisé avec succès.");
  } catch (err) {
    console.error("Erreur lors de l'initialisation du schéma : ", err);
  }
}


async function ensureSchema(givenSchema) {
  console.log("Vérification du schéma dans Weaviate...");
  try {
    const schema = await withTimeout(client.schema.getter().do(), 5000, 'Erreur de timeout lors de la récupération du schéma');
    const exists = schema.classes.some(cls => cls.class === 'Commande');
    if (!exists) {
      console.log("Schéma non trouvé. Initialisation en cours...");
      await initSchema(givenSchema);
      console.log("Schéma 'Commande' initialisé avec succès.");
    } else {
      //console.log("Schéma 'Commande' déjà présent.");
    }
  } catch (err) {
    console.error("Erreur lors de la vérification du schéma : ", err);
  }
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

/**
 * Fonction de vectorisation avec USE
 * Prend une liste de phrases et retourne une liste de vecteurs
 */
async function vectorizeQuestions(questions) {
  console.log("Vectorisation des questions...");
  // Utiliser la fonction `getEmbeddings` à la place du modèle local
  const embeddings = await getEmbeddings(questions); 
  return embeddings; // Assurez-vous que getEmbeddings retourne un tableau de vecteurs
}

/**
 * Stocker les embeddings dans Weaviate
 */
async function storeEmbeddings(commands, deleter) {
  try {
    if (deleter) await deleteAllCommandes();

    await ensureSchema(weaviateSchema);
    const flatData = await buildFlatList(commands);

    // Récupérer les questions et les vectoriser
    const questions = flatData.map(item => item.question);
    console.log("Questions à vectoriser : ", questions);
    const embeddings = await vectorizeQuestions(questions);

    // Envoi des vecteurs dans Weaviate
    for (let i = 0; i < flatData.length; i++) {
      await withTimeout(client.data.creator()
        .withClassName('Commande')
        .withProperties(flatData[i])
        .withVector(embeddings[i])
        .do(), 15000, "Erreur de timeout lors de l'envoi des données à Weaviate");
    }

    console.log("Embeddings stockés dans Weaviate.");
  } catch (err) {
    console.error("Erreur lors du stockage des embeddings :", err);
  }
}

/**
 * Recherche de commande la plus proche et la renvoie
 */
async function searchCommand(phrase) {
  await ensureSchema(weaviateSchema);

  // Vectorisation de la phrase utilisateur
  const [embedding] = await vectorizeQuestions([phrase]);

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

/**
 * Récupérer toutes les commandes
 */
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

/**
 * Supprimer toutes les commandes si elles existent
 */
async function deleteAllCommandes() {
  console.log("Tentative de suppression des anciennes commandes...");

  try {
    // Vérifier si le schéma existe dans Weaviate
    const schema = await withTimeout(client.schema.getter().do(), 5000);
    const exists = schema.classes.some(cls => cls.class === 'Commande');

    if (!exists) {
      console.log("Aucune classe 'Commande' trouvée dans Weaviate. Ignoré.");
      return;
    }

    // Récupération des objets (timeout de 5 secondes)
    const objects = await withTimeout(
      client.graphql
        .get()
        .withClassName('Commande')
        .withFields('_additional { id }')
        .withLimit(100)
        .do(),
      5000
    );

    const commandes = objects.data.Get.Commande || [];
    console.log(`Nombre de commandes à supprimer : ${commandes.length}`);

    // Suppression avec gestion parallèle + timeout individuel de 5s
    await Promise.allSettled(
      commandes.map(async (obj) => {
        const id = obj._additional.id;
        try {
          await withTimeout(
            client.data.deleter().withClassName('Commande').withId(id).do(),
            15000
          );
          //console.log(`Commande ${id} supprimée avec succès.`);
        } catch (err) {
          console.error(`Erreur lors de la suppression de la commande ${id} :`, err);
        }
      })
    );

    console.log("Suppression terminée.");

  } catch (err) {
    console.error("Erreur lors de la suppression des commandes :", err);
  }
}

// Wrapper avec timeout
const withTimeout = (promise, ms, err) => {
  let timeoutId;
  const timeout = new Promise((_, reject) => {
    timeoutId = setTimeout(() => 
      reject(new Error(`Timeout, erreur : ${err}`)), 
    ms);
  });
  return Promise.race([
    promise.finally(() => clearTimeout(timeoutId)),
    timeout
  ]);
};


export { storeEmbeddings, searchCommand, getDatabase };
