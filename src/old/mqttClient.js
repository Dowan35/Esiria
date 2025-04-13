import mqtt from 'mqtt';

const client = mqtt.connect('mqtt://localhost:1883');

client.on('connect', () => {
  console.log('Connecté à MQTT');
});

function publishMQTT(topic, payload) {
  return new Promise((resolve, reject) => {
    client.publish(topic, JSON.stringify(payload), (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

export { publishMQTT };
