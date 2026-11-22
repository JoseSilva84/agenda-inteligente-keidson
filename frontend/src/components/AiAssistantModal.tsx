import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  timestamp: string;
}

interface AiAssistantModalProps {
  isOpen: boolean;
  onClose: () => void;
  isMaximized: boolean;
  onToggleMaximize: () => void;
}

const DEFAULT_SUGGESTIONS = [
  'O que tenho marcado para hoje?',
  'Quais horários estão livres amanhã?',
  'Faça um resumo dos meus compromissos da semana.',
  'Como organizar minhas pendências prioritárias?',
  'Criar uma nova atividade na agenda.'
];

export const AiAssistantModal: React.FC<AiAssistantModalProps> = ({
  isOpen,
  onClose,
  isMaximized,
  onToggleMaximize
}) => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      text: 'Olá! Sou o **Assistente IA Smart Vida**.\n\nEstou conectado ao seu sistema para ajudar a organizar compromissos, encontrar horários disponíveis, resumir pendências e otimizar sua rotina.\n\nComo posso ajudar você agora?',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [isOpen]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const handleSendMessage = (textToSend?: string) => {
    const text = (textToSend || inputValue).trim();
    if (!text) return;

    const userMsg: Message = {
      id: 'user-' + Date.now(),
      role: 'user',
      text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputValue('');
    setIsTyping(true);

    // Resposta inicial de frontend / mockup enquanto a integração do backend é conectada
    setTimeout(() => {
      let reply = 'Recebi sua mensagem: "' + text + '".\n\nEssa interface de chat já está pronta e preparada para responder com toda a inteligência da sua agenda assim que conectarmos o modelo de IA!';
      
      if (text.toLowerCase().includes('hoje')) {
        reply = 'Aqui está uma prévia dos seus compromissos de hoje:\n\n• Suas atividades principais estão registradas no calendário da Smart Vida.\n• Posso ajudá-lo a checar horários livres ou criar novos lembretes rapidamente!';
      } else if (text.toLowerCase().includes('resumo') || text.toLowerCase().includes('semana')) {
        reply = 'Resumo semanal Smart Vida:\n\n• Sua semana possui horários e compromissos ativos na visão semanal.\n• Você pode usar o botão "Multi" no mini calendário para comparar dias lado a lado!';
      } else if (text.toLowerCase().includes('pendências') || text.toLowerCase().includes('pendencias')) {
        reply = 'Você pode revisar todas as pendências pela aba "Pendências" no topo ou pedir para mim reorganizar os horários livres para você.';
      }

      setMessages((prev) => [
        ...prev,
        {
          id: 'assistant-' + Date.now(),
          role: 'assistant',
          text: reply,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);
      setIsTyping(false);
    }, 900);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop quando maximizado */}
      {isMaximized && (
        <motion.div
          key="ai-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="ai-modal-backdrop"
          onClick={onClose}
        />
      )}

      <motion.div
        key="ai-window"
        initial={{ opacity: 0, scale: 0.92, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.92, y: 20 }}
        transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
        className={`ai-modal-container ${isMaximized ? 'is-maximized' : 'is-compact'}`}
      >
        {/* Cabeçalho */}
        <div className="ai-modal-header">
          <div className="ai-modal-header-brand">
            <div className="ai-icon-badge">
              <svg className="i" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor">
                <path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3z" />
                <path d="M19 3l-.9 2.1a1 1 0 0 1-.6.6L15.4 6.6l2.1.9a1 1 0 0 1 .6.6L19 10.2l.9-2.1a1 1 0 0 1 .6-.6l2.1-.9-2.1-.9a1 1 0 0 1-.6-.6z" />
              </svg>
            </div>
            <div>
              <div className="ai-modal-title">
                <span>Assistente IA</span>
                <span className="brand-accent-text" style={{ fontSize: '13px', marginLeft: '4px' }}>Smart Vida</span>
              </div>
              <div className="ai-modal-status">
                <span className="ai-status-dot"></span>
                <span>Pronto para ajudar</span>
              </div>
            </div>
          </div>

          <div className="ai-modal-actions">
            <button
              type="button"
              className="ai-ctrl-btn"
              onClick={onToggleMaximize}
              title={isMaximized ? 'Restaurar tamanho' : 'Maximizar tela'}
              aria-label={isMaximized ? 'Restaurar tamanho' : 'Maximizar tela'}
            >
              {isMaximized ? (
                /* Restaurar / Minimizar */
                <svg className="i" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor">
                  <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3" />
                </svg>
              ) : (
                /* Maximizar */
                <svg className="i" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor">
                  <path d="M15 3h6v6m-6 5l6 6m0-6v6h-6M9 21H3v-6m6-5l-6-6m0 6V3h6" />
                </svg>
              )}
            </button>
            <button
              type="button"
              className="ai-ctrl-btn close"
              onClick={onClose}
              title="Fechar assistente"
              aria-label="Fechar assistente"
            >
              <svg className="i" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Corpo / Histórico de Mensagens */}
        <div className="ai-modal-body">
          <div className="ai-messages-list">
            {messages.map((m) => (
              <div key={m.id} className={`ai-message-row ${m.role}`}>
                {m.role === 'assistant' && (
                  <div className="ai-msg-avatar">
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor">
                      <path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3z" />
                    </svg>
                  </div>
                )}
                <div className="ai-message-bubble">
                  <div className="ai-message-content">
                    {m.text.split('\n').map((line, idx) => (
                      <p key={idx} style={{ margin: line ? '0 0 6px 0' : '0', minHeight: line ? 'auto' : '8px' }}>
                        {line.startsWith('• ') ? (
                          <span>
                            <strong>•</strong> {line.slice(2)}
                          </span>
                        ) : line.includes('**') ? (
                          line.split('**').map((seg, sIdx) =>
                            sIdx % 2 === 1 ? <strong key={sIdx}>{seg}</strong> : seg
                          )
                        ) : (
                          line
                        )}
                      </p>
                    ))}
                  </div>
                  <span className="ai-message-time">{m.timestamp}</span>
                </div>
              </div>
            ))}

            {isTyping && (
              <div className="ai-message-row assistant">
                <div className="ai-msg-avatar thinking">
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor">
                    <path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3z" />
                  </svg>
                </div>
                <div className="ai-message-bubble typing">
                  <div className="ai-typing-indicator">
                    <span></span>
                    <span></span>
                    <span></span>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Sugestões Rápidas */}
          {messages.length <= 2 && (
            <div className="ai-suggestions-container">
              <span className="ai-suggestions-title">Sugestões de perguntas:</span>
              <div className="ai-suggestions-chips">
                {DEFAULT_SUGGESTIONS.map((s, idx) => (
                  <button
                    key={idx}
                    type="button"
                    className="ai-suggestion-chip"
                    onClick={() => handleSendMessage(s)}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Rodapé / Input de Mensagem */}
        <div className="ai-modal-footer">
          <form
            className="ai-input-form"
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
          >
            <textarea
              ref={inputRef}
              className="ai-input-textarea"
              rows={1}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Pergunte sobre seus horários ou peça ajuda..."
              aria-label="Mensagem para o assistente IA"
            />
            <button
              type="submit"
              className="ai-send-btn"
              disabled={!inputValue.trim()}
              title="Enviar mensagem"
              aria-label="Enviar mensagem"
            >
              <svg className="i" viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor">
                <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
              </svg>
            </button>
          </form>
          <div className="ai-footer-note">
            <span>Assistente inteligente Smart Vida · Pronto para integração</span>
          </div>
        </div>
      </motion.div>
    </>
  );
};
