{
    "id": "prise_bureau",
    "nom": "prise du bureau",
    "type": "switch",
    "topic": "zigbee2mqtt/prise_bureau",
    "capabilities": ["on", "off"]
  }

  
  function generateCommandInteractions(device) {
    const interactions = [];
  
    if (device.capabilities.includes("on")) {
      interactions.push({
        question: `allumer ${device.nom}`,
        commande: {
          action: "allumer",
          mqtt_topic: `${device.topic}/set`,
          payload: { state: "ON" },
          reponse: `${device.nom} est allumée.`
        }
      });
    }
  
    if (device.capabilities.includes("off")) {
      interactions.push({
        question: `éteindre ${device.nom}`,
        commande: {
          action: "eteindre",
          mqtt_topic: `${device.topic}/set`,
          payload: { state: "OFF" },
          reponse: `${device.nom} est éteinte.`
        }
      });
    }
  
    return interactions;
  }

  //weaviate
  const newInteractions = generateCommandInteractions(newDevice);
await storeEmbeddings([
  {
    appareil: newDevice.id,
    interactions: newInteractions
  }
]);
