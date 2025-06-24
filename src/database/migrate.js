const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    ssl: process.env.DB_SSL === 'true',
});

async function createTables() {
    const client = await pool.connect();
    
    try {
        console.log('🚀 Iniciando criação das tabelas...');

        // Criar tabela de configurações sem usar extensão UUID
        await client.query(`
            CREATE TABLE IF NOT EXISTS system_configurations (
                id SERIAL PRIMARY KEY,
                config_key VARCHAR(100) NOT NULL UNIQUE,
                config_value JSONB NOT NULL,
                config_type VARCHAR(50) NOT NULL,
                config_category VARCHAR(50) NOT NULL,
                description TEXT,
                validation_schema JSONB,
                version INTEGER DEFAULT 1,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                created_by VARCHAR(100),
                active BOOLEAN DEFAULT TRUE,
                change_log JSONB DEFAULT '[]'::jsonb
            );
        `);

        // Criar índices para performance
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_config_key ON system_configurations(config_key);
        `);
        
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_config_type ON system_configurations(config_type);
        `);
        
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_config_category ON system_configurations(config_category);
        `);
        
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_config_active ON system_configurations(active);
        `);

        console.log('✅ Tabelas criadas com sucesso!');

        // Inserir configurações iniciais
        await insertInitialConfigs(client);

    } catch (error) {
        console.error('❌ Erro ao criar tabelas:', error);
        throw error;
    } finally {
        client.release();
    }
}

