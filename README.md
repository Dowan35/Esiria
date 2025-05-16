# Esiria - Déploiement sur Raspberry Pi ou Linux

Ce projet consiste à créer un assistant domotique permettant le contrôle des appareils domotique via le protocole Zigbee et MQTT va une commande textuelle.
Il est destiné à être exécuté sur un Raspberry Pi ou une machine Linux classique. Il inclut un backend Node.js, une interface web, l'intégration avec Zigbee2MQTT, Mosquitto et Weaviate (en conteneur Docker), ainsi que la gestion d'un point d'accès Wi-Fi (optionnel sur Raspberry Pi).

## Structure du projet

```
Esiria/
├── src/                    # Code backend (server.js, scripts utilitaires)
├── public/                 # Interface utilisateur accessible via le navigateur
├── data/                   # Données Zigbee2MQTT
├── Etape.txt               # Instructions supplémentaires
└── package.json            # Dépendances Node.js
```

---

## 1. Dépendances requises

Installez les paquets suivants :

```bash
sudo apt update
sudo apt install -y nodejs npm mosquitto mosquitto-clients sqlite3 pm2 docker.io
```

---

## 2. Installation du projet

```bash
cd ~/Esiria
npm install
```

---

## 3. Lancer Weaviate avec Docker

```bash
sudo docker run -d --name weaviate \
  -e QUERY_DEFAULTS_LIMIT=20 \
  -e AUTHENTICATION_ANONYMOUS_ACCESS_ENABLED="true" \
  -e PERSISTENCE_DATA_PATH="/var/lib/weaviate" \
  -p 8082:8080 \
  --restart unless-stopped \
  semitechnologies/weaviate:latest
```

Pour démarrer Weaviate si le conteneur a été arrêté :
```bash
docker start weaviate
```

---

## 4. Service `systemd` pour `server.js`

Créez le fichier `/etc/systemd/system/esiria.service` :

```ini
[Unit]
Description=Service Node.js pour server.js
After=network.target

[Service]
ExecStart=/usr/bin/node /home/admin/Esiria/src/server.js
WorkingDirectory=/home/admin/Esiria/src
Environment=PATH=/usr/bin:/usr/local/bin
Restart=always
User=admin
Group=admin
StandardOutput=inherit
StandardError=inherit

[Install]
WantedBy=multi-user.target
```

Activez le service :

```bash
sudo systemctl daemon-reexec
sudo systemctl daemon-reload
sudo systemctl enable esiria
sudo systemctl start esiria
```

---

## 5. Lancer devices_manager.js avec `pm2`

```bash
pm2 start src/database/devices_manager.js --name devices_manager
pm2 save
pm2 startup
```

---

## 6. Point d’accès Wi-Fi (optionnel - sur Raspberry Pi avec `wlan1`)

```bash
sudo nmcli connection add type wifi ifname wlan1 con-name wlan1-hotspot autoconnect yes ssid Esiria
sudo nmcli connection modify wlan1-hotspot 802-11-wireless-security.key-mgmt wpa-psk
sudo nmcli connection modify wlan1-hotspot 802-11-wireless-security.psk 12345678
sudo nmcli connection modify wlan1-hotspot ipv4.method shared
sudo nmcli connection modify wlan1-hotspot ipv4.addresses "192.168.50.1/24"
sudo nmcli connection modify wlan1-hotspot ipv4.gateway "192.168.50.1"
sudo nmcli connection modify wlan1-hotspot ipv4.dns "8.8.8.8,8.8.4.4"
sudo nmcli connection modify wlan1-hotspot ipv6.method ignore
sudo nmcli connection modify wlan1-hotspot wifi.mode ap
sudo nmcli connection modify wlan1-hotspot wifi.band bg
sudo nmcli connection modify wlan1-hotspot 802-11-wireless.channel 6
sudo nmcli connection up wlan1-hotspot
```

---

## 7. Accès à l’interface web

Depuis un autre appareil :

- Si vous êtes sur le réseau local du Pi : http://raspberrypi.local:8081
- Si vous êtes en local : http://localhost:8081

---

## 8. Erreurs courrantes et solutions

si on recois Désolé, il y a eu une erreur : TypeError: Failed to fetch
verifier l'adresse ip du raspberrypi dans ./public/home.html dans le fetch()

si on detecte mal les commandes utilisateur, ajuster dans weaviate/weaviate-client le certainty :
withNearVector({ vector: embedding, certainty: 0.75 })

si le point d'accès Esiria disparait, se co à Free Wifi (wifi de mon telephone), ssh admin@ip_du_raspberry_sur_le_tel
puis verifier le status de sudo systemctl status hostapd
solution :  sudo systemctl restart hostapd
sudo ip link set wlan1 down
sudo ip link set wlan1 up

derniere solution sur le raspberry : sudo reboot

---

## 9. Remarques

- Les données de Zigbee2MQTT sont présentes dans le dossier `data/` en guise d'exemple.
- Le fichier `Etape.txt` contient d’autres notes spécifiques potentiellement utiles.
- Adaptez les chemins si votre utilisateur n’est pas `admin`.
