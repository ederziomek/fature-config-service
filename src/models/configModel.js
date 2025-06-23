const { Pool } = require('pg');
const logger = require('../utils/logger');

class ConfigModel {
    constructor() {
        this.pool = new Pool({
            host: process.env.DB_HOST,
            port: process.env.DB_PORT,
            database: process.env.DB_NAME,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            ssl: process.env.DB_SSL === 'true',
            min: parseInt(process.env.DB_POOL_MIN) || 2,
            max: parseInt(process.env.DB_POOL_MAX) || 10,
        });
    }

    async createConfig(configData) {
        const client = await this.pool.connect();
        try {
            const query = `
                INSERT INTO system_configurations 
                (config_key, config_value, config_type, config_category, description, validation_schema, created_by)
                VALUES ($1, $2, $3, $4, $5, $6, $7)
                RETURNING *
            `;
            
            const values = [
                configData.config_key,
                JSON.stringify(configData.config_value),
                configData.config_type,
                configData.config_category,
                configData.description,
                configData.validation_schema ? JSON.stringify(configData.validation_schema) : null,
                configData.created_by
            ];

            const result = await client.query(query, values);
            
            // Adicionar ao histórico
            await this.addToHistory(client, result.rows[0].id, 'CREATE', null, configData.config_value, configData.created_by);
            
            return result.rows[0];
        } catch (error) {
            logger.error('Erro ao criar configuração:', error);
            throw error;
        } finally {
            client.release();
        }
    }

    async getConfig(configKey) {
        const client = await this.pool.connect();
        try {
            const query = `
                SELECT * FROM system_configurations 
                WHERE config_key = $1 AND active = true
                ORDER BY version DESC
                LIMIT 1
            `;
            
            const result = await client.query(query, [configKey]);
            
            if (result.rows.length > 0) {
                const config = result.rows[0];
                config.config_value = JSON.parse(config.config_value);
                if (config.validation_schema) {
                    config.validation_schema = JSON.parse(config.validation_schema);
                }
                if (config.change_log) {
                    config.change_log = JSON.parse(config.change_log);
                }
                return config;
            }
            
            return null;
        } catch (error) {
            logger.error('Erro ao buscar configuração:', error);
            throw error;
        } finally {
            client.release();
        }
    }

    async getConfigsByCategory(category) {
        const client = await this.pool.connect();
        try {
            const query = `
                SELECT * FROM system_configurations 
                WHERE config_category = $1 AND active = true
                ORDER BY config_key
            `;
            
            const result = await client.query(query, [category]);
            
            return result.rows.map(config => {
                config.config_value = JSON.parse(config.config_value);
                if (config.validation_schema) {
                    config.validation_schema = JSON.parse(config.validation_schema);
                }
                return config;
            });
        } catch (error) {
            logger.error('Erro ao buscar configurações por categoria:', error);
            throw error;
        } finally {
            client.release();
        }
    }

    async getConfigsByType(type) {
        const client = await this.pool.connect();
        try {
            const query = `
                SELECT * FROM system_configurations 
                WHERE config_type = $1 AND active = true
                ORDER BY config_key
            `;
            
            const result = await client.query(query, [type]);
            
            return result.rows.map(config => {
                config.config_value = JSON.parse(config.config_value);
                if (config.validation_schema) {
                    config.validation_schema = JSON.parse(config.validation_schema);
                }
                return config;
            });
        } catch (error) {
            logger.error('Erro ao buscar configurações por tipo:', error);
            throw error;
        } finally {
            client.release();
        }
    }

    async updateConfig(configKey, updateData) {
        const client = await this.pool.connect();
        try {
            await client.query('BEGIN');

            // Buscar configuração atual
            const currentConfig = await this.getConfig(configKey);
            if (!currentConfig) {
                throw new Error('Configuração não encontrada');
            }

            // Atualizar configuração
            const query = `
                UPDATE system_configurations 
                SET config_value = $1, 
                    description = COALESCE($2, description),
                    validation_schema = COALESCE($3, validation_schema),
                    version = version + 1,
                    updated_at = CURRENT_TIMESTAMP
                WHERE config_key = $4 AND active = true
                RETURNING *
            `;
            
            const values = [
                JSON.stringify(updateData.config_value),
                updateData.description,
                updateData.validation_schema ? JSON.stringify(updateData.validation_schema) : null,
                configKey
            ];

            const result = await client.query(query, values);
            
            // Adicionar ao histórico
            await this.addToHistory(
                client, 
                result.rows[0].id, 
                'UPDATE', 
                currentConfig.config_value, 
                updateData.config_value, 
                updateData.updated_by
            );

            await client.query('COMMIT');
            
            const updatedConfig = result.rows[0];
            updatedConfig.config_value = JSON.parse(updatedConfig.config_value);
            if (updatedConfig.validation_schema) {
                updatedConfig.validation_schema = JSON.parse(updatedConfig.validation_schema);
            }
            
            return updatedConfig;
        } catch (error) {
            await client.query('ROLLBACK');
            logger.error('Erro ao atualizar configuração:', error);
            throw error;
        } finally {
            client.release();
        }
    }

