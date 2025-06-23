# 🔧 Fature Config Service

Serviço centralizado de configurações dinâmicas para o sistema Fature. Permite gerenciar todas as configurações do sistema sem necessidade de redeploy, com notificações em tempo real e cache inteligente.

## 🎯 Características

- **Zero Hardcoded Values**: Todas as configurações são dinâmicas
- **Cache Inteligente**: Cache local com TTL configurável
- **Notificações em Tempo Real**: WebSocket para mudanças instantâneas
- **Auditoria Completa**: Histórico de todas as mudanças
- **Validação de Schemas**: Validação automática de configurações
- **SDK Client**: Cliente padronizado para outros microserviços
- **Rate Limiting**: Proteção contra abuso
- **Health Checks**: Monitoramento de saúde do serviço

## 🚀 Instalação e Execução

### Pré-requisitos
- Node.js 18+
- PostgreSQL 12+
- Redis (opcional, para cache distribuído)

### Configuração
1. Clone o repositório
2. Instale as dependências: `npm install`
3. Configure as variáveis de ambiente (veja `.env.example`)
4. Execute as migrações: `node src/database/migrate.js`
5. Inicie o serviço: `npm start`

### Variáveis de Ambiente
```bash
# Servidor
NODE_ENV=development
PORT=3000
HOST=0.0.0.0

# Banco de Dados
DB_HOST=localhost
DB_PORT=5432
DB_NAME=fature_config
DB_USER=postgres
DB_PASSWORD=postgres

# Segurança
JWT_SECRET=your_jwt_secret
API_KEY_SECRET=your_api_key

# Cache
CACHE_TTL=3600
REDIS_HOST=localhost
REDIS_PORT=6379
```

## 📚 API Endpoints

### Configurações Gerais
- `GET /api/v1/configs` - Listar todas as configurações
- `POST /api/v1/configs` - Criar nova configuração
- `GET /api/v1/config/:key` - Buscar configuração específica
- `GET /api/v1/config/:key/value` - Buscar apenas o valor
- `PUT /api/v1/config/:key` - Atualizar configuração
- `DELETE /api/v1/config/:key` - Deletar configuração

### Configurações Específicas
- `GET /api/v1/cpa/level-amounts` - Valores CPA por nível
- `GET /api/v1/cpa/validation-rules` - Regras de validação CPA
- `GET /api/v1/system/settings` - Configurações do sistema
- `GET /api/v1/mlm/settings` - Configurações MLM

### Utilitários
- `GET /api/v1/health` - Health check
- `GET /api/v1/docs` - Documentação da API
- `POST /api/v1/config/validate` - Validar configuração
- `DELETE /api/v1/cache/:key?` - Limpar cache

## 🔌 WebSocket

Conecte-se ao WebSocket para receber notificações em tempo real:

```javascript
const ws = new WebSocket('ws://localhost:3000/ws/config');

// Subscrever a configurações
ws.send(JSON.stringify({
    action: 'subscribe',
    keys: ['cpa_level_amounts', 'system_settings']
}));

// Receber notificações
ws.on('message', (data) => {
    const message = JSON.parse(data);
    if (message.type === 'config_changed') {
        console.log(`Configuração ${message.key} alterada:`, message.value);
    }
});
```

## 🛠️ SDK Client

Use o SDK Client em outros microserviços:

```javascript
const ConfigClient = require('./utils/configClient');

const configClient = new ConfigClient({
    baseURL: 'http://config-service:3000/api/v1',
    apiKey: 'your_api_key',
    enableWebSocket: true
});

// Buscar configuração
const cpaAmounts = await configClient.getCpaLevelAmounts();

// Subscrever a mudanças
configClient.subscribe('cpa_level_amounts', (newValue) => {
    console.log('Valores CPA atualizados:', newValue);
});
```

## 📊 Configurações Disponíveis

### CPA (Cost Per Acquisition)
```json
{
  "cpa_level_amounts": {
    "level_1": 50.00,
    "level_2": 20.00,
    "level_3": 5.00,
    "level_4": 5.00,
    "level_5": 5.00
  },
  "cpa_validation_rules": {
    "groups": [
      {
        "operator": "AND",
        "criteria": [
          {"type": "deposit", "value": 30.00, "enabled": true},
          {"type": "bets", "value": 10, "enabled": true}
        ]
      }
    ],
    "group_operator": "OR"
  }
}
```

### Sistema
```json
{
  "system_settings": {
    "api_timeout": 30000,
    "cache_ttl": 3600,
    "max_retries": 3,
    "batch_size": 100,
    "cpa_monitoring_interval": 300000
  }
}
```

### MLM
```json
{
  "mlm_settings": {
    "max_hierarchy_levels": 5,
    "calculation_method": "standard",
    "auto_distribution": true,
    "minimum_amount": 0.01,
    "currency": "BRL"
  }
}
```

## 🔒 Autenticação

Todas as rotas (exceto health check) requerem autenticação via API Key:

```bash
# Header
X-API-Key: your_api_key

# Ou Authorization
Authorization: Bearer your_api_key
```

## 🐳 Docker

```bash
# Build
docker build -t fature-config-service .

# Run
docker run -p 3000:3000 \
  -e DB_HOST=your_db_host \
  -e DB_PASSWORD=your_db_password \
  -e API_KEY_SECRET=your_api_key \
  fature-config-service
```

## 🚂 Deploy no Railway

1. Configure as variáveis de ambiente no Railway
2. Conecte o repositório GitHub
3. O deploy será automático via `railway.json`

### Variáveis Obrigatórias no Railway
- `DATABASE_URL` (PostgreSQL)
- `API_KEY_SECRET`
- `JWT_SECRET`

## 🧪 Testes

```bash
# Testes unitários
npm test

# Testes com watch
npm run test:watch

# Coverage
npm run test:coverage
```

## 📈 Monitoramento

- Health check: `GET /api/v1/health`
- Métricas: Logs estruturados com Winston
- WebSocket stats: Estatísticas de conexões ativas

## 🔧 Desenvolvimento

```bash
# Modo desenvolvimento
npm run dev

# Lint
npm run lint

# Lint fix
npm run lint:fix
```

## 📝 Logs

Logs são salvos em:
- `logs/combined.log` - Logs gerais
- `logs/error.log` - Apenas erros

Formato JSON estruturado para fácil parsing.

## 🤝 Contribuição

1. Fork o projeto
2. Crie uma branch para sua feature
3. Commit suas mudanças
4. Push para a branch
5. Abra um Pull Request

## 📄 Licença

MIT License - veja o arquivo LICENSE para detalhes.

---

**Fature Config Service** - Configurações dinâmicas para o ecossistema Fature 🚀

