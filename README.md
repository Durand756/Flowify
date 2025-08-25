# Flowify - Automatisation Facebook

Un système complet de gestion de chatbots pour pages Facebook avec réponses prédéfinies et intelligence artificielle optionnelle.

## 🚀 Fonctionnalités

### ✨ Gestion Multi-Utilisateurs
- Inscription/connexion sécurisée avec JWT
- Espace isolé pour chaque utilisateur
- Gestion multi-pages par utilisateur

### 🤖 Chatbot Intelligent
- **Réponses prédéfinies** avec mots-clés et priorités
- **IA optionnelle** (OpenAI, Mistral, Claude) comme fallback
- Configuration personnalisable du ton et style de l'IA
- Traitement automatique des messages Facebook

### 📊 Dashboard Complet
- Statistiques en temps réel
- Historique détaillé des conversations
- Gestion des pages Facebook connectées
- Configuration des scénarios d'automatisation

### 🔧 Configuration Flexible
- Chaque utilisateur configure ses propres clés API
- Support de multiples providers IA
- Paramétrage avancé des réponses automatiques

## 🛠 Installation

### Prérequis
- Node.js (v14 ou plus récent)
- MySQL 5.7+ ou MariaDB 10.2+
- Compte Facebook Developer avec application configurée

### 1. Cloner le projet
```bash
git clone <repo-url>
cd chatbot-facebook-manager
```

### 2. Installer les dépendances
```bash
npm install
```

### 3. Configuration
```bash
# Copier le fichier d'exemple
cp .env.example .env

# Modifier avec vos paramètres
nano .env
```

### 4. Variables d'environnement
```env
# Base de données
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=votre_mot_de_passe
DB_NAME=chatbot_system

# Sécurité
JWT_SECRET=votre_cle_secrete_jwt

# Facebook
FACEBOOK_APP_ID=votre_app_id
FACEBOOK_APP_SECRET=votre_app_secret
FACEBOOK_VERIFY_TOKEN=votre_token_verification

# Serveur
PORT=3000
BASE_URL=http://localhost:3000
```

### 5. Installation de la base de données
```bash
npm run setup
```

### 6. Démarrage
```bash
# Mode développement
npm run dev

# Mode production
npm start
```

## 📝 Configuration Facebook

