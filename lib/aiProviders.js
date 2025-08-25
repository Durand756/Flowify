const axios = require('axios');

/**
 * Gestionnaire unifié pour tous les providers IA
 */
class AIProviderManager {
    constructor() {
        this.providers = {
            openai: new OpenAIProvider(),
            mistral: new MistralProvider(),
            claude: new ClaudeProvider()
        };
    }

    /**
     * Génère une réponse IA selon le provider configuré
     */
    async generateResponse(messageText, config) {
        const provider = this.providers[config.provider.toLowerCase()];
        
        if (!provider) {
            throw new Error(`Provider IA non supporté: ${config.provider}`);
        }

        const startTime = Date.now();
        
        try {
            const response = await provider.generateResponse(messageText, config);
            const processingTime = Date.now() - startTime;
            
            return {
                text: response,
                processingTime,
                provider: config.provider,
                model: config.model
            };
        } catch (error) {
            throw new Error(`Erreur ${config.provider}: ${error.message}`);
        }
    }

    /**
     * Valide la configuration d'un provider
     */
    async validateConfig(config) {
        const provider = this.providers[config.provider.toLowerCase()];
        
        if (!provider) {
            return { valid: false, error: `Provider non supporté: ${config.provider}` };
        }

        return await provider.validateConfig(config);
    }

    /**
     * Retourne la liste des modèles disponibles pour un provider
     */
    getAvailableModels(providerName) {
        const provider = this.providers[providerName.toLowerCase()];
        return provider ? provider.getAvailableModels() : [];
    }
}

/**
 * Provider OpenAI (GPT)
 */
class OpenAIProvider {
    constructor() {
        this.baseURL = 'https://api.openai.com/v1';
        this.models = ['gpt-3.5-turbo', 'gpt-4', 'gpt-4-turbo', 'gpt-4o'];
    }

    async generateResponse(messageText, config) {
        const systemPrompt = this.buildSystemPrompt(config);
        
        const response = await axios.post(
            `${this.baseURL}/chat/completions`,
            {
                model: config.model || 'gpt-3.5-turbo',
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: messageText }
                ],
                temperature: parseFloat(config.temperature) || 0.7,
                max_tokens: parseInt(config.max_tokens) || 500,
                presence_penalty: 0.1,
                frequency_penalty: 0.1
            },
            {
                headers: {
                    'Authorization': `Bearer ${config.api_key}`,
                    'Content-Type': 'application/json'
                },
                timeout: 30000
            }
        );

        return response.data.choices[0].message.content.trim();
    }

    async validateConfig(config) {
        try {
            const response = await axios.post(
                `${this.baseURL}/chat/completions`,
                {
                    model: config.model || 'gpt-3.5-turbo',
                    messages: [{ role: 'user', content: 'Test' }],
                    max_tokens: 5
                },
                {
                    headers: {
                        'Authorization': `Bearer ${config.api_key}`,
                        'Content-Type': 'application/json'
                    },
                    timeout: 10000
                }
            );

            return { valid: true, message: 'Configuration OpenAI valide' };
        } catch (error) {
            return { 
                valid: false, 
                error: `Erreur OpenAI: ${error.response?.data?.error?.message || error.message}` 
            };
        }
    }

    buildSystemPrompt(config) {
        let prompt = `Tu es un assistant de réseaux sociaux pour une page Facebook. `;
        
        // Ton de réponse
        switch (config.tone) {
            case 'professional':
                prompt += `Utilise un ton professionnel et courtois. `;
                break;
            case 'friendly':
                prompt += `Sois amical et chaleureux dans tes réponses. `;
                break;
            case 'humorous':
                prompt += `Utilise de l'humour approprié et sois décontracté. `;
                break;
            case 'formal':
                prompt += `Maintiens un ton formel et respectueux. `;
                break;
            default:
                prompt += `Sois naturel et adapte-toi au contexte. `;
        }

        // Style de réponse
        switch (config.style) {
            case 'short':
                prompt += `Garde tes réponses courtes et concises (max 50 mots). `;
                break;
            case 'medium':
                prompt += `Utilise des réponses de longueur moyenne (50-150 mots). `;
                break;
            case 'long':
                prompt += `Tu peux donner des réponses détaillées si nécessaire. `;
                break;
        }

        // Instructions personnalisées
        if (config.instructions) {
            prompt += `Instructions spéciales: ${config.instructions} `;
        }

        // Langue
        const language = config.language || 'fr';
        prompt += `Réponds toujours en ${language === 'fr' ? 'français' : 'anglais'}.`;

        return prompt;
    }

    getAvailableModels() {
        return this.models;
    }
}

