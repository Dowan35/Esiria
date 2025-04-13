import mqtt from 'mqtt';

const client = mqtt.connect('mqtt://localhost:1883', {
  reconnectPeriod: 1000,
});

client.on('connect', () => {
  console.log('Connecté au broker MQTT');
});

client.on('error', (err) => {
  console.error('Erreur MQTT :', err);
});

client.on('offline', () => {
  console.warn('Client MQTT hors ligne');
});

client.on('reconnect', () => {
  console.log('Tentative de reconnexion...');
});

export function sendMqttCommand(topic, payload) {
  if (!client.connected) {
    console.error("Impossible d'envoyer, client MQTT non connecté !");
    return;
  }

  client.publish(topic, JSON.stringify(payload), (err) => {
    if (err) {
      console.error('Erreur lors de l\'envoi de la commande MQTT :', err);
    } else {
      console.log(`Commande envoyée à ${topic} :`, payload);
    }
  });
}

