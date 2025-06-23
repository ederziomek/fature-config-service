require('dotenv').config();

const express = require('express');
const http = require('http');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');

const configRoutes = require('./routes/configRoutes');
const ConfigNotifier = require('./websocket/configNotifier');
const { requestLogger, errorHandler, corsHandler } = require('./middleware/validation');
const logger = require('./utils/logger');

class ConfigServiceApp {
    constructor() {
        this.app = express();
        this.server = http.createServer(this.app);
        this.port = process.env.PORT || 3000;
        this.host = process.env.HOST || '0.0.0.0';
        
        this.setupMiddleware();
        this.setupRoutes();
        this.setupWebSocket();
        this.setupErrorHandling();
    }

    setupMiddleware() {
        // Segurança
        this.app.use(helmet({
            crossOriginResourcePolicy: { policy: "cross-origin" }
        }));

        // CORS
        this.app.use(cors({
            origin: '*',
            credentials: true,
            methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
            allowedHeaders: ['Origin', 'X-Requested-With', 'Content-Type', 'Accept', 'Authorization', 'X-API-Key']
        }));

        // Compressão
        this.app.use(compression());

        // Parsing
        this.app.use(express.json({ limit: '10mb' }));
        this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

        // Logging
        if (process.env.NODE_ENV !== 'test') {
            this.app.use(morgan('combined', {
                stream: {
                    write: (message) => logger.info(message.trim())
                }
            }));
        }

        this.app.use(requestLogger);

        // Headers customizados
        this.app.use((req, res, next) => {
            res.header('X-Service', 'fature-config-service');
            res.header('X-Version', process.env.npm_package_version || '1.0.0');
            next();
        });
    }

    setupRoutes() {
        // Rota raiz
        this.app.get('/', (req, res) => {
            res.json({
                service: 'Fature Config Service',
                version: process.env.npm_package_version || '1.0.0',
                status: 'running',
                timestamp: new Date().toISOString(),
                endpoints: {
                    health: '/api/v1/health',
                    configs: '/api/v1/configs',
                    websocket: '/ws/config',
                    docs: '/api/v1/docs'
                }
            });
        });

        // Rotas da API
        this.app.use('/api/v1', configRoutes);

        // Documentação básica da API
        this.app.get('/api/v1/docs', (req, res) => {
            res.json({
                title: 'Fature Config Service API',
                version: '1.0.0',
                description: 'API para gerenciamento de configurações dinâmicas',
                baseUrl: `${req.protocol}://${req.get('host')}/api/v1`,
                endpoints: {
                    'GET /health': 'Health check do serviço',
                    'GET /configs': 'Listar todas as configurações',
                    'POST /configs': 'Criar nova configuração',
                    'GET /config/:key': 'Buscar configuração específica',
                    'GET /config/:key/value': 'Buscar apenas o valor da configuração',
                    'PUT /config/:key': 'Atualizar configuração',
                    'DELETE /config/:key': 'Deletar configuração',
                    'GET /config/:key/history': 'Histórico de mudanças',
                    'GET /configs/category/:category': 'Configurações por categoria',
                    'GET /configs/type/:type': 'Configurações por tipo',
                    'POST /config/validate': 'Validar configuração',
                    'DELETE /cache/:key?': 'Limpar cache',
                    'GET /cpa/level-amounts': 'Valores CPA por nível',
                    'GET /cpa/validation-rules': 'Regras de validação CPA',
                    'GET /system/settings': 'Configurações do sistema',
                    'GET /mlm/settings': 'Configurações MLM',
                    'GET /external-apis/settings': 'Configurações de APIs externas'
                },
                authentication: {
                    type: 'API Key',
                    header: 'X-API-Key ou Authorization',
                    description: 'Incluir API Key no header da requisição'
                },
                websocket: {
                    url: `ws://${req.get('host')}/ws/config`,
                    events: {
                        'subscribe': 'Subscrever a mudanças de configurações',
                        'unsubscribe': 'Cancelar subscrição',
                        'config_changed': 'Notificação de mudança (recebido)',
                        'ping': 'Teste de conectividade'
                    }
                }
            });
        });

        // Rota 404
        this.app.use('*', (req, res) => {
            res.status(404).json({
                success: false,
                message: 'Endpoint não encontrado',
                path: req.originalUrl,
                method: req.method
            });
        });
    }

    setupWebSocket() {
        this.configNotifier = new ConfigNotifier(this.server);
        
        // Integrar notificador com o serviço de configuração
        // Isso será feito quando o ConfigService for instanciado
    }

    setupErrorHandling() {
        this.app.use(errorHandler);

        // Handlers de processo
        process.on('uncaughtException', (error) => {
            logger.error('Uncaught Exception:', error);
            this.gracefulShutdown('uncaughtException');
        });

        process.on('unhandledRejection', (reason, promise) => {
            logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
            this.gracefulShutdown('unhandledRejection');
        });

        process.on('SIGTERM', () => {
            logger.info('SIGTERM recebido');
            this.gracefulShutdown('SIGTERM');
        });

        process.on('SIGINT', () => {
            logger.info('SIGINT recebido');
            this.gracefulShutdown('SIGINT');
        });
    }

    async start() {
        try {
            // Testar conexão com banco antes de iniciar
            const { createTables } = require('./database/migrate');
            await createTables();
            
            this.server.listen(this.port, this.host, () => {
                logger.info(`🚀 Config Service iniciado em http://${this.host}:${this.port}`);
                logger.info(`📡 WebSocket disponível em ws://${this.host}:${this.port}/ws/config`);
                logger.info(`📚 Documentação disponível em http://${this.host}:${this.port}/api/v1/docs`);
                logger.info(`🏥 Health check disponível em http://${this.host}:${this.port}/api/v1/health`);
            });

            // Configurar notificações
            this.setupConfigNotifications();

        } catch (error) {
            logger.error('Erro ao iniciar o serviço:', error);
            process.exit(1);
        }
    }

    setupConfigNotifications() {
        // Integrar ConfigService com WebSocket notifier
        const ConfigService = require('./services/configService');
        const configService = new ConfigService();

        // Subscrever a mudanças de configuração
        configService.subscribe = (configKey, callback) => {
            // Adicionar callback que notifica via WebSocket
            const notifyCallback = (key, value) => {
                this.configNotifier.notifyConfigChange(key, value);
                if (callback) callback(key, value);
            };
            
            // Usar o sistema de subscribers do ConfigService
            configService.subscribe(configKey, notifyCallback);
        };

        logger.info('Sistema de notificações configurado');
    }

    async gracefulShutdown(signal) {
        logger.info(`Iniciando shutdown graceful devido a: ${signal}`);

        // Fechar servidor HTTP
        this.server.close(() => {
            logger.info('Servidor HTTP fechado');
        });

        // Fechar WebSocket
        if (this.configNotifier) {
            this.configNotifier.close();
        }

        // Aguardar um tempo para conexões ativas terminarem
        setTimeout(() => {
            logger.info('Shutdown completo');
            process.exit(0);
        }, 5000);
    }

    // Método para obter estatísticas do serviço
    getStats() {
        return {
            service: 'fature-config-service',
            version: process.env.npm_package_version || '1.0.0',
            uptime: process.uptime(),
            memory: process.memoryUsage(),
            websocket: this.configNotifier ? this.configNotifier.getStats() : null,
            timestamp: new Date().toISOString()
        };
    }
}

// Iniciar aplicação se executado diretamente
if (require.main === module) {
    const app = new ConfigServiceApp();
    app.start();
}

module.exports = ConfigServiceApp;

