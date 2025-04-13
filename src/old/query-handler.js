import { findBestMatch } from "./findBestMatch.js";
import { sendMqttCommand } from "./mqtt-client.js";

async function handleUserQuery(query) {
  try {
    const match = await findBestMatch(query);

    if (match) {
      const { commandes } = match;
      for (const commande of commandes) {
        sendMqttCommand(commande.mqtt_topic, commande.payload);
        console.log(`Commande envoyée à ${commande.mqtt_topic}`);
      }
      return "Commande exécutée avec succès !";
    } else {
      console.log("Aucune commande correspondante trouvée.");
      return "Je ne comprends pas cette commande.";
    }
  } catch (error) {
    console.error("Erreur lors du traitement de la requête :", error);
    return "Une erreur s'est produite lors du traitement.";
  }
}

export { handleUserQuery };
