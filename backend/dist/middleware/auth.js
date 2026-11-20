"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.JWT_SECRET = void 0;
exports.signToken = signToken;
exports.authMiddleware = authMiddleware;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
exports.JWT_SECRET = process.env.JWT_SECRET || 'agenda-inteligente-apple-jwt-secret-key-2026';
function signToken(payload) {
    return jsonwebtoken_1.default.sign(payload, exports.JWT_SECRET, {
        expiresIn: (process.env.JWT_EXPIRES_IN || '30d')
    });
}
function authMiddleware(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).json({ error: 'Não autorizado. Faça login para acessar a Agenda Inteligente.' });
        return;
    }
    const token = authHeader.slice(7);
    try {
        const decoded = jsonwebtoken_1.default.verify(token, exports.JWT_SECRET);
        req.user = decoded;
        next();
    }
    catch {
        res.status(401).json({ error: 'Sessão expirada ou token inválido. Entre novamente.' });
    }
}
