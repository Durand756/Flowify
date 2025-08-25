const express = require('express');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const axios = require('axios');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Configuration base de données
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'chatbot_system'
};

let db;

// Initialisation DB
async function initDatabase() {
  try {
    db = await mysql.createConnection(dbConfig);
    
    // Création des tables
    await db.execute(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(255) UNIQUE NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await db.execute(`
      CREATE TABLE IF NOT EXISTS facebook_pages (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        page_id VARCHAR(255) NOT NULL,
        page_name VARCHAR(255) NOT NULL,
        access_token TEXT NOT NULL,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    await db.execute(`
      CREATE TABLE IF NOT EXISTS predefined_responses (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        page_id VARCHAR(255) NOT NULL,
        keyword VARCHAR(255) NOT NULL,
        response TEXT NOT NULL,
        priority INT DEFAULT 1,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    await db.execute(`
      CREATE TABLE IF NOT EXISTS ai_configs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        page_id VARCHAR(255) NOT NULL,
        provider VARCHAR(50) NOT NULL,
        model VARCHAR(100) NOT NULL,
        api_key TEXT NOT NULL,
        temperature DECIMAL(3,2) DEFAULT 0.7,
        instructions TEXT,
        tone VARCHAR(100) DEFAULT 'friendly',
        style VARCHAR(100) DEFAULT 'medium',
        is_active BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    await db.execute(`
      CREATE TABLE IF NOT EXISTS message_history (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        page_id VARCHAR(255) NOT NULL,
        message_id VARCHAR(255) NOT NULL,
        sender_id VARCHAR(255) NOT NULL,
        message_text TEXT,
        response_text TEXT,
        response_type ENUM('predefined', 'ai', 'none') DEFAULT 'none',
        processed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    console.log('Database initialized successfully');
  } catch (error) {
    console.error('Database initialization error:', error);
  }
}

// Middleware d'authentification
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Token requis' });
  }

  jwt.verify(token, process.env.JWT_SECRET || 'secret_key', (err, user) => {
    if (err) return res.status(403).json({ error: 'Token invalide' });
    req.user = user;
    next();
  });
}

// Routes d'authentification
app.post('/api/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);

    await db.execute(
      'INSERT INTO users (username, email, password) VALUES (?, ?, ?)',
      [username, email, hashedPassword]
    );

    res.json({ message: 'Utilisateur créé avec succès' });
  } catch (error) {
    res.status(500).json({ error: 'Erreur lors de la création du compte' });
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const [users] = await db.execute('SELECT * FROM users WHERE email = ?', [email]);
    
    if (users.length === 0) {
      return res.status(401).json({ error: 'Email ou mot de passe incorrect' });
    }

    const user = users[0];
    const validPassword = await bcrypt.compare(password, user.password);

    if (!validPassword) {
      return res.status(401).json({ error: 'Email ou mot de passe incorrect' });
    }

    const token = jwt.sign(
      { userId: user.id, username: user.username },
      process.env.JWT_SECRET || 'secret_key',
      { expiresIn: '24h' }
    );

    res.json({ token, user: { id: user.id, username: user.username, email: user.email } });
  } catch (error) {
    res.status(500).json({ error: 'Erreur lors de la connexion' });
  }
});

// Routes pour les pages Facebook
app.post('/api/facebook/pages', authenticateToken, async (req, res) => {
  try {
    const { pageId, pageName, accessToken } = req.body;
    
    // Vérifier la validité du token avec Facebook
    const response = await axios.get(`https://graph.facebook.com/v18.0/${pageId}?access_token=${accessToken}`);
    
    await db.execute(
      'INSERT INTO facebook_pages (user_id, page_id, page_name, access_token) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE access_token = VALUES(access_token)',
      [req.user.userId, pageId, pageName, accessToken]
    );

    res.json({ message: 'Page Facebook connectée avec succès' });
  } catch (error) {
    res.status(500).json({ error: 'Erreur lors de la connexion de la page Facebook' });
  }
});

app.get('/api/facebook/pages', authenticateToken, async (req, res) => {
  try {
    const [pages] = await db.execute(
      'SELECT * FROM facebook_pages WHERE user_id = ?',
      [req.user.userId]
    );
    res.json(pages);
  } catch (error) {
    res.status(500).json({ error: 'Erreur lors de la récupération des pages' });
  }
});

// Routes pour les réponses prédéfinies
app.post('/api/responses', authenticateToken, async (req, res) => {
  try {
    const { pageId, keyword, response, priority } = req.body;
    
    await db.execute(
      'INSERT INTO predefined_responses (user_id, page_id, keyword, response, priority) VALUES (?, ?, ?, ?, ?)',
      [req.user.userId, pageId, keyword, response, priority || 1]
    );

    res.json({ message: 'Réponse prédéfinie ajoutée avec succès' });
  } catch (error) {
    res.status(500).json({ error: 'Erreur lors de l\'ajout de la réponse' });
  }
});

app.get('/api/responses/:pageId', authenticateToken, async (req, res) => {
  try {
    const [responses] = await db.execute(
      'SELECT * FROM predefined_responses WHERE user_id = ? AND page_id = ? ORDER BY priority DESC',
      [req.user.userId, req.params.pageId]
    );
    res.json(responses);
  } catch (error) {
    res.status(500).json({ error: 'Erreur lors de la récupération des réponses' });
  }
});

app.delete('/api/responses/:id', authenticateToken, async (req, res) => {
  try {
    await db.execute(
      'DELETE FROM predefined_responses WHERE id = ? AND user_id = ?',
      [req.params.id, req.user.userId]
    );
    res.json({ message: 'Réponse supprimée avec succès' });
  } catch (error) {
    res.status(500).json({ error: 'Erreur lors de la suppression' });
  }
});

// Routes pour la configuration IA
app.post('/api/ai-config', authenticateToken, async (req, res) => {
  try {
    const { pageId, provider, model, apiKey, temperature, instructions, tone, style } = req.body;
    
    await db.execute(
      `INSERT INTO ai_configs (user_id, page_id, provider, model, api_key, temperature, instructions, tone, style, is_active) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, true) 
       ON DUPLICATE KEY UPDATE 
       provider = VALUES(provider), model = VALUES(model), api_key = VALUES(api_key), 
       temperature = VALUES(temperature), instructions = VALUES(instructions), 
       tone = VALUES(tone), style = VALUES(style), is_active = VALUES(is_active)`,
      [req.user.userId, pageId, provider, model, apiKey, temperature || 0.7, instructions, tone, style]
    );

    res.json({ message: 'Configuration IA mise à jour avec succès' });
  } catch (error) {
    res.status(500).json({ error: 'Erreur lors de la mise à jour de la configuration IA' });
  }
});

app.get('/api/ai-config/:pageId', authenticateToken, async (req, res) => {
  try {
    const [configs] = await db.execute(
      'SELECT * FROM ai_configs WHERE user_id = ? AND page_id = ?',
      [req.user.userId, req.params.pageId]
    );
    res.json(configs[0] || null);
  } catch (error) {
    res.status(500).json({ error: 'Erreur lors de la récupération de la configuration' });
  }
});

// Webhook Facebook
app.post('/webhook/facebook', async (req, res) => {
  try {
    const { entry } = req.body;
    
    for (const page of entry) {
      const pageId = page.id;
      
      for (const messaging of page.messaging || []) {
        await processMessage(pageId, messaging);
      }
    }
    
    res.status(200).send('OK');
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).send('Error');
  }
});

