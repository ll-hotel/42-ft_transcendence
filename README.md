# 🎮 ft_transcendence

ft_transcendence est une application web full stack développée dans le cadre du cursus de l’École 42.  
Elle propose une plateforme de jeu Pong multijoueur en temps réel intégrant une architecture backend en microservices, une sécurité avancée et une expérience utilisateur moderne.

Le projet met l’accent sur :

- le temps réel (multiplayer & chat)
- la sécurité (JWT, 2FA...)
- les architectures modernes (microservices, Docker)
- la scalabilité et la maintenabilité

Conçu comme une véritable application web en conditions proches de la production, le projet combine ingénierie backend, frontend moderne et DevOps.

---
🏗️ Architecture globale

> Diagramme représentant l’architecture backend en microservices, les flux réseau et les services principaux :
<img width="1200" alt="ft_transcendence" src="https://github.com/user-attachments/assets/f062ec58-b45f-4cb8-904c-45675bd3439c" />

## 🚀 Fonctionnalités

### 👤 Gestion des utilisateurs & sécurité
- Inscription et connexion sécurisées
- Authentification OAuth 2.0 (Google, intra 42)
- Authentification JWT
- Two-Factor Authentication (2FA)
- Profils utilisateurs (avatar, stats, historique de matchs)
- Système d’amis et statut en ligne

### 🎮 Gameplay temps réel
- Jeu Pong serveur-side (logique côté backend)
- Parties multijoueur à distance
- Gestion du matchmaking et des tournois
- API pour interaction web & CLI
- Gestion des déconnexions et latence

### 💬 Communication
- Chat en temps réel
- Messages privés
- Blocage d’utilisateurs
- Invitations de jeu via le chat
- Notifications de tournois

### 📊 Monitoring
- Visualisation des métriques avec Grafana

---
## 🛠️ Stack

### Backend
- TypeScript  
- Fastify (Node.js)  
- Architecture microservices    

### Frontend
- TypeScript  
- HTML / CSS
- Tailwind CSS  

### Base de données
- SQLite (gérée par Drizzle ORM)

### Infrastructure
- Docker  
- Nginx  

### Monitoring
- Grafana 
---
## ⚙️ Installation & lancement

### Prérequis

- Docker & Docker Compose
- Make

### 🔐 Configuration

Créer un fichier `.env` à la racine du projet :

```env
# .env.example
HOSTURL=
JWT_SECRET=

CLIENT_42=
SECRET_42=

CLIENT_GOOGLE=
SECRET_GOOGLE=
```

### ▶️ Lancement

```bash
git clone https://github.com/ll-hotel/42-ft_transcendence.git
cd 42-ft_transcendence
make
```
### 🌐 Accès

Une fois le projet lancé, le site est accessible à l’adresse : https://HOSTURL:8443
(en utilisant la valeur définie dans le .env)
