// main qui tourne en fond pour mettre a jour la db des reception de données
const deviceManager = require('./deviceManager');

const main = async () => {
    try {
        const devices = await deviceManager.getDevices(); // Attendre que les données MQTT soient reçues
        //console.log("Devices reçus :", devices);
        deviceManager.save(devices, false); // true pour ajouter a la fin du fichier, false pour reecrirre le fichier
    } catch (error) {
        console.error("Erreur dans main():", error);
    }
};

main();
