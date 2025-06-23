const ConfigService = require('../services/configService');
const logger = require('../utils/logger');

class ConfigController {
    constructor() {
        this.configService = new ConfigService();
    }

    // Criar nova configuração
    async createConfig(req, res) {
        try {
            const configData = {
                config_key: req.body.config_key,
                config_value: req.body.config_value,
                config_type: req.body.config_type,
                config_category: req.body.config_category,
                description: req.body.description,
                validation_schema: req.body.validation_schema,
                created_by: req.user?.username || 'api'
            };

            const config = await this.configService.createConfig(configData);
            
            res.status(201).json({
                success: true,
                message: 'Configuração criada com sucesso',
                data: config
            });
        } catch (error) {
            logger.error('Erro no controller createConfig:', error);
            res.status(400).json({
                success: false,
                message: error.message,
                error: process.env.NODE_ENV === 'development' ? error.stack : undefined
            });
        }
    }

    // Buscar configuração específica
    async getConfig(req, res) {
        try {
            const { key } = req.params;
            const config = await this.configService.getConfig(key);
            
            if (!config) {
                return res.status(404).json({
                    success: false,
                    message: 'Configuração não encontrada'
                });
            }

            res.json({
                success: true,
                data: config
            });
        } catch (error) {
            logger.error('Erro no controller getConfig:', error);
            res.status(500).json({
                success: false,
                message: 'Erro interno do servidor',
                error: process.env.NODE_ENV === 'development' ? error.stack : undefined
            });
        }
    }

    // Buscar apenas o valor da configuração
    async getConfigValue(req, res) {
        try {
            const { key } = req.params;
            const { default: defaultValue } = req.query;
            
            const value = await this.configService.getConfigValue(key, defaultValue);
            
            res.json({
                success: true,
                data: {
                    key,
                    value
                }
            });
        } catch (error) {
            logger.error('Erro no controller getConfigValue:', error);
            res.status(500).json({
                success: false,
                message: 'Erro interno do servidor',
                error: process.env.NODE_ENV === 'development' ? error.stack : undefined
            });
        }
    }

    // Buscar configurações por categoria
    async getConfigsByCategory(req, res) {
        try {
            const { category } = req.params;
            const configs = await this.configService.getConfigsByCategory(category);
            
            res.json({
                success: true,
                data: configs
            });
        } catch (error) {
            logger.error('Erro no controller getConfigsByCategory:', error);
            res.status(500).json({
                success: false,
                message: 'Erro interno do servidor',
                error: process.env.NODE_ENV === 'development' ? error.stack : undefined
            });
        }
    }

    // Buscar configurações por tipo
    async getConfigsByType(req, res) {
        try {
            const { type } = req.params;
            const configs = await this.configService.getConfigsByType(type);
            
            res.json({
                success: true,
                data: configs
            });
        } catch (error) {
            logger.error('Erro no controller getConfigsByType:', error);
            res.status(500).json({
                success: false,
                message: 'Erro interno do servidor',
                error: process.env.NODE_ENV === 'development' ? error.stack : undefined
            });
        }
    }

    // Atualizar configuração
    async updateConfig(req, res) {
        try {
            const { key } = req.params;
            const updateData = {
                config_value: req.body.config_value,
                description: req.body.description,
                validation_schema: req.body.validation_schema,
                updated_by: req.user?.username || 'api'
            };

            const config = await this.configService.updateConfig(key, updateData);
            
            res.json({
                success: true,
                message: 'Configuração atualizada com sucesso',
                data: config
            });
        } catch (error) {
            logger.error('Erro no controller updateConfig:', error);
            res.status(400).json({
                success: false,
                message: error.message,
                error: process.env.NODE_ENV === 'development' ? error.stack : undefined
            });
        }
    }

    // Deletar configuração
    async deleteConfig(req, res) {
        try {
            const { key } = req.params;
            const deletedBy = req.user?.username || 'api';
            
            const config = await this.configService.deleteConfig(key, deletedBy);
            
            res.json({
                success: true,
                message: 'Configuração deletada com sucesso',
                data: config
            });
        } catch (error) {
            logger.error('Erro no controller deleteConfig:', error);
            res.status(400).json({
                success: false,
                message: error.message,
                error: process.env.NODE_ENV === 'development' ? error.stack : undefined
            });
        }
    }

