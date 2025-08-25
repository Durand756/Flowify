const axios = require('axios');
const AIProviderManager = require('./aiProviders');

class FacebookManager {
    constructor(db) {
        this.db = db;
        this.aiManager = new AIProviderManager();
        this.graphAPI = 'https://graph.facebook.com/v18.0';
    }

    /**
     * Traite un message reçu via webhook
     */
    async processIncomingMessage(pageId, messagingData) {
        const startTime = Date.now();
        
        try {
            const senderId = messagingData.sender.id;
            const messageText = messagingData.message?.text;
            const messageId = messagingData.message?.mid;

            if (!messageText || !messageId) {
                console.log('Message ignoré (pas de texte ou ID manquant)');
                return;
            }

            // Récupérer les informations de la page
            const [pages] = await this.db.execute(
                'SELECT * FROM facebook_pages WHERE page_id = ? AND is_active = true',
                [pageId]
            );

            if (pages.length === 0) {
                console.log(`Page ${pageId} non trouvée ou inactive`);
                return;
            }

            const page = pages[0];
            const userId = page.user_id;

            // Récupérer le nom de l'expéditeur (optionnel)
            const senderName = await this.getSenderName(senderId, page.access_token);

            // Chercher une réponse prédéfinie
            const predefinedResponse = await this.findPredefinedResponse(
                userId, pageId, messageText
            );

            let responseData = {
                text: null,
                type: 'none',
                matchedKeyword: null,
                processingTime: 0,
                error: null
            };

            if (predefinedResponse) {
                responseData.text = predefinedResponse.response;
                responseData.type = 'predefined';
                responseData.matchedKeyword = predefinedResponse.keyword;
            } else {
                // Essayer avec l'IA si configurée
                const aiResponse = await this.tryAIResponse(userId, pageId, messageText);
                if (aiResponse) {
                    responseData = { ...responseData, ...aiResponse, type: 'ai' };
                }
            }

            // Envoyer la réponse si disponible
            if (responseData.text) {
                await this.sendMessage(pageId, senderId, responseData.text, page.access_token);
            }

            // Enregistrer dans l'historique
            const totalProcessingTime = Date.now() - startTime;
            await this.saveMessageHistory({
                userId,
                pageId,
                messageId,
                senderId,
                senderName,
                messageText,
                responseText: responseData.text,
                responseType: responseData.type,
                matchedKeyword: responseData.matchedKeyword,
                processingTime: totalProcessingTime,
                errorMessage: responseData.error
            });

            // Log système
            await this.logEvent('message_processed', {
                pageId,
                responseType: responseData.type,
                processingTime: totalProcessingTime
            });

        } catch (error) {
            console.error('Erreur lors du traitement du message:', error);
            
            // Enregistrer l'erreur
            await this.saveMessageHistory({
                userId: null,
                pageId,
                messageId: messagingData.message?.mid,
                senderId: messagingData.sender?.id,
                messageText: messagingData.message?.text,
                responseText: null,
                responseType: 'error',
                processingTime: Date.now() - startTime,
                errorMessage: error.message
            });
        }
    }

    /**
     * Recherche une réponse prédéfinie correspondante
     */
    async findPredefinedResponse(userId, pageId, messageText) {
        try {
            const [responses] = await this.db.execute(`
                SELECT * FROM predefined_responses 
                WHERE user_id = ? AND page_id = ? AND is_active = true 
                ORDER BY priority DESC, LENGTH(keyword) DESC
            `, [userId, pageId]);

            const normalizedMessage = messageText.toLowerCase().trim();

            for (const response of responses) {
                const keyword = response.case_sensitive ? 
                    response.keyword : response.keyword.toLowerCase();
                
                let match = false;

                switch (response.match_type) {
                    case 'exact':
                        match = normalizedMessage === keyword;
                        break;
                    case 'starts_with':
                        match = normalizedMessage.startsWith(keyword);
                        break;
                    case 'ends_with':
                        match = normalizedMessage.endsWith(keyword);
                        break;
                    case 'contains':
                    default:
                        match = normalizedMessage.includes(keyword);
                        break;
                }

                if (match) {
                    return response;
                }
            }

            return null;
        } catch (error) {
            console.error('Erreur lors de la recherche de réponse prédéfinie:', error);
            return null;
        }
    }

