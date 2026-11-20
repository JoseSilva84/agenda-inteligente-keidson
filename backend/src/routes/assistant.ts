import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';

const router = Router();
router.use(authMiddleware);

/**
 * POST /api/assistant/chat
 * Assistente inteligente da Agenda: interpreta perguntas em português sobre compromissos,
 * pendências, horários livres, produtividade e gera propostas de alterações com cartão de confirmação.
 */
router.post('/chat', async (req: Request, res: Response) => {
  try {
    const { message, context } = req.body;
    const q = String(message || '').trim().toLowerCase();
    if (!q) {
      res.status(400).json({ error: 'Mensagem vazia.' });
      return;
    }

    // context enviado pelo frontend com as ocorrências já expandidas e sugestões de pendências
    const today: string = context?.today || new Date().toISOString().slice(0, 10);
    const tomorrow: string = context?.tomorrow || today;
    const activities: any[] = Array.isArray(context?.activities) ? context.activities : [];
    const pendingSuggestions: any[] = Array.isArray(context?.pendingSuggestions) ? context.pendingSuggestions : [];
    const freeFriday: any[] = Array.isArray(context?.freeSlots) ? context.freeSlots : [];
    const stats: any = context?.stats || null;

    // 1. Pergunta sobre o que deixou de fazer / pendências / organizar pendências
    if (q.includes('organiz') || q.includes('remarc') || (q.includes('pend') && (q.includes('próxima') || q.includes('proxima') || q.includes('semana')))) {
      const validSugs = pendingSuggestions.filter((s) => !s.conflict && s.date && s.start);
      if (!validSugs.length) {
        res.json({
          text: pendingSuggestions.length
            ? `Você tem **${pendingSuggestions.length}** pendência(s), mas elas possuem conflito de prazo fixo. Confira na aba **Pendências** para escolher um horário.`
            : 'Você está em dia! Não há nenhuma atividade pendente precisando ser remarcada para a próxima semana.'
        });
        return;
      }

      const acoes = validSugs.map((s) => ({
        tipo: 'mover',
        chave: s.key,
        data: s.date,
        inicio: s.start,
        fim: s.end,
        desc: `Mover “${s.title}” de ${s.oldLabel} para ${s.newLabel}`
      }));

      res.json({
        text: `Encontrei **${validSugs.length}** pendência(s) e selecionei os melhores horários livres na sua próxima semana respeitando prioridade e horário útil. Confirme no cartão abaixo para aplicar:`,
        proposal: {
          resumo: `Reorganizar ${validSugs.length} pendência(s) em horários livres`,
          acoes
        }
      });
      return;
    }

    if (q.includes('deixei de fazer') || q.includes('pendente') || q.includes('atrasad')) {
      const pends = activities.filter((a) => a.status === 'pendente');
      if (!pends.length) {
        res.json({
          text: 'Excelente! Você **não deixou nenhuma atividade pendente** neste período. Tudo foi concluído ou está planejado no horário.'
        });
        return;
      }
      const lines = pends.slice(0, 12).map((a) => `- **${a.title}** (${a.dayLabel}, ${a.timeLabel}) · categoria *${a.category}*`);
      res.json({
        text: `Você tem **${pends.length}** atividade(s) pendente(s) que passaram do horário sem conclusão:\n\n${lines.join('\n')}\n\nSe quiser, peça *"Organize minhas pendências da próxima semana"* e eu preparo a remarcação para você confirmar.`
      });
      return;
    }

    // 2. Pergunta sobre amanhã ou hoje
    if (q.includes('amanhã') || q.includes('amanha')) {
      const list = activities.filter((a) => a.date === tomorrow);
      if (!list.length) {
        res.json({
          text: `Para **amanhã (${context?.tomorrowLabel || tomorrow})** você não tem nenhuma atividade marcada até o momento.`
        });
        return;
      }
      const lines = list.map((a) => `- **${a.timeLabel}** — **${a.title}** (${a.category})`);
      res.json({
        text: `Para **amanhã (${context?.tomorrowLabel || tomorrow})** você tem **${list.length}** compromisso(s):\n\n${lines.join('\n')}`
      });
      return;
    }

    if (q.includes('hoje')) {
      const list = activities.filter((a) => a.date === today);
      if (!list.length) {
        res.json({
          text: `Para **hoje (${context?.todayLabel || today})** sua agenda está livre!`
        });
        return;
      }
      const lines = list.map((a) => `- **${a.timeLabel}** — **${a.title}** (${a.statusLabel})`);
      res.json({
        text: `Aqui estão suas atividades de **hoje (${context?.todayLabel || today})**:\n\n${lines.join('\n')}`
      });
      return;
    }

    // 3. Pergunta sobre horários livres
    if (q.includes('livre') || q.includes('vago') || q.includes('disponív') || q.includes('disponiv')) {
      const targetLabel = context?.freeDayLabel || 'no dia consultado';
      if (!freeFriday.length) {
        res.json({
          text: `Não encontrei intervalos livres dentro do seu horário útil **${targetLabel}**.`
        });
        return;
      }
      const lines = freeFriday.map((f: any) => `- Das **${f.inicio}** às **${f.fim}**`);
      res.json({
        text: `Horários livres dentro do seu expediente **${targetLabel}**:\n\n${lines.join('\n')}`
      });
      return;
    }

    // 4. Pergunta sobre resumo / produtividade
    if (q.includes('resumo') || q.includes('produtividade') || q.includes('mês') || q.includes('mes') || q.includes('estatística')) {
      if (stats) {
        const catLines = Object.entries(stats.categories || {})
          .map(([name, info]: [string, any]) => `- **${name}**: ${info.concluidas}/${info.atividades} concluídas (${info.horas}h)`)
          .join('\n');
        res.json({
          text: `**Resumo de Produtividade (${stats.periodLabel})**\n\n- **Total programado:** ${stats.total}\n- **Concluídas:** ${stats.concluida} (${stats.rate}%)\n- **Pendentes:** ${stats.pendente}\n- **Canceladas:** ${stats.cancelada}\n\n${catLines ? `**Por categoria:**\n${catLines}` : ''}`
        });
        return;
      }
    }

    // 5. Resposta geral contextualizada com a agenda do usuário
    const upcoming = activities.filter((a) => a.date >= today && a.status === 'planejada').slice(0, 8);
    if (upcoming.length) {
      const lines = upcoming.map((a) => `- **${a.dayLabel}** (${a.timeLabel}): **${a.title}**`);
      res.json({
        text: `Consultei sua agenda! Aqui estão os seus próximos compromissos planejados:\n\n${lines.join('\n')}\n\nVocê também pode me pedir para:\n- *Ver o que ficou pendente na semana*\n- *Procurar horários livres em um dia específico*\n- *Organizar suas pendências automaticamente*`
      });
      return;
    }

    res.json({
      text: 'Sua agenda está tranquila no momento. Posso ajudar a consultar seus compromissos de hoje ou amanhã, encontrar horários livres, resumir sua produtividade ou organizar suas pendências!'
    });
  } catch (err) {
    console.error('Erro no assistente:', err);
    res.status(500).json({ error: 'Não foi possível processar sua pergunta agora.' });
  }
});

export default router;