    // Buscar histórico de mudanças
    async getConfigHistory(req, res) {
        try {
            const { key } = req.params;
            const history = await this.configService.getConfigHistory(key);
            
            res.json({
                success: true,
                data: {
                    config_key: key,
                    history
                }
            });
        } catch (error) {
            logger.error('Erro no controller getConfigHistory:', error);
            res.status(500).json({
                success: false,
                message: 'Erro interno do servidor',
                error: process.env.NODE_ENV === 'development' ? error.stack : undefined
            });
        }
    }

    // Buscar todas as configurações
    async getAllConfigs(req, res) {
        try {
            const configs = await this.configService.getAllConfigs();
            
            res.json({
                success: true,
                data: configs
            });
        } catch (error) {
            logger.error('Erro no controller getAllConfigs:', error);
            res.status(500).json({
                success: false,
                message: 'Erro interno do servidor',
                error: process.env.NODE_ENV === 'development' ? error.stack : undefined
            });
        }
    }

    // Validar configuração
    async validateConfig(req, res) {
        try {
            const { config_value, validation_schema } = req.body;
            
            const validation = this.configService.validateConfig(config_value, validation_schema);
            
            res.json({
                success: true,
                data: validation
            });
        } catch (error) {
            logger.error('Erro no controller validateConfig:', error);
            res.status(500).json({
                success: false,
                message: 'Erro interno do servidor',
                error: process.env.NODE_ENV === 'development' ? error.stack : undefined
            });
        }
    }

    // Limpar cache
    async clearCache(req, res) {
        try {
            const { key } = req.params;
            
            this.configService.clearCache(key);
            
            res.json({
                success: true,
                message: key ? `Cache da configuração '${key}' limpo` : 'Todo o cache foi limpo'
            });
        } catch (error) {
            logger.error('Erro no controller clearCache:', error);
            res.status(500).json({
                success: false,
                message: 'Erro interno do servidor',
                error: process.env.NODE_ENV === 'development' ? error.stack : undefined
            });
        }
    }

    // Endpoints específicos para configurações CPA
    async getCpaLevelAmounts(req, res) {
        try {
            const amounts = await this.configService.getCpaLevelAmounts();
            
            res.json({
                success: true,
                data: amounts
            });
        } catch (error) {
            logger.error('Erro no controller getCpaLevelAmounts:', error);
            res.status(500).json({
                success: false,
                message: 'Erro interno do servidor',
                error: process.env.NODE_ENV === 'development' ? error.stack : undefined
            });
        }
    }

    async getCpaValidationRules(req, res) {
        try {
            const rules = await this.configService.getCpaValidationRules();
            
            res.json({
                success: true,
                data: rules
            });
        } catch (error) {
            logger.error('Erro no controller getCpaValidationRules:', error);
            res.status(500).json({
                success: false,
                message: 'Erro interno do servidor',
                error: process.env.NODE_ENV === 'development' ? error.stack : undefined
            });
        }
    }

    async getSystemSettings(req, res) {
        try {
            const settings = await this.configService.getSystemSettings();
            
            res.json({
                success: true,
                data: settings
            });
        } catch (error) {
            logger.error('Erro no controller getSystemSettings:', error);
            res.status(500).json({
                success: false,
                message: 'Erro interno do servidor',
                error: process.env.NODE_ENV === 'development' ? error.stack : undefined
            });
        }
    }

    async getMlmSettings(req, res) {
        try {
            const settings = await this.configService.getMlmSettings();
            
            res.json({
                success: true,
                data: settings
            });
        } catch (error) {
            logger.error('Erro no controller getMlmSettings:', error);
            res.status(500).json({
                success: false,
                message: 'Erro interno do servidor',
                error: process.env.NODE_ENV === 'development' ? error.stack : undefined
            });
        }
    }

    async getExternalApisSettings(req, res) {
        try {
            const settings = await this.configService.getExternalApisSettings();
            
            res.json({
                success: true,
                data: settings
            });
        } catch (error) {
            logger.error('Erro no controller getExternalApisSettings:', error);
            res.status(500).json({
                success: false,
                message: 'Erro interno do servidor',
                error: process.env.NODE_ENV === 'development' ? error.stack : undefined
            });
        }
    }

    // Health check
    async healthCheck(req, res) {
        try {
            // Testar conexão com banco
            await this.configService.getAllConfigs();
            
            res.json({
                success: true,
                message: 'Config Service está funcionando',
                timestamp: new Date().toISOString(),
                version: process.env.npm_package_version || '1.0.0'
            });
        } catch (error) {
            logger.error('Erro no health check:', error);
            res.status(503).json({
                success: false,
                message: 'Serviço indisponível',
                error: error.message
            });
        }
    }
}

module.exports = ConfigController;