    /**
     * Essaie de générer une réponse avec l'IA
     */
    async tryAIResponse(userId, pageId, messageText) {
        try {
            const [aiConfigs] = await this.db.execute(`
                SELECT * FROM ai_configs 
                WHERE user_id = ? AND page_id = ? AND is_active = true
            `, [userId, pageId]);

            if (aiConfigs.length === 0) {
                return null;
            }

            const aiConfig = aiConfigs[0];
            
            // Vérifier si on utilise l'IA seulement en fallback
            if (aiConfig.fallback_only) {
                // L'IA n'est utilisée que si aucune réponse prédéfinie n'est trouvée
                // Cette vérification est déjà faite dans processIncomingMessage
            }

            const aiResponse = await this.aiManager.generateResponse(messageText, aiConfig);
            
            return {
                text: aiResponse.text,
                processingTime: aiResponse.processingTime,
                provider: aiResponse.provider,
                model: aiResponse.model
            };

        } catch (error) {
            console.error('Erreur lors de la génération IA:', error);
            return {
                text: null,
                error: error.message
            };
        }
    }

    /**
     * Envoie un message via l'API Facebook
     */
    async sendMessage(pageId, recipientId, messageText, accessToken) {
        try {
            const response = await axios.post(
                `${this.graphAPI}/${pageId}/messages`,
                {
                    recipient: { id: recipientId },
                    message: { text: messageText },
                    messaging_type: 'RESPONSE'
                },
                {
                    headers: {
                        'Authorization': `Bearer ${accessToken}`,
                        'Content-Type': 'application/json'
                    },
                    timeout: 10000
                }
            );

            console.log('Message envoyé avec succès:', response.data);
            return response.data;

        } catch (error) {
            console.error('Erreur lors de l\'envoi du message:', error.response?.data || error.message);
            throw error;
        }
    }

    /**
     * Récupère le nom de l'expéditeur
     */
    async getSenderName(senderId, accessToken) {
        try {
            const response = await axios.get(
                `${this.graphAPI}/${senderId}?fields=first_name,last_name&access_token=${accessToken}`
            );

            const { first_name, last_name } = response.data;
            return `${first_name || ''} ${last_name || ''}`.trim();

        } catch (error) {
            console.error('Erreur lors de la récupération du nom:', error);
            return null;
        }
    }

    /**
     * Valide un token Facebook
     */
    async validatePageToken(pageId, accessToken) {
        try {
            const response = await axios.get(
                `${this.graphAPI}/${pageId}?fields=name,id&access_token=${accessToken}`
            );

            return {
                valid: true,
                pageInfo: response.data
            };

        } catch (error) {
            return {
                valid: false,
                error: error.response?.data?.error?.message || error.message
            };
        }
    }