async function insertInitialConfigs(client) {
    console.log('📋 Inserindo configurações iniciais...');

    const initialConfigs = [
        // Configurações CPA
        {
            config_key: 'cpa_level_amounts',
            config_value: {
                level_1: 35.00,
                level_2: 10.00,
                level_3: 5.00,
                level_4: 5.00,
                level_5: 5.00
            },
            config_type: 'cpa',
            config_category: 'commission',
            description: 'Valores de CPA distribuídos por nível MLM',
            validation_schema: {
                type: 'object',
                properties: {
                    level_1: { type: 'number', minimum: 0 },
                    level_2: { type: 'number', minimum: 0 },
                    level_3: { type: 'number', minimum: 0 },
                    level_4: { type: 'number', minimum: 0 },
                    level_5: { type: 'number', minimum: 0 }
                },
                required: ['level_1', 'level_2', 'level_3', 'level_4', 'level_5']
            },
            created_by: 'system'
        },
        {
            config_key: 'cpa_validation_rules',
            config_value: {
                groups: [
                    {
                        operator: 'AND',
                        criteria: [
                            { type: 'deposit', value: 30.00, enabled: true },
                            { type: 'bets', value: 10, enabled: true }
                        ]
                    },
                    {
                        operator: 'AND',
                        criteria: [
                            { type: 'deposit', value: 30.00, enabled: true },
                            { type: 'ggr', value: 25.00, enabled: true }
                        ]
                    }
                ],
                group_operator: 'OR'
            },
            config_type: 'cpa',
            config_category: 'validation',
            description: 'Regras de validação CPA configuráveis',
            validation_schema: {
                type: 'object',
                properties: {
                    groups: {
                        type: 'array',
                        items: {
                            type: 'object',
                            properties: {
                                operator: { type: 'string', enum: ['AND', 'OR'] },
                                criteria: {
                                    type: 'array',
                                    items: {
                                        type: 'object',
                                        properties: {
                                            type: { type: 'string', enum: ['deposit', 'bets', 'ggr'] },
                                            value: { type: 'number', minimum: 0 },
                                            enabled: { type: 'boolean' }
                                        },
                                        required: ['type', 'value', 'enabled']
                                    }
                                }
                            },
                            required: ['operator', 'criteria']
                        }
                    },
                    group_operator: { type: 'string', enum: ['AND', 'OR'] }
                },
                required: ['groups', 'group_operator']
            },
            created_by: 'system'
        },
        // Configurações de Sistema
        {
            config_key: 'system_settings',
            config_value: {
                api_timeout: 30000,
                cache_ttl: 3600,
                max_retries: 3,
                batch_size: 100,
                cpa_monitoring_interval: 300000
            },
            config_type: 'system',
            config_category: 'performance',
            description: 'Configurações gerais do sistema',
            validation_schema: {
                type: 'object',
                properties: {
                    api_timeout: { type: 'number', minimum: 1000 },
                    cache_ttl: { type: 'number', minimum: 60 },
                    max_retries: { type: 'number', minimum: 1, maximum: 10 },
                    batch_size: { type: 'number', minimum: 10, maximum: 1000 },
                    cpa_monitoring_interval: { type: 'number', minimum: 60000 }
                },
                required: ['api_timeout', 'cache_ttl', 'max_retries', 'batch_size']
            },
            created_by: 'system'
        },
        // Configurações MLM
        {
            config_key: 'mlm_settings',
            config_value: {
                max_hierarchy_levels: 5,
                calculation_method: 'standard',
                auto_distribution: true,
                minimum_amount: 0.01,
                currency: 'BRL'
            },
            config_type: 'mlm',
            config_category: 'hierarchy',
            description: 'Configurações do sistema MLM',
            validation_schema: {
                type: 'object',
                properties: {
                    max_hierarchy_levels: { type: 'number', minimum: 1, maximum: 10 },
                    calculation_method: { type: 'string', enum: ['standard', 'progressive'] },
                    auto_distribution: { type: 'boolean' },
                    minimum_amount: { type: 'number', minimum: 0 },
                    currency: { type: 'string', enum: ['BRL', 'USD', 'EUR'] }
                },
                required: ['max_hierarchy_levels', 'calculation_method', 'auto_distribution', 'minimum_amount', 'currency']
            },
            created_by: 'system'
        },
        // Configurações de Integração
        {
            config_key: 'external_apis',
            config_value: {
                operation_db: {
                    sync_interval: 300000,
                    batch_size: 1000,
                    timeout: 30000
                },
                notification_service: {
                    retry_attempts: 3,
                    retry_delay: 5000
                }
            },
            config_type: 'integration',
            config_category: 'external',
            description: 'Configurações de APIs externas',
            validation_schema: {
                type: 'object',
                properties: {
                    operation_db: {
                        type: 'object',
                        properties: {
                            sync_interval: { type: 'number', minimum: 60000 },
                            batch_size: { type: 'number', minimum: 100, maximum: 5000 },
                            timeout: { type: 'number', minimum: 5000 }
                        }
                    },
                    notification_service: {
                        type: 'object',
                        properties: {
                            retry_attempts: { type: 'number', minimum: 1, maximum: 10 },
                            retry_delay: { type: 'number', minimum: 1000 }
                        }
                    }
                }
            },
            created_by: 'system'
        }
    ];

    for (const config of initialConfigs) {
        try {
            // Verificar se já existe
            const existingQuery = 'SELECT id FROM system_configurations WHERE config_key = $1';
            const existingResult = await client.query(existingQuery, [config.config_key]);

            if (existingResult.rows.length === 0) {
                const insertQuery = `
                    INSERT INTO system_configurations 
                    (config_key, config_value, config_type, config_category, description, validation_schema, created_by)
                    VALUES ($1, $2, $3, $4, $5, $6, $7)
                `;

                await client.query(insertQuery, [
                    config.config_key,
                    JSON.stringify(config.config_value),
                    config.config_type,
                    config.config_category,
                    config.description,
                    JSON.stringify(config.validation_schema),
                    config.created_by
                ]);

                console.log(`✅ Configuração '${config.config_key}' inserida`);
            } else {
                console.log(`⚠️  Configuração '${config.config_key}' já existe`);
            }
        } catch (error) {
            console.error(`❌ Erro ao inserir configuração '${config.config_key}':`, error.message);
        }
    }

    console.log('✅ Configurações iniciais processadas!');
}

async function main() {
    try {
        await createTables();
        console.log('🎉 Migração concluída com sucesso!');
    } catch (error) {
        console.error('💥 Erro na migração:', error);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

// Executar se chamado diretamente
if (require.main === module) {
    main();
}

module.exports = { createTables, insertInitialConfigs };