    async deleteConfig(configKey, deletedBy) {
        const client = await this.pool.connect();
        try {
            await client.query('BEGIN');

            // Buscar configuração atual
            const currentConfig = await this.getConfig(configKey);
            if (!currentConfig) {
                throw new Error('Configuração não encontrada');
            }

            // Marcar como inativa (soft delete)
            const query = `
                UPDATE system_configurations 
                SET active = false, updated_at = CURRENT_TIMESTAMP
                WHERE config_key = $1 AND active = true
                RETURNING *
            `;
            
            const result = await client.query(query, [configKey]);
            
            // Adicionar ao histórico
            await this.addToHistory(
                client, 
                result.rows[0].id, 
                'DELETE', 
                currentConfig.config_value, 
                null, 
                deletedBy
            );

            await client.query('COMMIT');
            
            return result.rows[0];
        } catch (error) {
            await client.query('ROLLBACK');
            logger.error('Erro ao deletar configuração:', error);
            throw error;
        } finally {
            client.release();
        }
    }

    async getConfigHistory(configKey) {
        const client = await this.pool.connect();
        try {
            const query = `
                SELECT change_log FROM system_configurations 
                WHERE config_key = $1
                ORDER BY version DESC
                LIMIT 1
            `;
            
            const result = await client.query(query, [configKey]);
            
            if (result.rows.length > 0 && result.rows[0].change_log) {
                return JSON.parse(result.rows[0].change_log);
            }
            
            return [];
        } catch (error) {
            logger.error('Erro ao buscar histórico:', error);
            throw error;
        } finally {
            client.release();
        }
    }

    async addToHistory(client, configId, action, oldValue, newValue, changedBy) {
        try {
            // Buscar histórico atual
            const historyQuery = `
                SELECT change_log FROM system_configurations 
                WHERE id = $1
            `;
            
            const historyResult = await client.query(historyQuery, [configId]);
            let changeLog = [];
            
            if (historyResult.rows.length > 0 && historyResult.rows[0].change_log) {
                changeLog = JSON.parse(historyResult.rows[0].change_log);
            }
            
            // Adicionar nova entrada
            const newEntry = {
                action,
                old_value: oldValue,
                new_value: newValue,
                changed_by: changedBy,
                changed_at: new Date().toISOString()
            };
            
            changeLog.push(newEntry);
            
            // Manter apenas os últimos 50 registros
            if (changeLog.length > 50) {
                changeLog = changeLog.slice(-50);
            }
            
            // Atualizar histórico
            const updateQuery = `
                UPDATE system_configurations 
                SET change_log = $1
                WHERE id = $2
            `;
            
            await client.query(updateQuery, [JSON.stringify(changeLog), configId]);
        } catch (error) {
            logger.error('Erro ao adicionar ao histórico:', error);
            // Não propagar o erro para não quebrar a operação principal
        }
    }

    async getAllConfigs() {
        const client = await this.pool.connect();
        try {
            const query = `
                SELECT * FROM system_configurations 
                WHERE active = true
                ORDER BY config_category, config_key
            `;
            
            const result = await client.query(query);
            
            return result.rows.map(config => {
                config.config_value = JSON.parse(config.config_value);
                if (config.validation_schema) {
                    config.validation_schema = JSON.parse(config.validation_schema);
                }
                return config;
            });
        } catch (error) {
            logger.error('Erro ao buscar todas as configurações:', error);
            throw error;
        } finally {
            client.release();
        }
    }

    async close() {
        await this.pool.end();
    }
}

module.exports = ConfigModel;