### 1. Créer une application Facebook
1. Allez sur [Facebook Developers](https://developers.facebook.com/)
2. Créez une nouvelle application
3. Ajoutez le produit "Messenger"

### 2. Configuration Webhook
- URL du webhook: `https://votre-domaine.com/webhook/facebook`
- Token de vérification: celui défini dans votre .env
- Événements à s'abonner: `messages`, `messaging_postbacks`

### 3. Permissions requises
- `pages_messaging`
- `pages_read_engagement`
- `pages_manage_metadata`

## 🎯 Utilisation

### 1. Connexion
- Créez un compte ou connectez-vous
- Compte de test: `admin@chatbot.com` / `admin123`

### 2. Ajouter une Page Facebook
1. Allez dans "Pages Facebook"
2. Cliquez "Ajouter une Page"
3. Entrez l'ID de votre page et le token d'accès

### 3. Configurer les Réponses Prédéfinies
1. Sélectionnez une page
2. Ajoutez des mots-clés et leurs réponses
3. Définissez les priorités (1=basse, 3=haute)

### 4. Configuration IA (Optionnel)
1. Choisissez votre provider (OpenAI, Mistral, Claude)
2. Entrez votre clé API personnelle
3. Configurez le ton et les instructions
4. L'IA sera utilisée si aucune réponse prédéfinie ne correspond

## 📊 Types de Correspondance

### Réponses Prédéfinies
- **Contient** (défaut): Le message contient le mot-clé
- **Exact**: Le message correspond exactement
- **Commence par**: Le message commence par le mot-clé
- **Se termine par**: Le message se termine par le mot-clé

### Priorités
- **Haute (3)**: Priorité maximale
- **Moyenne (2)**: Priorité standard
- **Basse (1)**: Priorité minimale

## 🤖 Providers IA Supportés

### OpenAI
- **Modèles**: GPT-3.5 Turbo, GPT-4, GPT-4 Turbo
- **Configuration**: Température, instructions personnalisées
- **Clé API**: Fournie par l'utilisateur

### Mistral AI
- **Modèles**: Mistral Tiny, Small, Medium, Large
- **Spécialités**: Modèles européens, performants
- **Clé API**: Fournie par l'utilisateur

### Claude (Anthropic)
- **Modèles**: Claude 3 Haiku, Sonnet, Opus
- **Points forts**: Conversations naturelles, éthique
- **Clé API**: Fournie par l'utilisateur

## 🔄 Architecture

### Backend (Node.js)
```
server.js                 # Serveur principal Express
├── lib/
│   ├── aiProviders.js    # Gestionnaire des APIs IA
│   └── facebookManager.js # Gestionnaire Facebook
├── setup/
│   └── setup.js          # Script d'installation
└── public/               # Frontend statique
```

### Base de données (MySQL)
```
users                     # Utilisateurs du système
├── facebook_pages        # Pages Facebook connectées
├── predefined_responses  # Réponses prédéfinies
├── ai_configs           # Configurations IA
├── message_history      # Historique des messages
├── system_logs          # Logs système
└── webhook_events       # Événements webhook
```

### Frontend (HTML/CSS/JS + Bootstrap)
- Interface responsive avec Bootstrap 5
- JavaScript vanilla pour les interactions
- Gestion d'état côté client

## 📈 Monitoring et Logs

### Dashboard Stats
- Nombre de pages connectées
- Réponses actives
- Messages traités
- Configurations IA

### Historique
- Messages reçus et réponses envoyées
- Type de réponse (prédéfinie/IA/aucune)
- Temps de traitement
- Erreurs éventuelles

### Logs Système
- Événements d'activité
- Erreurs de traitement
- Statistiques de performance

## 🔧 API Endpoints

### Authentification
- `POST /api/register` - Inscription
- `POST /api/login` - Connexion

### Pages Facebook
- `GET /api/facebook/pages` - Liste des pages
- `POST /api/facebook/pages` - Ajouter une page
- `DELETE /api/facebook/pages/:id` - Supprimer une page

### Réponses Prédéfinies
- `GET /api/responses/:pageId` - Réponses d'une page
- `POST /api/responses` - Ajouter une réponse
- `DELETE /api/responses/:id` - Supprimer une réponse

### Configuration IA
- `GET /api/ai-config/:pageId` - Configuration IA d'une page
- `POST /api/ai-config` - Mettre à jour la configuration

### Historique
- `GET /api/history/:pageId` - Historique d'une page

### Webhook
- `POST /webhook/facebook` - Réception des messages Facebook

## 🔐 Sécurité

### Authentification
- Tokens JWT avec expiration
- Hashage des mots de passe avec bcrypt
- Validation des entrées utilisateur

### Données Sensibles
- Chiffrement des tokens Facebook
- Stockage sécurisé des clés API
- Isolation des données par utilisateur

### Rate Limiting
- Protection contre les abus
- Limite de requêtes par IP
- Timeout des requêtes API

## 🚀 Déploiement

### Production
```bash
# Variables d'environnement production
NODE_ENV=production
PORT=3000

# Démarrage avec PM2
npm install -g pm2
pm2 start server.js --name "chatbot-manager"
```

### Docker (Optionnel)
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3000
CMD ["npm", "start"]
```

### Nginx (Reverse Proxy)
```nginx
server {
    listen 80;
    server_name votre-domaine.com;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

## 🐛 Dépannage

### Problèmes Courants

**Erreur de connexion à la base de données**
```bash
# Vérifier les paramètres dans .env
# Vérifier que MySQL est démarré
sudo systemctl status mysql
```

**Token Facebook invalide**
```bash
# Régénérer le token depuis Facebook Developers
# Vérifier les permissions de la page
```

**IA ne répond pas**
```bash
# Vérifier la clé API
# Vérifier les quotas du provider
# Consulter les logs d'erreur
```

### Logs
```bash
# Logs de l'application
tail -f logs/app.log

# Logs des erreurs
tail -f logs/error.log
```

## 📚 Ressources

### Documentation Facebook
- [Graph API](https://developers.facebook.com/docs/graph-api/)
- [Messenger Platform](https://developers.facebook.com/docs/messenger-platform/)

### APIs IA
- [OpenAI API](https://platform.openai.com/docs/)
- [Mistral AI](https://docs.mistral.ai/)
- [Claude API](https://docs.anthropic.com/)

### Support
- [Issues GitHub](https://github.com/your-repo/issues)
- [Documentation complète](https://your-docs-site.com)

## 📄 Licence

MIT License - voir le fichier LICENSE pour plus de détails.

## 👥 Contribution

Les contributions sont les bienvenues ! Veuillez consulter CONTRIBUTING.md pour les guidelines.

---

**Note**: Ce système nécessite des clés API personnelles pour les services IA. Chaque utilisateur doit fournir ses propres clés selon ses besoins et budgets.
