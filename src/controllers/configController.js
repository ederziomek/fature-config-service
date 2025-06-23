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

    // Health check melhorado com múltiplas camadas
    async healthCheck(req, res) {
        const startTime = Date.now();
        const healthStatus = {
            success: true,
            message: 'Config Service está funcionando',
            timestamp: new Date().toISOString(),
            version: process.env.npm_package_version || '1.0.0',
            uptime: process.uptime(),
            checks: {
                service: { status: 'ok', message: 'Serviço rodando' },
                database: { status: 'unknown', message: 'Não testado' },
                functionality: { status: 'unknown', message: 'Não testado' }
            },
            responseTime: 0
        };

        try {
            // Nível 1: Verificar se o serviço está rodando (sempre passa)
            healthStatus.checks.service = { 
                status: 'ok', 
                message: 'Serviço rodando normalmente' 
            };

            // Nível 2: Verificar conectividade básica com banco (opcional)
            try {
                const { Pool } = require('pg');
                const pool = new Pool({
                    host: process.env.DB_HOST,
                    port: process.env.DB_PORT,
                    database: process.env.DB_NAME,
                    user: process.env.DB_USER,
                    password: process.env.DB_PASSWORD,
                    ssl: process.env.DB_SSL === 'true',
                    connectionTimeoutMillis: 5000, // 5 segundos timeout
                    query_timeout: 3000 // 3 segundos para query
                });

                // Teste simples de conectividade
                const client = await pool.connect();
                await client.query('SELECT 1');
                client.release();
                await pool.end();

                healthStatus.checks.database = { 
                    status: 'ok', 
                    message: 'Conectividade com banco OK' 
                };

                // Nível 3: Verificar funcionalidade (apenas se banco estiver OK)
                try {
                    // Teste mais leve - apenas verificar se a tabela existe
                    const pool2 = new Pool({
                        host: process.env.DB_HOST,
                        port: process.env.DB_PORT,
                        database: process.env.DB_NAME,
                        user: process.env.DB_USER,
                        password: process.env.DB_PASSWORD,
                        ssl: process.env.DB_SSL === 'true',
                        connectionTimeoutMillis: 3000,
                        query_timeout: 2000
                    });

                    const client2 = await pool2.connect();
                    const result = await client2.query(`
                        SELECT table_name 
                        FROM information_schema.tables 
                        WHERE table_name = 'system_configurations'
                    `);
                    client2.release();
                    await pool2.end();

                    if (result.rows.length > 0) {
                        healthStatus.checks.functionality = { 
                            status: 'ok', 
                            message: 'Tabelas configuradas corretamente' 
                        };
                    } else {
                        healthStatus.checks.functionality = { 
                            status: 'warning', 
                            message: 'Tabelas não encontradas - funcionalidade limitada' 
                        };
                    }
                } catch (funcError) {
                    logger.warn('Erro no teste de funcionalidade:', funcError.message);
                    healthStatus.checks.functionality = { 
                        status: 'warning', 
                        message: 'Funcionalidade limitada - tabelas não configuradas' 
                    };
                }

            } catch (dbError) {
                logger.warn('Erro na conectividade com banco:', dbError.message);
                healthStatus.checks.database = { 
                    status: 'warning', 
                    message: `Banco indisponível: ${dbError.message}` 
                };
                healthStatus.checks.functionality = { 
                    status: 'warning', 
                    message: 'Funcionalidade limitada - banco indisponível' 
                };
            }

            // Calcular tempo de resposta
            healthStatus.responseTime = Date.now() - startTime;

            // Determinar status geral
            const hasErrors = Object.values(healthStatus.checks).some(check => check.status === 'error');
            const hasWarnings = Object.values(healthStatus.checks).some(check => check.status === 'warning');

            if (hasErrors) {
                healthStatus.success = false;
                healthStatus.message = 'Serviço com problemas críticos';
                return res.status(503).json(healthStatus);
            } else if (hasWarnings) {
                healthStatus.message = 'Serviço funcionando com limitações';
                return res.status(200).json(healthStatus);
            } else {
                healthStatus.message = 'Serviço funcionando perfeitamente';
                return res.status(200).json(healthStatus);
            }

        } catch (error) {
            logger.error('Erro no health check:', error);
            healthStatus.success = false;
            healthStatus.message = 'Erro interno no health check';
            healthStatus.checks.service = { 
                status: 'error', 
                message: `Erro interno: ${error.message}` 
            };
            healthStatus.responseTime = Date.now() - startTime;
            
            return res.status(503).json(healthStatus);
        }
    }
}

module.exports = ConfigController;

