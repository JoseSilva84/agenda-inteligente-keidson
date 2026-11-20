"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const db_1 = require("./lib/db");
const auth_1 = __importDefault(require("./routes/auth"));
const agenda_1 = __importDefault(require("./routes/agenda"));
const assistant_1 = __importDefault(require("./routes/assistant"));
dotenv_1.default.config();
const app = (0, express_1.default)();
const PORT = Number(process.env.PORT || 3333);
app.use((0, cors_1.default)({
    origin: process.env.CORS_ORIGIN || '*',
    credentials: true
}));
app.use(express_1.default.json({ limit: '50mb' }));
app.use(express_1.default.urlencoded({ extended: true, limit: '50mb' }));
// Healthcheck endpoint para Coolify / Docker
app.get('/api/health', async (_req, res) => {
    const pg = await (0, db_1.isPostgresConnected)();
    res.json({
        status: 'ok',
        app: 'agenda-inteligente-api',
        database: pg ? 'postgresql' : 'local-mirror',
        timestamp: new Date().toISOString()
    });
});
// Rotas da API
app.use('/api/auth', auth_1.default);
app.use('/api/agenda', agenda_1.default);
app.use('/api/assistant', assistant_1.default);
// Em produção (ex.: container unificado no Coolify), serve o build estático do frontend PWA se existir
const frontendDist = path_1.default.resolve(__dirname, '../../frontend/dist');
if (fs_1.default.existsSync(frontendDist)) {
    app.use(express_1.default.static(frontendDist));
    app.get('*', (req, res, next) => {
        if (req.path.startsWith('/api'))
            return next();
        res.sendFile(path_1.default.join(frontendDist, 'index.html'));
    });
}
app.listen(PORT, '0.0.0.0', async () => {
    await (0, db_1.isPostgresConnected)();
    console.log(`🚀 [Agenda Inteligente API] Servidor rodando em http://localhost:${PORT}`);
});