    /**
     * Configure le webhook pour une page
     */
    async setupWebhook(pageId, accessToken, webhookUrl, verifyToken) {
        try {
            // S'abonner aux événements de la page
            const response = await axios.post(
                `${this.graphAPI}/${pageId}/subscribed_apps`,
                {
                    subscribed_fields: 'messages,messaging_postbacks,messaging_optins'
                },
                {
                    headers: {
                        'Authorization': `Bearer ${accessToken}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            return {
                success: true,
                message: 'Webhook configuré avec succès'
            };

        } catch (error) {
            return {
                success: false,
                error: error.response?.data?.error?.message || error.message
            };
        }
    }

    /**
     * Sauvegarde l'historique des messages
     */
    async saveMessageHistory(data) {
        try {
            await this.db.execute(`
                INSERT INTO message_history (
                    user_id, page_id, message_id, sender_id, sender_name,
                    message_text, response_text, response_type, matched_keyword,
                    processing_time_ms, error_message
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                data.userId,
                data.pageId,
                data.messageId,
                data.senderId,
                data.senderName,
                data.messageText,
                data.responseText,
                data.responseType,
                data.matchedKeyword,
                data.processingTime,
                data.errorMessage
            ]);

        } catch (error) {
            console.error('Erreur lors de la sauvegarde de l\'historique:', error);
        }
    }

    /**
     * Enregistre un événement système
     */
    async logEvent(eventType, metadata = {}, logLevel = 'info', userId = null) {
        try {
            await this.db.execute(`
                INSERT INTO system_logs (user_id, page_id, log_level, event_type, message, metadata)
                VALUES (?, ?, ?, ?, ?, ?)
            `, [
                userId,
                metadata.pageId || null,
                logLevel,
                eventType,
                metadata.message || `Événement: ${eventType}`,
                JSON.stringify(metadata)
            ]);

        } catch (error) {
            console.error('Erreur lors de l\'enregistrement du log:', error);
        }
    }

    /**
     * Récupère l'historique des messages pour une page
     */
    async getMessageHistory(userId, pageId = null, limit = 100, offset = 0) {
        try {
            let query = `
                SELECT * FROM message_history 
                WHERE user_id = ?
            `;
            let params = [userId];

            if (pageId) {
                query += ` AND page_id = ?`;
                params.push(pageId);
            }

            query += ` ORDER BY processed_at DESC LIMIT ? OFFSET ?`;
            params.push(limit, offset);

            const [history] = await this.db.execute(query, params);
            return history;

        } catch (error) {
            console.error('Erreur lors de la récupération de l\'historique:', error);
            return [];
        }
    }

    /**
     * Récupère les statistiques pour le dashboard
     */
    async getDashboardStats(userId) {
        try {
            const stats = {};

            // Nombre total de pages
            const [pagesCount] = await this.db.execute(
                'SELECT COUNT(*) as count FROM facebook_pages WHERE user_id = ? AND is_active = true',
                [userId]
            );
            stats.totalPages = pagesCount[0].count;

            // Nombre total de réponses actives
            const [responsesCount] = await this.db.execute(
                'SELECT COUNT(*) as count FROM predefined_responses WHERE user_id = ? AND is_active = true',
                [userId]
            );
            stats.totalResponses = responsesCount[0].count;

            // Messages traités aujourd'hui
            const [messagesCount] = await this.db.execute(`
                SELECT COUNT(*) as count FROM message_history 
                WHERE user_id = ? AND DATE(processed_at) = CURDATE()
            `, [userId]);
            stats.todayMessages = messagesCount[0].count;

            // Messages traités cette semaine
            const [weekMessagesCount] = await this.db.execute(`
                SELECT COUNT(*) as count FROM message_history 
                WHERE user_id = ? AND YEARWEEK(processed_at) = YEARWEEK(NOW())
            `, [userId]);
            stats.weekMessages = weekMessagesCount[0].count;

            // Nombre de configurations IA actives
            const [aiCount] = await this.db.execute(
                'SELECT COUNT(*) as count FROM ai_configs WHERE user_id = ? AND is_active = true',
                [userId]
            );
            stats.aiConfigured = aiCount[0].count;

            // Répartition des types de réponses (derniers 7 jours)
            const [responseTypes] = await this.db.execute(`
                SELECT response_type, COUNT(*) as count 
                FROM message_history 
                WHERE user_id = ? AND processed_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
                GROUP BY response_type
            `, [userId]);
            stats.responseTypeDistribution = responseTypes;

            // Pages les plus actives
            const [activePages] = await this.db.execute(`
                SELECT fp.page_name, COUNT(mh.id) as message_count
                FROM facebook_pages fp
                LEFT JOIN message_history mh ON fp.page_id = mh.page_id
                WHERE fp.user_id = ? AND fp.is_active = true
                AND (mh.processed_at >= DATE_SUB(NOW(), INTERVAL 7 DAY) OR mh.processed_at IS NULL)
                GROUP BY fp.page_id, fp.page_name
                ORDER BY message_count DESC
                LIMIT 5
            `, [userId]);
            stats.mostActivePages = activePages;

            return stats;

        } catch (error) {
            console.error('Erreur lors de la récupération des statistiques:', error);
            return {};
        }
    }

    /**
     * Test de connectivité Facebook
     */
    async testFacebookConnection(pageId, accessToken) {
        try {
            // Test basique de lecture
            const pageInfo = await this.validatePageToken(pageId, accessToken);
            if (!pageInfo.valid) {
                return { success: false, error: pageInfo.error };
            }

            // Test des permissions
            const permissions = await this.checkPermissions(pageId, accessToken);
            
            // Test d'envoi (message de test à soi-même)
            try {
                await axios.get(
                    `${this.graphAPI}/${pageId}/conversations?access_token=${accessToken}&limit=1`
                );
            } catch (error) {
                console.warn('Permissions conversations limitées:', error.message);
            }

            return {
                success: true,
                pageInfo: pageInfo.pageInfo,
                permissions: permissions
            };

        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Vérifier les permissions de la page
     */
    async checkPermissions(pageId, accessToken) {
        try {
            const response = await axios.get(
                `${this.graphAPI}/me/permissions?access_token=${accessToken}`
            );

            const permissions = response.data.data.reduce((acc, perm) => {
                acc[perm.permission] = perm.status === 'granted';
                return acc;
            }, {});

            return permissions;

        } catch (error) {
            console.error('Erreur lors de la vérification des permissions:', error);
            return {};
        }
    }

    /**
     * Nettoyage automatique des anciens logs
     */
    async cleanupOldData() {
        try {
            // Nettoyer les logs système de plus de 30 jours
            await this.db.execute(
                'DELETE FROM system_logs WHERE created_at < DATE_SUB(NOW(), INTERVAL 30 DAY)'
            );

            // Nettoyer l'historique des messages de plus de 90 jours
            await this.db.execute(
                'DELETE FROM message_history WHERE processed_at < DATE_SUB(NOW(), INTERVAL 90 DAY)'
            );

            // Nettoyer les événements webhook traités de plus de 7 jours
            await this.db.execute(
                'DELETE FROM webhook_events WHERE processed = true AND created_at < DATE_SUB(NOW(), INTERVAL 7 DAY)'
            );

            await this.logEvent('cleanup_completed', {
                message: 'Nettoyage automatique des anciennes données effectué'
            });

        } catch (error) {
            console.error('Erreur lors du nettoyage:', error);
            await this.logEvent('cleanup_error', {
                message: 'Erreur lors du nettoyage automatique',
                error: error.message
            }, 'error');
        }
    }

    /**
     * Sauvegarde un événement webhook pour traitement différé
     */
    async saveWebhookEvent(pageId, eventType, rawData) {
        try {
            await this.db.execute(`
                INSERT INTO webhook_events (page_id, event_type, raw_data)
                VALUES (?, ?, ?)
            `, [pageId, eventType, JSON.stringify(rawData)]);

        } catch (error) {
            console.error('Erreur lors de la sauvegarde de l\'événement webhook:', error);
        }
    }

    /**
     * Traite les événements webhook en attente
     */
    async processQueuedEvents() {
        try {
            const [events] = await this.db.execute(`
                SELECT * FROM webhook_events 
                WHERE processed = false AND retry_count < 3
                ORDER BY created_at ASC 
                LIMIT 10
            `);

            for (const event of events) {
                try {
                    const rawData = JSON.parse(event.raw_data);
                    
                    if (event.event_type === 'message') {
                        await this.processIncomingMessage(event.page_id, rawData);
                    }

                    // Marquer comme traité
                    await this.db.execute(
                        'UPDATE webhook_events SET processed = true, processed_at = NOW() WHERE id = ?',
                        [event.id]
                    );

                } catch (error) {
                    // Incrémenter le compteur de tentatives
                    await this.db.execute(
                        'UPDATE webhook_events SET retry_count = retry_count + 1, error_message = ? WHERE id = ?',
                        [error.message, event.id]
                    );

                    console.error(`Erreur lors du traitement de l'événement ${event.id}:`, error);
                }
            }

        } catch (error) {
            console.error('Erreur lors du traitement de la queue:', error);
        }
    }

    /**
     * Génère un rapport d'activité
     */
    async generateActivityReport(userId, startDate, endDate) {
        try {
            const report = {};

            // Messages par jour
            const [dailyMessages] = await this.db.execute(`
                SELECT DATE(processed_at) as date, COUNT(*) as count
                FROM message_history 
                WHERE user_id = ? AND processed_at BETWEEN ? AND ?
                GROUP BY DATE(processed_at)
                ORDER BY date ASC
            `, [userId, startDate, endDate]);
            report.dailyMessages = dailyMessages;

            // Répartition par type de réponse
            const [responseTypes] = await this.db.execute(`
                SELECT response_type, COUNT(*) as count
                FROM message_history 
                WHERE user_id = ? AND processed_at BETWEEN ? AND ?
                GROUP BY response_type
            `, [userId, startDate, endDate]);
            report.responseTypes = responseTypes;

            // Top mots-clés utilisés
            const [topKeywords] = await this.db.execute(`
                SELECT matched_keyword, COUNT(*) as count
                FROM message_history 
                WHERE user_id = ? AND processed_at BETWEEN ? AND ? 
                AND matched_keyword IS NOT NULL
                GROUP BY matched_keyword
                ORDER BY count DESC
                LIMIT 10
            `, [userId, startDate, endDate]);
            report.topKeywords = topKeywords;

            // Temps de traitement moyen
            const [avgProcessing] = await this.db.execute(`
                SELECT AVG(processing_time_ms) as avg_time, response_type
                FROM message_history 
                WHERE user_id = ? AND processed_at BETWEEN ? AND ?
                AND processing_time_ms IS NOT NULL
                GROUP BY response_type
            `, [userId, startDate, endDate]);
            report.avgProcessingTime = avgProcessing;

            return report;

        } catch (error) {
            console.error('Erreur lors de la génération du rapport:', error);
            return {};
        }
    }
}

module.exports = FacebookManager;
