const express = require('express');
const ConfigController = require('../controllers/configController');
const { validate, schemas, authenticate, rateLimits, validateParams } = require('../middleware/validation');

const router = express.Router();
const configController = new ConfigController();

// Aplicar rate limiting geral
router.use(rateLimits.general);

// Health check (sem autenticação)
router.get('/health', configController.healthCheck.bind(configController));

// Aplicar autenticação para todas as rotas abaixo
router.use(authenticate);

// Rotas de configurações gerais
router.get('/configs', 
    rateLimits.read,
    configController.getAllConfigs.bind(configController)
);

router.post('/configs', 
    rateLimits.write,
    validate(schemas.createConfig),
    configController.createConfig.bind(configController)
);

// Rotas para configuração específica
router.get('/config/:key', 
    rateLimits.read,
    validateParams.configKey,
    configController.getConfig.bind(configController)
);

router.get('/config/:key/value', 
    rateLimits.read,
    validateParams.configKey,
    configController.getConfigValue.bind(configController)
);

router.put('/config/:key', 
    rateLimits.write,
    validateParams.configKey,
    validate(schemas.updateConfig),
    configController.updateConfig.bind(configController)
);

router.delete('/config/:key', 
    rateLimits.write,
    validateParams.configKey,
    configController.deleteConfig.bind(configController)
);

router.get('/config/:key/history', 
    rateLimits.read,
    validateParams.configKey,
    configController.getConfigHistory.bind(configController)
);

// Rotas por categoria
router.get('/configs/category/:category', 
    rateLimits.read,
    validateParams.category,
    configController.getConfigsByCategory.bind(configController)
);

// Rotas por tipo
router.get('/configs/type/:type', 
    rateLimits.read,
    validateParams.type,
    configController.getConfigsByType.bind(configController)
);

// Validação de configuração
router.post('/config/validate', 
    rateLimits.read,
    validate(schemas.validateConfig),
    configController.validateConfig.bind(configController)
);

// Cache management
router.delete('/cache/:key?', 
    rateLimits.write,
    configController.clearCache.bind(configController)
);

// Rotas específicas para configurações CPA
router.get('/cpa/level-amounts', 
    rateLimits.read,
    configController.getCpaLevelAmounts.bind(configController)
);

router.get('/cpa/validation-rules', 
    rateLimits.read,
    configController.getCpaValidationRules.bind(configController)
);

// Rotas específicas para configurações do sistema
router.get('/system/settings', 
    rateLimits.read,
    configController.getSystemSettings.bind(configController)
);

// Rotas específicas para configurações MLM
router.get('/mlm/settings', 
    rateLimits.read,
    configController.getMlmSettings.bind(configController)
);

// Rotas específicas para configurações de APIs externas
router.get('/external-apis/settings', 
    rateLimits.read,
    configController.getExternalApisSettings.bind(configController)
);

module.exports = router;

