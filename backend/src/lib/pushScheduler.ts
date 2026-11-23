import { Activity } from '@prisma/client';
import { prisma, isPostgresConnected } from './db';
import { isWebPushConfigured, sendWebPushToUser } from './push';

const TIMEZONE = process.env.PUSH_TIMEZONE || 'America/Fortaleza';
const TICK_MS = 60_000;
const LATE_WINDOW_MS = 5 * 60_000;

type CalendarParts = { date: string; hour: number; minute: number };

function localParts(now = new Date()): CalendarParts {
  const values = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23'
  }).formatToParts(now).reduce<Record<string, string>>((out, part) => {
    out[part.type] = part.value;
    return out;
  }, {});
  return {
    date: `${values.year}-${values.month}-${values.day}`,
    hour: Number(values.hour),
    minute: Number(values.minute)
  };
}

function dateAt(date: string, time: string) {
  const [year, month, day] = date.split('-').map(Number);
  const [hour, minute] = time.split(':').map(Number);
  return Date.UTC(year, month - 1, day, hour || 0, minute || 0);
}

function datePlus(date: string, amount: number) {
  const [year, month, day] = date.split('-').map(Number);
  const value = new Date(Date.UTC(year, month - 1, day + amount));
  return value.toISOString().slice(0, 10);
}

function weekday(date: string) {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

function dayOfMonth(date: string) {
  return Number(date.slice(8, 10));
}

function occursOn(activity: Activity, date: string) {
  if (date < activity.date) return false;
  const rule: any = activity.recur || { freq: 'none' };
  if (rule.until && date > rule.until) return false;
  if (rule.freq === 'none' || !rule.freq) return date === activity.date;
  if (rule.freq === 'daily') return true;
  if (rule.freq === 'weekdays') return weekday(date) >= 1 && weekday(date) <= 5;
  if (rule.freq === 'weekly') return (rule.days?.length ? rule.days : [weekday(activity.date)]).includes(weekday(date));
  if (rule.freq === 'monthly') return dayOfMonth(date) === dayOfMonth(activity.date);
  if (rule.freq === 'custom') return Array.isArray(rule.dates) && rule.dates.includes(date);
  return false;
}

function occurrence(activity: Activity, originalDate: string) {
  const overrides = (activity.overrides || {}) as Record<string, any>;
  const override = overrides[originalDate] || {};
  if (override.deleted || ['cancelada', 'concluida', 'reagendada'].includes(override.status || activity.status)) return null;
  return {
    date: String(override.date || originalDate),
    start: String(override.start || activity.start)
  };
}

let processing = false;

export async function processReminderPushes() {
  if (processing || !isWebPushConfigured || !(await isPostgresConnected())) return;
  processing = true;
  try {
    const now = localParts();
    const nowWall = dateAt(now.date, `${String(now.hour).padStart(2, '0')}:${String(now.minute).padStart(2, '0')}`) + new Date().getSeconds() * 1000;
    const activities = await prisma.activity.findMany({ where: { reminder: { gt: 0 } } });

    for (const activity of activities) {
      if (['cancelada', 'concluida', 'reagendada'].includes(activity.status)) continue;
      const daysAhead = Math.max(1, Math.ceil(activity.reminder / 1440) + 1);
      for (let offset = 0; offset <= daysAhead; offset += 1) {
        const originalDate = datePlus(now.date, offset);
        if (!occursOn(activity, originalDate)) continue;
        const item = occurrence(activity, originalDate);
        if (!item) continue;
        const target = dateAt(item.date, item.start) - activity.reminder * 60_000;
        const age = nowWall - target;
        if (age < 0 || age > LATE_WINDOW_MS) continue;

        const occurrenceAt = `${item.date}T${item.start}`;
        try {
          await prisma.pushDelivery.create({ data: { userId: activity.userId, activityId: activity.id, occurrenceAt } });
        } catch {
          continue;
        }

        const result = await sendWebPushToUser(activity.userId, {
          title: `Lembrete: ${activity.title}`,
          body: `Começa às ${item.start}.`,
          url: '/#agenda',
          tag: `agenda-${activity.id}-${occurrenceAt}`,
          data: { activityId: activity.id, date: item.date, start: item.start }
        });
        if (result.sent === 0) {
          await prisma.pushDelivery.deleteMany({ where: { userId: activity.userId, activityId: activity.id, occurrenceAt } });
        }
      }
    }
  } catch (error) {
    console.error('Erro ao processar lembretes Web Push:', error);
  } finally {
    processing = false;
  }
}

export function startReminderScheduler() {
  if (!isWebPushConfigured) {
    console.warn('Web Push desativado: configure VAPID_PUBLIC_KEY e VAPID_PRIVATE_KEY no servidor.');
    return;
  }
  void processReminderPushes();
  setInterval(() => void processReminderPushes(), TICK_MS).unref();
}
