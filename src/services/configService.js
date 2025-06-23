const ConfigModel = require('../models/configModel');
const logger = require('../utils/logger');
const Joi = require('joi');

class ConfigService {
    constructor() {
        this.configModel = new ConfigModel();
        this.cache = new Map();
        this.cacheTTL = new Map();
        this.subscribers = new Map();
    }

    // Validar configuração usando schema
    validateConfig(configValue, validationSchema) {
        if (!validationSchema) {
            return { valid: true };
        }

        try {
            const schema = this.convertToJoiSchema(validationSchema);
            const { error, value } = schema.validate(configValue);
            
            if (error) {
                return {
                    valid: false,
                    errors: error.details.map(detail => ({
                        field: detail.path.join('.'),
                        message: detail.message
                    }))
                };
            }

            return { valid: true, value };
        } catch (error) {
            logger.error('Erro na validação:', error);
            return {
                valid: false,
                errors: [{ field: 'schema', message: 'Schema de validação inválido' }]
            };
        }
    }

    // Converter schema JSON para Joi
    convertToJoiSchema(jsonSchema) {
        if (jsonSchema.type === 'object') {
            let joiObject = {};
            
            if (jsonSchema.properties) {
                for (const [key, prop] of Object.entries(jsonSchema.properties)) {
                    joiObject[key] = this.convertPropertyToJoi(prop);
                }
            }

            let schema = Joi.object(joiObject);
            
            if (jsonSchema.required) {
                schema = schema.required();
            }

            return schema;
        }

        return this.convertPropertyToJoi(jsonSchema);
    }

    convertPropertyToJoi(property) {
        switch (property.type) {
            case 'string':
                let stringSchema = Joi.string();
                if (property.enum) {
                    stringSchema = stringSchema.valid(...property.enum);
                }
                return stringSchema;

            case 'number':
                let numberSchema = Joi.number();
                if (property.minimum !== undefined) {
                    numberSchema = numberSchema.min(property.minimum);
                }
                if (property.maximum !== undefined) {
                    numberSchema = numberSchema.max(property.maximum);
                }
                return numberSchema;

            case 'boolean':
                return Joi.boolean();

            case 'array':
                let arraySchema = Joi.array();
                if (property.items) {
                    arraySchema = arraySchema.items(this.convertPropertyToJoi(property.items));
                }
                return arraySchema;

            case 'object':
                return this.convertToJoiSchema(property);

            default:
                return Joi.any();
        }
    }

    // Criar nova configuração
    async createConfig(configData) {
        try {
            // Validar dados de entrada
            const validation = this.validateConfig(configData.config_value, configData.validation_schema);
            if (!validation.valid) {
                throw new Error(`Validação falhou: ${JSON.stringify(validation.errors)}`);
            }

            const config = await this.configModel.createConfig(configData);
            
            // Limpar cache
            this.clearCache(config.config_key);
            
            // Notificar subscribers
            this.notifySubscribers(config.config_key, config.config_value);
            
            logger.info(`Configuração criada: ${config.config_key}`);
            return config;
        } catch (error) {
            logger.error('Erro ao criar configuração:', error);
            throw error;
        }
    }

    // Buscar configuração (com cache)
    async getConfig(configKey) {
        try {
            // Verificar cache primeiro
            const cached = this.getFromCache(configKey);
            if (cached) {
                return cached;
            }

            // Buscar no banco
            const config = await this.configModel.getConfig(configKey);
            
            if (config) {
                // Adicionar ao cache
                this.addToCache(configKey, config);
                return config;
            }

            return null;
        } catch (error) {
            logger.error('Erro ao buscar configuração:', error);
            throw error;
        }
    }

    // Buscar apenas o valor da configuração
    async getConfigValue(configKey, defaultValue = null) {
        try {
            const config = await this.getConfig(configKey);
            return config ? config.config_value : defaultValue;
        } catch (error) {
            logger.error('Erro ao buscar valor da configuração:', error);
            return defaultValue;
        }
    }

    // Buscar configurações por categoria
    async getConfigsByCategory(category) {
        try {
            return await this.configModel.getConfigsByCategory(category);
        } catch (error) {
            logger.error('Erro ao buscar configurações por categoria:', error);
            throw error;
        }
    }

    // Buscar configurações por tipo
    async getConfigsByType(type) {
        try {
            return await this.configModel.getConfigsByType(type);
        } catch (error) {
            logger.error('Erro ao buscar configurações por tipo:', error);
            throw error;
        }
    }

