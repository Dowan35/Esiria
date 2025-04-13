const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();
const dbPath = "/opt/zigbee2mqtt/data/database.db";

// Ouvrir la base de données existante
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error("Erreur lors de l'ouverture de la base de données :", err.message);
    } else {
        console.log("Connexion réussie à la base de données :", dbPath);
    }
});

// Sélectionner les utilisateurs avec leur état en ligne
const getAllDevices = async () => {
    const sql = `SELECT modelId AS name, ieeeAddr AS identifier FROM devices`;

    return new Promise((resolve, reject) => {
        db.all(sql, [], (err, rows) => { // Utiliser db.all pour récupérer tous les résultats
            if (err) {
                console.error('Erreur lors de la sélection:', err.message);
                return reject(err);
            }

            // Construire une liste d'objets avec le nom de l'utilisateur et son état
            const users = rows.map(row => ({
                name: row.name,
                identifier: row.identifier,
            }));

            resolve(users);
        });
    });
};

 function readDb(){
        // Lire le fichier
        const data = fs.readFileSync(dbPath, 'utf8');

        // Chaque ligne est un JSON, il faut les parser une par une
        const devices = data.split('\n')
            .filter(line => line.trim() !== '') // Supprimer les lignes vides
            .map(line => JSON.parse(line)); // Parser chaque ligne JSON

        const devicesList = devices.map(d => ({
            name: d.modelId || "Inconnu",
            identifier: d.ieeeAddr
        })).filter(d => d.name !== "Inconnu" && d.identifier); // Exclure les inconnus;
        
        return devicesList
}

function jsonToDb(){
    
}

module.exports = {
    getAllDevices,
    readDb
};