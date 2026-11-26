export type ActivityStatus = 'planejada' | 'concluida' | 'pendente' | 'cancelada' | 'reagendada';
export type PriorityLevel = 'alta' | 'media' | 'baixa';
export type RecurrenceFreq = 'none' | 'daily' | 'weekdays' | 'weekly' | 'monthly' | 'custom';
export type ThemeMode = 'dark' | 'light' | 'system';

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: string;
  theme?: ThemeMode;
}

export interface Category {
  id: string;
  name: string;
  color: string;
}

export interface AgendaSettings {
  kind: 'settings';
  mode: 'confirm' | 'auto';
  workStart: string;
  workEnd: string;
  workDays: number[];
  categories: Category[];
  specialCats?: boolean;
}

export interface Subtask {
  id: string;
  text: string;
  done: boolean;
  date?: string;
  start?: string;
  dur?: number;
}

export interface ActivityGoal {
  enabled: boolean;
  target: number;
  done: number;
}

export interface ActivityLink {
  url: string;
  label: string;
}

export interface AttachmentFile {
  id: string;
  name: string;
  type: string;
  size: number;
  store: 'asset' | 'idb' | 'db';
  url?: string;
  chunks?: number;
}

export interface HistoryEntry {
  at: number;
  text: string;
}

export interface RecurrenceRule {
  freq: RecurrenceFreq;
  days?: number[];
  until?: string;
  dates?: string[];
}

export interface ActivityOverride {
  date?: string;
  start?: string;
  end?: string;
  status?: ActivityStatus;
  deleted?: boolean;
  kept?: boolean;
  movedTo?: string;
}

export interface ActivityItem {
  id: string;
  kind: 'activity';
  title: string;
  date: string;
  start: string;
  end: string;
  status: ActivityStatus;
  category: string;
  priority: PriorityLevel;
  recur: RecurrenceRule;
  reminder: number;
  fixed: boolean;
  deadline: string;
  autoResched: boolean;
  kept?: boolean;
  span?: boolean;
  notes: string;
  goal?: ActivityGoal;
  subtasks?: Subtask[];
  links: ActivityLink[];
  files: AttachmentFile[];
  history: HistoryEntry[];
  overrides: Record<string, ActivityOverride>;
  origin?: { seriesId: string; date: string };
  rescheduledCount?: number;
  createdAt: number;
  updatedAt?: number;
}

export interface TravelItem {
  id: string;
  kind: 'travel';
  title: string;
  date: string;
  start: string;
  endDate: string;
  end: string;
  notes: string;
  updatedAt?: number;
}

export interface PersonItem {
  id: string;
  kind: 'person';
  type: 'aniversario' | 'profissional';
  name: string;
  day: number;
  month: number;
  whatsapp: string;
  role: string;
  createdAt: number;
}

export interface NotificationItem {
  id: string;
  at: number;
  title: string;
  body: string;
  type: string;
  read: boolean;
}

export interface Occurrence {
  key: string;
  id: string;
  item: ActivityItem;
  origDate?: string;
  date: string;
  start: string;
  end: string;
  status: ActivityStatus;
  rec: boolean;
  isSub?: boolean;
  sub?: Subtask;
  subNo?: number;
  n?: number;
  _lane?: number;
  _lanes?: number;
}

export interface PendingSuggestion {
  o: Occurrence;
  date?: string;
  start?: string;
  end?: string;
  conflict?: string;
}

export interface ProposalAction {
  tipo: 'mover' | 'criar' | 'status' | 'apagar';
  chave?: string;
  data?: string;
  inicio?: string;
  fim?: string;
  status?: ActivityStatus;
  titulo?: string;
  categoria?: string;
  prioridade?: PriorityLevel;
  desc: string;
}

export interface Proposal {
  id: string;
  resumo: string;
  acoes: ProposalAction[];
  state: 'open' | 'done' | 'discarded';
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  thinking?: boolean;
  status?: string;
  error?: string;
  proposals?: string[];
}
