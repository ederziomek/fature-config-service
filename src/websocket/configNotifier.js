const { Server } = require('socket.io');
const logger = require('../utils/logger');

class ConfigNotifier {
    constructor(httpServer) {
        this.io = new Server(httpServer, {
            cors: {
                origin: process.env.WS_CORS_ORIGIN || "*",
                methods: ["GET", "POST"]
            },
            path: '/ws/config'
        });
        
        this.subscribers = new Map(); // configKey -> Set of socketIds
        this.socketSubscriptions = new Map(); // socketId -> Set of configKeys
        
        this.setupEventHandlers();
        logger.info('WebSocket Config Notifier iniciado');
    }

    setupEventHandlers() {
        this.io.on('connection', (socket) => {
            logger.info(`Cliente WebSocket conectado: ${socket.id}`);
            
            // Inicializar subscriptions para este socket
            this.socketSubscriptions.set(socket.id, new Set());

            // Handler para subscrever configurações
            socket.on('subscribe', (data) => {
                try {
                    const { keys } = data;
                    
                    if (!Array.isArray(keys)) {
                        socket.emit('error', {
                            message: 'Keys deve ser um array'
                        });
                        return;
                    }

                    keys.forEach(key => {
                        this.subscribeSocket(socket.id, key);
                    });

                    socket.emit('subscribed', {
                        keys,
                        message: `Subscrito a ${keys.length} configurações`
                    });

                    logger.info(`Socket ${socket.id} subscrito a: ${keys.join(', ')}`);
                } catch (error) {
                    logger.error('Erro ao processar subscribe:', error);
                    socket.emit('error', {
                        message: 'Erro ao processar subscrição'
                    });
                }
            });

            // Handler para cancelar subscrição
            socket.on('unsubscribe', (data) => {
                try {
                    const { keys } = data;
                    
                    if (!Array.isArray(keys)) {
                        socket.emit('error', {
                            message: 'Keys deve ser um array'
                        });
                        return;
                    }

                    keys.forEach(key => {
                        this.unsubscribeSocket(socket.id, key);
                    });

                    socket.emit('unsubscribed', {
                        keys,
                        message: `Cancelada subscrição de ${keys.length} configurações`
                    });

                    logger.info(`Socket ${socket.id} cancelou subscrição de: ${keys.join(', ')}`);
                } catch (error) {
                    logger.error('Erro ao processar unsubscribe:', error);
                    socket.emit('error', {
                        message: 'Erro ao cancelar subscrição'
                    });
                }
            });

            // Handler para listar subscrições
            socket.on('list_subscriptions', () => {
                const subscriptions = Array.from(this.socketSubscriptions.get(socket.id) || []);
                socket.emit('subscriptions_list', {
                    subscriptions,
                    count: subscriptions.length
                });
            });

            // Handler para ping/pong
            socket.on('ping', () => {
                socket.emit('pong', {
                    timestamp: new Date().toISOString()
                });
            });

            // Handler para desconexão
            socket.on('disconnect', (reason) => {
                logger.info(`Cliente WebSocket desconectado: ${socket.id}, razão: ${reason}`);
                this.cleanupSocket(socket.id);
            });

            // Enviar mensagem de boas-vindas
            socket.emit('connected', {
                message: 'Conectado ao Config Service WebSocket',
                socketId: socket.id,
                timestamp: new Date().toISOString()
            });
        });
    }

    // Subscrever socket a uma configuração
    subscribeSocket(socketId, configKey) {
        // Adicionar socket à lista de subscribers da configuração
        if (!this.subscribers.has(configKey)) {
            this.subscribers.set(configKey, new Set());
        }
        this.subscribers.get(configKey).add(socketId);

        // Adicionar configuração à lista de subscriptions do socket
        if (!this.socketSubscriptions.has(socketId)) {
            this.socketSubscriptions.set(socketId, new Set());
        }
        this.socketSubscriptions.get(socketId).add(configKey);
    }

    // Cancelar subscrição de socket a uma configuração
    unsubscribeSocket(socketId, configKey) {
        // Remover socket da lista de subscribers da configuração
        if (this.subscribers.has(configKey)) {
            this.subscribers.get(configKey).delete(socketId);
            
            // Se não há mais subscribers, remover a entrada
            if (this.subscribers.get(configKey).size === 0) {
                this.subscribers.delete(configKey);
            }
        }

        // Remover configuração da lista de subscriptions do socket
        if (this.socketSubscriptions.has(socketId)) {
            this.socketSubscriptions.get(socketId).delete(configKey);
        }
    }

    // Limpar todas as subscriptions de um socket
    cleanupSocket(socketId) {
        // Obter todas as configurações que o socket estava subscrito
        const subscriptions = this.socketSubscriptions.get(socketId) || new Set();
        
        // Remover socket de todas as configurações
        subscriptions.forEach(configKey => {
            if (this.subscribers.has(configKey)) {
                this.subscribers.get(configKey).delete(socketId);
                
                // Se não há mais subscribers, remover a entrada
                if (this.subscribers.get(configKey).size === 0) {
                    this.subscribers.delete(configKey);
                }
            }
        });

        // Remover entrada do socket
        this.socketSubscriptions.delete(socketId);
    }

    // Notificar mudança de configuração
    notifyConfigChange(configKey, newValue, action = 'UPDATE') {
        const subscribers = this.subscribers.get(configKey);
        
        if (!subscribers || subscribers.size === 0) {
            logger.debug(`Nenhum subscriber para configuração: ${configKey}`);
            return;
        }

        const notification = {
            type: 'config_changed',
            key: configKey,
            value: newValue,
            action,
            timestamp: new Date().toISOString()
        };

        let notifiedCount = 0;
        subscribers.forEach(socketId => {
            const socket = this.io.sockets.sockets.get(socketId);
            if (socket) {
                socket.emit('config_changed', notification);
                notifiedCount++;
            } else {
                // Socket não existe mais, remover da lista
                this.unsubscribeSocket(socketId, configKey);
            }
        });

        logger.info(`Notificação enviada para ${notifiedCount} clientes sobre mudança em: ${configKey}`);
    }

    // Notificar múltiplas mudanças
    notifyMultipleChanges(changes) {
        changes.forEach(change => {
            this.notifyConfigChange(change.key, change.value, change.action);
        });
    }

    // Broadcast para todos os clientes conectados
    broadcast(event, data) {
        this.io.emit(event, {
            ...data,
            timestamp: new Date().toISOString()
        });
        
        logger.info(`Broadcast enviado: ${event} para ${this.io.sockets.sockets.size} clientes`);
    }

    // Obter estatísticas
    getStats() {
        const connectedClients = this.io.sockets.sockets.size;
        const totalSubscriptions = Array.from(this.socketSubscriptions.values())
            .reduce((total, subscriptions) => total + subscriptions.size, 0);
        const uniqueConfigs = this.subscribers.size;

        return {
            connectedClients,
            totalSubscriptions,
            uniqueConfigs,
            subscriptionsByConfig: Object.fromEntries(
                Array.from(this.subscribers.entries()).map(([key, sockets]) => [key, sockets.size])
            )
        };
    }

    // Fechar servidor WebSocket
    close() {
        this.io.close();
        logger.info('WebSocket Config Notifier fechado');
    }
}

module.exports = ConfigNotifier;