    // Atualizar configuração
    async updateConfig(configKey, updateData) {
        try {
            // Buscar configuração atual para validação
            const currentConfig = await this.configModel.getConfig(configKey);
            if (!currentConfig) {
                throw new Error('Configuração não encontrada');
            }

            // Validar novos dados
            const validationSchema = updateData.validation_schema || currentConfig.validation_schema;
            const validation = this.validateConfig(updateData.config_value, validationSchema);
            if (!validation.valid) {
                throw new Error(`Validação falhou: ${JSON.stringify(validation.errors)}`);
            }

            const config = await this.configModel.updateConfig(configKey, updateData);
            
            // Limpar cache
            this.clearCache(configKey);
            
            // Notificar subscribers
            this.notifySubscribers(configKey, config.config_value);
            
            logger.info(`Configuração atualizada: ${configKey}`);
            return config;
        } catch (error) {
            logger.error('Erro ao atualizar configuração:', error);
            throw error;
        }
    }

    // Deletar configuração
    async deleteConfig(configKey, deletedBy) {
        try {
            const config = await this.configModel.deleteConfig(configKey, deletedBy);
            
            // Limpar cache
            this.clearCache(configKey);
            
            // Notificar subscribers
            this.notifySubscribers(configKey, null);
            
            logger.info(`Configuração deletada: ${configKey}`);
            return config;
        } catch (error) {
            logger.error('Erro ao deletar configuração:', error);
            throw error;
        }
    }

    // Buscar histórico de mudanças
    async getConfigHistory(configKey) {
        try {
            return await this.configModel.getConfigHistory(configKey);
        } catch (error) {
            logger.error('Erro ao buscar histórico:', error);
            throw error;
        }
    }

    // Buscar todas as configurações
    async getAllConfigs() {
        try {
            return await this.configModel.getAllConfigs();
        } catch (error) {
            logger.error('Erro ao buscar todas as configurações:', error);
            throw error;
        }
    }

    // Métodos de cache
    getFromCache(key) {
        if (this.cache.has(key)) {
            const ttl = this.cacheTTL.get(key);
            if (ttl && Date.now() < ttl) {
                return this.cache.get(key);
            } else {
                // Cache expirado
                this.cache.delete(key);
                this.cacheTTL.delete(key);
            }
        }
        return null;
    }

    addToCache(key, value) {
        const ttl = Date.now() + (parseInt(process.env.CACHE_TTL) || 3600) * 1000;
        this.cache.set(key, value);
        this.cacheTTL.set(key, ttl);
        
        // Limitar tamanho do cache
        const maxSize = parseInt(process.env.CACHE_MAX_SIZE) || 1000;
        if (this.cache.size > maxSize) {
            const firstKey = this.cache.keys().next().value;
            this.cache.delete(firstKey);
            this.cacheTTL.delete(firstKey);
        }
    }

    clearCache(key) {
        if (key) {
            this.cache.delete(key);
            this.cacheTTL.delete(key);
        } else {
            this.cache.clear();
            this.cacheTTL.clear();
        }
    }

    // Sistema de notificações
    subscribe(configKey, callback) {
        if (!this.subscribers.has(configKey)) {
            this.subscribers.set(configKey, new Set());
        }
        this.subscribers.get(configKey).add(callback);
    }

    unsubscribe(configKey, callback) {
        if (this.subscribers.has(configKey)) {
            this.subscribers.get(configKey).delete(callback);
        }
    }

    notifySubscribers(configKey, newValue) {
        if (this.subscribers.has(configKey)) {
            const callbacks = this.subscribers.get(configKey);
            callbacks.forEach(callback => {
                try {
                    callback(configKey, newValue);
                } catch (error) {
                    logger.error('Erro ao notificar subscriber:', error);
                }
            });
        }
    }

    // Métodos específicos para configurações CPA
    async getCpaLevelAmounts() {
        return await this.getConfigValue('cpa_level_amounts', {
            level_1: 50.00, level_2: 20.00, level_3: 5.00, level_4: 5.00, level_5: 5.00
        });
    }

    async getCpaValidationRules() {
        return await this.getConfigValue('cpa_validation_rules', {
            groups: [],
            group_operator: 'OR'
        });
    }

    async getSystemSettings() {
        return await this.getConfigValue('system_settings', {
            api_timeout: 30000,
            cache_ttl: 3600,
            max_retries: 3,
            batch_size: 100
        });
    }

    async getMlmSettings() {
        return await this.getConfigValue('mlm_settings', {
            max_hierarchy_levels: 5,
            calculation_method: 'standard',
            auto_distribution: true,
            minimum_amount: 0.01,
            currency: 'BRL'
        });
    }

    async getExternalApisSettings() {
        return await this.getConfigValue('external_apis', {
            operation_db: {
                sync_interval: 300000,
                batch_size: 1000,
                timeout: 30000
            },
            notification_service: {
                retry_attempts: 3,
                retry_delay: 5000
            }
        });
    }

    // Cleanup
    async close() {
        await this.configModel.close();
    }
}

module.exports = ConfigService;

