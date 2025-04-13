import weaviate from 'weaviate-ts-client';
import baseDeConnaissance from './base-connaissance.json' assert { type: 'json' };

const client = weaviate.client({
  scheme: 'http',
  host: 'localhost:8080',
});

// Fonction pour créer des classes dans Weaviate à partir de la base de connaissances
export const createClassesFromKnowledgeBase = async () => {
  try {
    const existingSchema = await client.schema.getter().do();
    const existingClassNames = existingSchema.classes.map(c => c.class.toLowerCase()); // tout en minuscule

    for (const entry of baseDeConnaissance) {
      const className = entry.appareil;
      const classNameLower = className.toLowerCase();

      if (existingClassNames.includes(classNameLower)) {
        console.log(`La classe "${className}" existe déjà. Pas de création nécessaire.`);
        continue;
      }

      const classDefinition = {
        class: className,
        properties: [
          { name: "question", dataType: ["text"] },
          { name: "action", dataType: ["text"] },
          { name: "mqtt_topic", dataType: ["text"] },
          { name: "payload", dataType: ["text"] },
          { name: "reponse", dataType: ["text"] }
        ]
      };

      try {
        await client.schema.classCreator().withClass(classDefinition).do();
        console.log(`Classe "${className}" créée avec succès.`);
      } catch (createError) {
        // Si jamais une autre erreur survient
        console.error(`Erreur lors de la création de la classe "${className}":`, createError);
      }
    }
  } catch (error) {
    console.error('Erreur lors de la récupération du schéma ou de la création des classes :', error);
  }
};



// Fonction pour ajouter des objets à Weaviate à partir des interactions
export const addObjectsToClasses = async () => {
  try {
    for (const entry of baseDeConnaissance) {
      const className = entry.appareil;

      for (const interaction of entry.interactions) {
        const { question, commande } = interaction;

        await client.data
          .creator()
          .withClassName(className)
          .withProperties({
            question: question,
            action: commande.action || "",
            mqtt_topic: commande.mqtt_topic || "",
            payload: JSON.stringify(commande.payload || {}),
            reponse: commande.reponse || ""
          })
          .do();

        console.log(`Objet ajouté pour la question "${question}" dans la classe "${className}".`);
      }
    }
  } catch (error) {
    console.error("Erreur lors de l'ajout des objets :", error);
  }
};

// Lancer la création des classes et l'ajout des objets
export const runWeaviateSetup = async () => {
  await createClassesFromKnowledgeBase();
  await addObjectsToClasses();
};