// Fonction de traitement des messages
async function processMessage(pageId, messaging) {
  try {
    const senderId = messaging.sender.id;
    const messageText = messaging.message?.text;
    
    if (!messageText) return;

    // Récupérer les informations de la page
    const [pages] = await db.execute('SELECT * FROM facebook_pages WHERE page_id = ?', [pageId]);
    if (pages.length === 0) return;

    const page = pages[0];
    const userId = page.user_id;

    // Chercher une réponse prédéfinie
    const [responses] = await db.execute(
      'SELECT * FROM predefined_responses WHERE user_id = ? AND page_id = ? AND is_active = true ORDER BY priority DESC',
      [userId, pageId]
    );

    let responseText = null;
    let responseType = 'none';

    // Vérifier les mots-clés
    for (const response of responses) {
      if (messageText.toLowerCase().includes(response.keyword.toLowerCase())) {
        responseText = response.response;
        responseType = 'predefined';
        break;
      }
    }

    // Si pas de réponse prédéfinie, utiliser l'IA
    if (!responseText) {
      const [aiConfigs] = await db.execute(
        'SELECT * FROM ai_configs WHERE user_id = ? AND page_id = ? AND is_active = true',
        [userId, pageId]
      );

      if (aiConfigs.length > 0) {
        const aiConfig = aiConfigs[0];
        responseText = await generateAIResponse(messageText, aiConfig);
        responseType = 'ai';
      }
    }

    // Envoyer la réponse
    if (responseText) {
      await sendFacebookMessage(pageId, senderId, responseText, page.access_token);
    }

    // Enregistrer dans l'historique
    await db.execute(
      'INSERT INTO message_history (user_id, page_id, message_id, sender_id, message_text, response_text, response_type) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [userId, pageId, messaging.message.mid, senderId, messageText, responseText, responseType]
    );

  } catch (error) {
    console.error('Error processing message:', error);
  }
}

// Fonction pour générer une réponse IA
async function generateAIResponse(messageText, aiConfig) {
  try {
    let response;
    
    if (aiConfig.provider === 'openai') {
      response = await axios.post('https://api.openai.com/v1/chat/completions', {
        model: aiConfig.model,
        messages: [
          { role: 'system', content: aiConfig.instructions || 'Vous êtes un assistant serviable.' },
          { role: 'user', content: messageText }
        ],
        temperature: aiConfig.temperature,
        max_tokens: 500
      }, {
        headers: { 'Authorization': `Bearer ${aiConfig.api_key}` }
      });
      
      return response.data.choices[0].message.content;
    }
    
    // Ajouter d'autres providers (Mistral, Claude) ici
    
    return null;
  } catch (error) {
    console.error('AI generation error:', error);
    return null;
  }
}

// Fonction pour envoyer un message Facebook
async function sendFacebookMessage(pageId, recipientId, text, accessToken) {
  try {
    await axios.post(`https://graph.facebook.com/v18.0/${pageId}/messages`, {
      recipient: { id: recipientId },
      message: { text: text }
    }, {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });
  } catch (error) {
    console.error('Facebook send error:', error);
  }
}

// Route pour l'historique
app.get('/api/history/:pageId', authenticateToken, async (req, res) => {
  try {
    const [history] = await db.execute(
      'SELECT * FROM message_history WHERE user_id = ? AND page_id = ? ORDER BY processed_at DESC LIMIT 100',
      [req.user.userId, req.params.pageId]
    );
    res.json(history);
  } catch (error) {
    res.status(500).json({ error: 'Erreur lors de la récupération de l\'historique' });
  }
});

// Route principale
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Démarrage du serveur
initDatabase().then(() => {
  app.listen(PORT, () => {
    console.log(`Serveur démarré sur le port ${PORT}`);
  });
});
