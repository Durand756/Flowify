const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function setupDatabase() {
    console.log('🚀 Démarrage de l\'installation de la base de données...\n');

    try {
        // Connexion à MySQL sans spécifier de base de données
        const connection = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || ''
        });

        // Création de la base de données
        const dbName = process.env.DB_NAME || 'chatbot_system';
        await connection.execute(`CREATE DATABASE IF NOT EXISTS \`${dbName}\``);
        console.log(`✅ Base de données '${dbName}' créée avec succès`);

        // Utilisation de la base de données
        await connection.execute(`USE \`${dbName}\``);

        // Création des tables
        console.log('\n📋 Création des tables...');

        // Table users
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS users (
                id INT AUTO_INCREMENT PRIMARY KEY,
                username VARCHAR(255) UNIQUE NOT NULL,
                email VARCHAR(255) UNIQUE NOT NULL,
                password VARCHAR(255) NOT NULL,
                is_active BOOLEAN DEFAULT true,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_email (email),
                INDEX idx_username (username)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
        console.log('✅ Table users créée');

        // Table facebook_pages
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS facebook_pages (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                page_id VARCHAR(255) NOT NULL,
                page_name VARCHAR(255) NOT NULL,
                access_token TEXT NOT NULL,
                is_active BOOLEAN DEFAULT true,
                last_sync TIMESTAMP NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                UNIQUE KEY unique_user_page (user_id, page_id),
                INDEX idx_page_id (page_id),
                INDEX idx_user_id (user_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
        console.log('✅ Table facebook_pages créée');

        // Table predefined_responses
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS predefined_responses (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                page_id VARCHAR(255) NOT NULL,
                keyword VARCHAR(255) NOT NULL,
                response TEXT NOT NULL,
                priority INT DEFAULT 1,
                is_active BOOLEAN DEFAULT true,
                match_type ENUM('contains', 'exact', 'starts_with', 'ends_with') DEFAULT 'contains',
                case_sensitive BOOLEAN DEFAULT false,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                INDEX idx_user_page (user_id, page_id),
                INDEX idx_keyword (keyword),
                INDEX idx_priority (priority)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
        console.log('✅ Table predefined_responses créée');

        // Table ai_configs
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS ai_configs (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                page_id VARCHAR(255) NOT NULL,
                provider VARCHAR(50) NOT NULL,
                model VARCHAR(100) NOT NULL,
                api_key TEXT NOT NULL,
                temperature DECIMAL(3,2) DEFAULT 0.7,
                max_tokens INT DEFAULT 500,
                instructions TEXT,
                tone VARCHAR(100) DEFAULT 'friendly',
                style VARCHAR(100) DEFAULT 'medium',
                language VARCHAR(10) DEFAULT 'fr',
                is_active BOOLEAN DEFAULT false,
                fallback_only BOOLEAN DEFAULT true,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                UNIQUE KEY unique_user_page_ai (user_id, page_id),
                INDEX idx_provider (provider)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
        console.log('✅ Table ai_configs créée');

        // Table message_history
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS message_history (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                page_id VARCHAR(255) NOT NULL,
                message_id VARCHAR(255) NOT NULL,
                sender_id VARCHAR(255) NOT NULL,
                sender_name VARCHAR(255) DEFAULT NULL,
                message_text TEXT,
                response_text TEXT,
                response_type ENUM('predefined', 'ai', 'none', 'error') DEFAULT 'none',
                matched_keyword VARCHAR(255) DEFAULT NULL,
                processing_time_ms INT DEFAULT NULL,
                error_message TEXT DEFAULT NULL,
                processed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                INDEX idx_user_page (user_id, page_id),
                INDEX idx_message_id (message_id),
                INDEX idx_processed_at (processed_at),
                INDEX idx_response_type (response_type)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
        console.log('✅ Table message_history créée');

        // Table system_logs
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS system_logs (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT DEFAULT NULL,
                page_id VARCHAR(255) DEFAULT NULL,
                log_level ENUM('info', 'warning', 'error', 'debug') DEFAULT 'info',
                event_type VARCHAR(100) NOT NULL,
                message TEXT NOT NULL,
                metadata JSON DEFAULT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
                INDEX idx_user_id (user_id),
                INDEX idx_log_level (log_level),
                INDEX idx_event_type (event_type),
                INDEX idx_created_at (created_at)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
        console.log('✅ Table system_logs créée');

        // Table webhook_events
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS webhook_events (
                id INT AUTO_INCREMENT PRIMARY KEY,
                page_id VARCHAR(255) NOT NULL,
                event_type VARCHAR(50) NOT NULL,
                raw_data JSON NOT NULL,
                processed BOOLEAN DEFAULT false,
                processed_at TIMESTAMP NULL,
                error_message TEXT DEFAULT NULL,
                retry_count INT DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_page_id (page_id),
                INDEX idx_processed (processed),
                INDEX idx_created_at (created_at)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
        console.log('✅ Table webhook_events créée');

        // Insertion de données de test (optionnel)
        console.log('\n🎯 Insertion des données de test...');
        
        // Utilisateur de test
        const bcrypt = require('bcryptjs');
        const testPassword = await bcrypt.hash('admin123', 12);
        
        await connection.execute(`
            INSERT IGNORE INTO users (username, email, password) 
            VALUES ('admin', 'admin@chatbot.com', ?)
        `, [testPassword]);
        
        console.log('✅ Utilisateur de test créé (admin@chatbot.com / admin123)');

        // Vérifier que le fichier .env existe
        const envPath = path.join(__dirname, '../.env');
        if (!fs.existsSync(envPath)) {
            console.log('\n⚠️  Fichier .env non trouvé, création depuis .env.example...');
            const envExamplePath = path.join(__dirname, '../.env.example');
            if (fs.existsSync(envExamplePath)) {
                fs.copyFileSync(envExamplePath, envPath);
                console.log('✅ Fichier .env créé depuis .env.example');
                console.log('🔧 Veuillez modifier le fichier .env avec vos propres configurations');
            }
        }

        await connection.end();
        
        console.log('\n🎉 Installation terminée avec succès!');
        console.log('\n📋 Étapes suivantes:');
        console.log('1. Modifiez le fichier .env avec vos configurations');
        console.log('2. Configurez votre application Facebook');
        console.log('3. Lancez le serveur: npm start');
        console.log('4. Accédez à http://localhost:3000');
        console.log('\n🔑 Compte de test:');
        console.log('   Email: admin@chatbot.com');
        console.log('   Mot de passe: admin123');

    } catch (error) {
        console.error('\n❌ Erreur lors de l\'installation:', error);
        process.exit(1);
    }
}

// Fonction pour vérifier les prérequis
function checkRequirements() {
    console.log('🔍 Vérification des prérequis...\n');
    
    // Vérifier Node.js version
    const nodeVersion = process.version;
    console.log(`✅ Node.js version: ${nodeVersion}`);
    
    // Vérifier les variables d'environnement critiques
    const requiredVars = ['DB_HOST', 'DB_USER', 'DB_NAME'];
    const missingVars = requiredVars.filter(varName => !process.env[varName]);
    
    if (missingVars.length > 0) {
        console.log(`⚠️  Variables d'environnement manquantes: ${missingVars.join(', ')}`);
        console.log('   Ces variables seront utilisées avec des valeurs par défaut.');
    }
    
    console.log('✅ Prérequis vérifiés\n');
}

// Fonction principale
async function main() {
    console.log('=====================================');
    console.log('    CHATBOT MANAGER - INSTALLATION   ');
    console.log('=====================================\n');
    
    checkRequirements();
    await setupDatabase();
    
    console.log('\n=====================================');
    console.log('         INSTALLATION TERMINÉE       ');
    console.log('=====================================\n');
}

// Exécution du script
if (require.main === module) {
    main().catch(error => {
        console.error('\n💥 Erreur fatale:', error);
        process.exit(1);
    });
}

module.exports = { setupDatabase, checkRequirements };
