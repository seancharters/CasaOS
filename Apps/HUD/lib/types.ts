export interface WidgetConfigs {
  loginStatus: {
    excludeExtensions: string;
    filterStatus: 'all' | 'LoggedIn' | 'LoggedOut';
    columns: string;
  };
  callStats: {
    hiddenMetrics: string;
    onCallQueueId: string;
    voicemailExtension: string;
    trunkFilter: string;
  };
  ticketStats: {
    boardNames: string;
  };
  ticketsChart: {
    excludeMembers: string;
    maxEntries: string;
  };
  priorityTickets: {
    includePriorities: string;
    boardNames: string;
    maxRows: string;
    columns: string;
  };
}

export const defaultWidgetConfigs: WidgetConfigs = {
  loginStatus: { excludeExtensions: '', filterStatus: 'all', columns: 'name,extension,status' },
  callStats: { hiddenMetrics: '', onCallQueueId: '64', voicemailExtension: '', trunkFilter: '' },
  ticketStats: { boardNames: '' },
  ticketsChart: { excludeMembers: '', maxEntries: '10' },
  priorityTickets: { includePriorities: '1,2', boardNames: '', maxRows: '20', columns: 'id,priority,status,company,engineer,summary' },
};

export interface HudConfig {
  connectwise: {
    siteUrl: string;
    companyId: string;
    publicKey: string;
    privateKey: string;
    clientId: string;
  };
  threecx: {
    host: string;
    clientId: string;
    clientSecret: string;
  };
  postgres?: {
    host: string;
    port: string;
    database: string;
    username: string;
    password: string;
    ssl: boolean;
  };
  dashboard: WidgetConfigs;
  dashboardSales: WidgetConfigs;
}

export const defaultConfig: HudConfig = {
  connectwise: {
    siteUrl: '',
    companyId: '',
    publicKey: '',
    privateKey: '',
    clientId: '',
  },
  threecx: {
    host: '',
    clientId: '',
    clientSecret: '',
  },
  postgres: {
    host: '',
    port: '5432',
    database: '',
    username: '',
    password: '',
    ssl: false,
  },
  dashboard: defaultWidgetConfigs,
  dashboardSales: defaultWidgetConfigs,
};

export interface AgentStatus {
  name: string;
  extension: string;
  status: 'LoggedIn' | 'LoggedOut';
}

export interface CallStats {
  pctAnswered: number | null;
  answeredOverflow: number | null;
  missedCalls: number | null;
  totalCalls: number | null;
  avgTalkDuration: string | null;
  avgCallDuration: string | null;
  onCallEngineer: string | null;
  afterHoursCalls: number | null;
  activeCalls: ActiveCall[];
  voicemailCount: number | null;
}

export interface ActiveCall {
  caller: string;
  callee: string;
  duration: string;
}

export interface TicketStats {
  open: number | null;
  unassigned: number | null;
  openToday: number | null;
  noUpdateOver48h: number | null;
  p1Count: number | null;
  p2Count: number | null;
  p3Count: number | null;
  closedToday: number | null;
}

export interface TicketResource {
  name: string;
  count: number;
}

export interface PriorityTicket {
  id: number;
  company: string;
  priority: string;
  engineer: string;
  summary: string;
  status: string;
}

export interface DashboardData {
  callStats: CallStats;
  agentStatus: AgentStatus[];
  ticketStats: TicketStats;
  ticketsPerResource: TicketResource[];
  priorityTickets: PriorityTicket[];
  lastUpdated: string;
  isDemo: boolean;
  errors: string[];
}

export const emptyData: DashboardData = {
  callStats: {
    pctAnswered: null,
    answeredOverflow: null,
    missedCalls: null,
    totalCalls: null,
    avgTalkDuration: null,
    avgCallDuration: null,
    onCallEngineer: null,
    afterHoursCalls: null,
    activeCalls: [],
    voicemailCount: null,
  },
  agentStatus: [],
  ticketStats: {
    open: null,
    unassigned: null,
    openToday: null,
    noUpdateOver48h: null,
    p1Count: null,
    p2Count: null,
    p3Count: null,
    closedToday: null,
  },
  ticketsPerResource: [],
  priorityTickets: [],
  lastUpdated: new Date().toISOString(),
  isDemo: false,
  errors: [],
};