/**
 * Provider Mistral AI
 */
class MistralProvider {
    constructor() {
        this.baseURL = 'https://api.mistral.ai/v1';
        this.models = ['mistral-tiny', 'mistral-small', 'mistral-medium', 'mistral-large'];
    }

    async generateResponse(messageText, config) {
        const systemPrompt = this.buildSystemPrompt(config);
        
        const response = await axios.post(
            `${this.baseURL}/chat/completions`,
            {
                model: config.model || 'mistral-small',
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: messageText }
                ],
                temperature: parseFloat(config.temperature) || 0.7,
                max_tokens: parseInt(config.max_tokens) || 500
            },
            {
                headers: {
                    'Authorization': `Bearer ${config.api_key}`,
                    'Content-Type': 'application/json'
                },
                timeout: 30000
            }
        );

        return response.data.choices[0].message.content.trim();
    }

    async validateConfig(config) {
        try {
            const response = await axios.post(
                `${this.baseURL}/chat/completions`,
                {
                    model: config.model || 'mistral-small',
                    messages: [{ role: 'user', content: 'Test' }],
                    max_tokens: 5
                },
                {
                    headers: {
                        'Authorization': `Bearer ${config.api_key}`,
                        'Content-Type': 'application/json'
                    },
                    timeout: 10000
                }
            );

            return { valid: true, message: 'Configuration Mistral valide' };
        } catch (error) {
            return { 
                valid: false, 
                error: `Erreur Mistral: ${error.response?.data?.message || error.message}` 
            };
        }
    }

    buildSystemPrompt(config) {
        // Utilise la même logique que OpenAI
        return new OpenAIProvider().buildSystemPrompt(config);
    }

    getAvailableModels() {
        return this.models;
    }
}

/**
 * Provider Claude (Anthropic)
 */
class ClaudeProvider {
    constructor() {
        this.baseURL = 'https://api.anthropic.com/v1';
        this.models = ['claude-3-haiku-20240307', 'claude-3-sonnet-20240229', 'claude-3-opus-20240229'];
    }

    async generateResponse(messageText, config) {
        const systemPrompt = this.buildSystemPrompt(config);
        
        const response = await axios.post(
            `${this.baseURL}/messages`,
            {
                model: config.model || 'claude-3-sonnet-20240229',
                max_tokens: parseInt(config.max_tokens) || 500,
                temperature: parseFloat(config.temperature) || 0.7,
                system: systemPrompt,
                messages: [
                    { role: 'user', content: messageText }
                ]
            },
            {
                headers: {
                    'Authorization': `Bearer ${config.api_key}`,
                    'Content-Type': 'application/json',
                    'anthropic-version': '2023-06-01'
                },
                timeout: 30000
            }
        );

        return response.data.content[0].text.trim();
    }

    async validateConfig(config) {
        try {
            const response = await axios.post(
                `${this.baseURL}/messages`,
                {
                    model: config.model || 'claude-3-sonnet-20240229',
                    max_tokens: 10,
                    messages: [{ role: 'user', content: 'Test' }]
                },
                {
                    headers: {
                        'Authorization': `Bearer ${config.api_key}`,
                        'Content-Type': 'application/json',
                        'anthropic-version': '2023-06-01'
                    },
                    timeout: 10000
                }
            );

            return { valid: true, message: 'Configuration Claude valide' };
        } catch (error) {
            return { 
                valid: false, 
                error: `Erreur Claude: ${error.response?.data?.error?.message || error.message}` 
            };
        }
    }

    buildSystemPrompt(config) {
        // Utilise la même logique que OpenAI
        return new OpenAIProvider().buildSystemPrompt(config);
    }

    getAvailableModels() {
        return this.models;
    }
}

module.exports = AIProviderManager;
