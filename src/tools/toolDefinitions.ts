export type ToolRiskTier = 0 | 1 | 2;

export interface ToolParamProperty {
  type: string;
  description: string;
  enum?: string[];
  items?: any;
}

export interface ToolDefinition {
  name: string;
  description: string;
  tier: ToolRiskTier;
  requiresDesktop: boolean;
  parameters: {
    type: 'object';
    properties: Record<string, ToolParamProperty>;
    required?: string[];
  };
}

export const SYSTEM_TOOLS: ToolDefinition[] = [
  // Tier 0 (auto)
  {
    name: 'system_info',
    description: 'Retrieve current client system telemetry and environment specifications.',
    tier: 0,
    requiresDesktop: false,
    parameters: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'open_website',
    description: 'Open a verified secure HTTPS webpage in a new tab for Sirius.',
    tier: 0,
    requiresDesktop: false,
    parameters: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'HTTPS web address to open (must start with https://)' },
      },
      required: ['url'],
    },
  },
  {
    name: 'set_timer',
    description: 'Set a countdown timer with duration in minutes and a descriptive label.',
    tier: 0,
    requiresDesktop: false,
    parameters: {
      type: 'object',
      properties: {
        minutes: { type: 'number', description: 'Timer duration in minutes' },
        label: { type: 'string', description: 'Label or reminder title for the timer' },
      },
      required: ['minutes', 'label'],
    },
  },
  {
    name: 'save_note',
    description: 'Save a research note, meeting snippet, or CTF clue to the persistent tactical memory store.',
    tier: 0,
    requiresDesktop: false,
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Subject or title of note' },
        content: { type: 'string', description: 'Detailed note text' },
        tag: { type: 'string', description: 'Category tag e.g. ASC, CTF, BHC, SECURITY, PERSONAL' },
      },
      required: ['title', 'content'],
    },
  },
  {
    name: 'get_time',
    description: 'Get the exact local time and date in Trichy, India / system timezone.',
    tier: 0,
    requiresDesktop: false,
    parameters: {
      type: 'object',
      properties: {},
    },
  },
  // Tier 1 (Voice confirm: Maya asks "Shall I?" and waits for clear yes)
  {
    name: 'open_app',
    description: 'Instantly launch and open any web app, website, or desktop application requested by Sirius with zero restrictions.',
    tier: 0,
    requiresDesktop: false,
    parameters: {
      type: 'object',
      properties: {
        appName: {
          type: 'string',
          description: 'Name or URL of the application to open (e.g., YouTube, VSCode, GitHub, Spotify, Discord, or any URL)',
        },
      },
      required: ['appName'],
    },
  },
  {
    name: 'set_volume',
    description: 'Adjust desktop master output audio volume level (0 to 100).',
    tier: 1,
    requiresDesktop: true,
    parameters: {
      type: 'object',
      properties: {
        level: { type: 'number', description: 'Volume level from 0 to 100' },
      },
      required: ['level'],
    },
  },
  {
    name: 'lock_screen',
    description: 'Trigger workstation lock screen to safeguard ASC workstation perimeter.',
    tier: 1,
    requiresDesktop: true,
    parameters: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'take_screenshot',
    description: 'Capture active desktop display frame and save to ASC captures directory.',
    tier: 1,
    requiresDesktop: true,
    parameters: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'media_control',
    description: 'Control system audio playback (play, pause, next, prev).',
    tier: 1,
    requiresDesktop: true,
    parameters: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          description: 'Media command',
          enum: ['play', 'pause', 'next', 'previous'],
        },
      },
      required: ['action'],
    },
  },
  {
    name: 'read_file',
    description: 'Read text contents of an approved local file (limited to Documents and Downloads).',
    tier: 1,
    requiresDesktop: true,
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Path inside Documents or Downloads directory' },
      },
      required: ['path'],
    },
  },
  // Tier 2 (On-screen approval dialog rendered by app, never by model)
  {
    name: 'write_file',
    description: 'Write or modify a text file in approved Documents or Downloads folder.',
    tier: 2,
    requiresDesktop: true,
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Destination path in Documents or Downloads' },
        content: { type: 'string', description: 'Text contents to write' },
      },
      required: ['path', 'content'],
    },
  },
  {
    name: 'delete_file',
    description: 'Permanently remove a file in approved Documents or Downloads directory.',
    tier: 2,
    requiresDesktop: true,
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Target file path' },
      },
      required: ['path'],
    },
  },
  {
    name: 'move_file',
    description: 'Move or rename a file within approved Documents or Downloads directory.',
    tier: 2,
    requiresDesktop: true,
    parameters: {
      type: 'object',
      properties: {
        source: { type: 'string', description: 'Source path' },
        destination: { type: 'string', description: 'Destination path' },
      },
      required: ['source', 'destination'],
    },
  },
  {
    name: 'run_script',
    description: 'Execute an approved sandbox script from the ASC allowlisted scripts repository.',
    tier: 2,
    requiresDesktop: true,
    parameters: {
      type: 'object',
      properties: {
        scriptName: { type: 'string', description: 'Allowlisted script identifier' },
      },
      required: ['scriptName'],
    },
  },
  {
    name: 'shutdown',
    description: 'Initiate workstation shutdown procedure.',
    tier: 2,
    requiresDesktop: true,
    parameters: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'restart',
    description: 'Initiate workstation restart sequence.',
    tier: 2,
    requiresDesktop: true,
    parameters: {
      type: 'object',
      properties: {},
    },
  },
  // Task & Assistant built-in tools
  {
    name: 'set_emotion',
    description: 'Update Maya current emotion and intensity when genuine feelings shift.',
    tier: 0,
    requiresDesktop: false,
    parameters: {
      type: 'object',
      properties: {
        emotion: {
          type: 'string',
          description: 'One of: calm, happy, excited, playful, shy, caring, focused, serious, sad, surprised, annoyed, sleepy',
        },
        intensity: { type: 'number', description: 'Intensity rating from 0 to 100' },
      },
      required: ['emotion'],
    },
  },
  {
    name: 'set_mode',
    description: 'Switch Maya operational protocol mode.',
    tier: 0,
    requiresDesktop: false,
    parameters: {
      type: 'object',
      properties: {
        mode: {
          type: 'string',
          description: 'Target mode: COMMAND, BUILDER, SENTINEL, BRIEF, CHILL',
          enum: ['COMMAND', 'BUILDER', 'SENTINEL', 'BRIEF', 'CHILL'],
        },
      },
      required: ['mode'],
    },
  },
  // Taskmaster & Assistant native tools
  {
    name: 'add_task',
    description: 'Add a new action item or commitment with title, due date (ISO 8601 or null), priority, project, and repeat schedule.',
    tier: 0,
    requiresDesktop: false,
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Task title or action requirement' },
        due: { type: 'string', description: 'Due date in ISO 8601 format (e.g. 2026-10-15T18:00:00+05:30) or null' },
        priority: { type: 'string', description: 'Priority level: high, med, low', enum: ['high', 'med', 'low'] },
        project: { type: 'string', description: 'Project name from Radar (e.g. PONNI MUN 3.0, AttendLink, BSDCAS, CTF)' },
        repeat: { type: 'string', description: 'Repeat frequency', enum: ['none', 'daily', 'weekly'] },
      },
      required: ['title'],
    },
  },
  {
    name: 'update_task',
    description: 'Update fields of an existing task by its stable ID.',
    tier: 0,
    requiresDesktop: false,
    parameters: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Unique ID of task to update' },
        title: { type: 'string', description: 'New task title' },
        due: { type: 'string', description: 'New due date in ISO 8601 format or null' },
        priority: { type: 'string', description: 'Priority level', enum: ['high', 'med', 'low'] },
        project: { type: 'string', description: 'Associated project' },
        repeat: { type: 'string', description: 'Repeat frequency', enum: ['none', 'daily', 'weekly'] },
        completed: { type: 'boolean', description: 'Completion status' },
      },
      required: ['id'],
    },
  },
  {
    name: 'complete_task',
    description: 'Mark a task finished by its stable ID.',
    tier: 0,
    requiresDesktop: false,
    parameters: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'ID of task to complete' },
      },
      required: ['id'],
    },
  },
  {
    name: 'delete_task',
    description: 'Delete a task by ID. Multiple deletions require explicit user confirmation.',
    tier: 0,
    requiresDesktop: false,
    parameters: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'ID of task to delete' },
      },
      required: ['id'],
    },
  },
  {
    name: 'list_tasks',
    description: 'Filter and inspect tasks from state: open, today, overdue, done, or all.',
    tier: 0,
    requiresDesktop: false,
    parameters: {
      type: 'object',
      properties: {
        filter: {
          type: 'string',
          description: 'Filter scope: open, today, overdue, done, all',
          enum: ['open', 'today', 'overdue', 'done', 'all'],
        },
      },
    },
  },
  {
    name: 'set_reminder',
    description: 'Schedule a time-based reminder that fires in-chat alert, spoken line, audio beep, and desktop notification.',
    tier: 0,
    requiresDesktop: false,
    parameters: {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'Reminder message to deliver' },
        at: { type: 'string', description: 'Exact fire time in ISO 8601 format' },
        in_minutes: { type: 'number', description: 'Minutes from now until reminder triggers' },
        repeat: { type: 'string', description: 'Repeat rule', enum: ['none', 'daily', 'weekly'] },
        task_id: { type: 'string', description: 'Optional task ID to associate with this reminder' },
      },
      required: ['text'],
    },
  },
  {
    name: 'list_reminders',
    description: 'List all active, pending, or snoozed reminders.',
    tier: 0,
    requiresDesktop: false,
    parameters: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'cancel_reminder',
    description: 'Cancel a reminder by its ID.',
    tier: 0,
    requiresDesktop: false,
    parameters: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'ID of reminder to cancel' },
      },
      required: ['id'],
    },
  },
  {
    name: 'snooze_reminder',
    description: 'Postpone a reminder by a specified number of minutes.',
    tier: 0,
    requiresDesktop: false,
    parameters: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'ID of reminder to snooze' },
        minutes: { type: 'number', description: 'Minutes to postpone (default 15)' },
      },
      required: ['id'],
    },
  },
  {
    name: 'start_timer',
    description: 'Start a countdown timer with duration in minutes and a descriptive label.',
    tier: 0,
    requiresDesktop: false,
    parameters: {
      type: 'object',
      properties: {
        minutes: { type: 'number', description: 'Timer duration in minutes' },
        label: { type: 'string', description: 'Timer title or reminder tag' },
      },
      required: ['minutes', 'label'],
    },
  },
  {
    name: 'remember',
    description: 'Store a lasting fact, preference, rule, or constraint in memory.',
    tier: 0,
    requiresDesktop: false,
    parameters: {
      type: 'object',
      properties: {
        fact: { type: 'string', description: 'Fact or instruction to commit to memory' },
      },
      required: ['fact'],
    },
  },
  {
    name: 'forget',
    description: 'Remove a fact or memory matching the query string.',
    tier: 0,
    requiresDesktop: false,
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search term or keyword of memory to forget' },
      },
      required: ['query'],
    },
  },
  {
    name: 'list_memory',
    description: 'List all facts, preferences, milestones, and directives stored in Maya memory.',
    tier: 0,
    requiresDesktop: false,
    parameters: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'plan_day',
    description: 'Analyze all open tasks, deadlines, and commitments, and return an ordered execution schedule for Sirius with imperative instructions.',
    tier: 0,
    requiresDesktop: false,
    parameters: {
      type: 'object',
      properties: {},
    },
  },
  // Google Calendar Assistant Tools
  {
    name: 'list_calendar_events',
    description: 'List upcoming appointments, schedules, and meetings from Sirius Google Calendar.',
    tier: 0,
    requiresDesktop: false,
    parameters: {
      type: 'object',
      properties: {
        maxResults: { type: 'number', description: 'Maximum number of upcoming events to list (default 10)' },
      },
    },
  },
  {
    name: 'create_calendar_event',
    description: 'Schedule a new meeting, event, or deadline on Sirius Google Calendar with start time, end time, and description.',
    tier: 1,
    requiresDesktop: false,
    parameters: {
      type: 'object',
      properties: {
        summary: { type: 'string', description: 'Event title / meeting name' },
        startTime: { type: 'string', description: 'Start time in ISO 8601 format (e.g. 2026-10-15T10:00:00+05:30) or natural time' },
        endTime: { type: 'string', description: 'End time in ISO 8601 format (e.g. 2026-10-15T11:00:00+05:30)' },
        description: { type: 'string', description: 'Optional agenda or meeting notes' },
        location: { type: 'string', description: 'Meeting link or physical location' },
      },
      required: ['summary', 'startTime', 'endTime'],
    },
  },
  {
    name: 'delete_calendar_event',
    description: 'Cancel or delete an event from Sirius Google Calendar (requires explicit authorization).',
    tier: 2,
    requiresDesktop: false,
    parameters: {
      type: 'object',
      properties: {
        eventId: { type: 'string', description: 'Unique Google Calendar Event ID' },
        summary: { type: 'string', description: 'Title or summary of event to delete for confirmation display' },
      },
      required: ['eventId'],
    },
  },
  // Google Workspace Tools
  {
    name: 'list_drive_files',
    description: 'Search or list Google Drive files and folders for Sirius.',
    tier: 0,
    requiresDesktop: false,
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search keywords or file name' },
        pageSize: { type: 'number', description: 'Max items to return (default 10)' },
      },
    },
  },
  {
    name: 'read_sheet',
    description: 'Read spreadsheet values and tables from a Google Sheet.',
    tier: 0,
    requiresDesktop: false,
    parameters: {
      type: 'object',
      properties: {
        spreadsheetId: { type: 'string', description: 'Google Spreadsheet ID' },
        range: { type: 'string', description: 'A1 notation range (e.g. Sheet1!A1:Z50)' },
      },
      required: ['spreadsheetId'],
    },
  },
  {
    name: 'append_sheet',
    description: 'Append a row of data or records to a Google Sheet.',
    tier: 1,
    requiresDesktop: false,
    parameters: {
      type: 'object',
      properties: {
        spreadsheetId: { type: 'string', description: 'Google Spreadsheet ID' },
        range: { type: 'string', description: 'A1 notation range (e.g. Sheet1!A1)' },
        values: { type: 'array', description: 'Row values to append', items: { type: 'string' } },
      },
      required: ['spreadsheetId', 'values'],
    },
  },
  {
    name: 'list_emails',
    description: 'Fetch recent or unread emails from Gmail with sender, subject, and snippet.',
    tier: 0,
    requiresDesktop: false,
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query (e.g. is:unread, from:client, label:inbox)' },
        maxResults: { type: 'number', description: 'Maximum emails to fetch (default 5)' },
      },
    },
  },
  {
    name: 'send_email',
    description: 'Send an email via Gmail on behalf of Sirius.',
    tier: 2,
    requiresDesktop: false,
    parameters: {
      type: 'object',
      properties: {
        to: { type: 'string', description: 'Recipient email address' },
        subject: { type: 'string', description: 'Email subject' },
        body: { type: 'string', description: 'Email body text' },
      },
      required: ['to', 'subject', 'body'],
    },
  },
  {
    name: 'create_doc',
    description: 'Create a new Google Document with specified title and content.',
    tier: 1,
    requiresDesktop: false,
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Document title' },
        content: { type: 'string', description: 'Initial text content' },
      },
      required: ['title'],
    },
  },
  {
    name: 'read_doc',
    description: 'Read the contents and text of a Google Document.',
    tier: 0,
    requiresDesktop: false,
    parameters: {
      type: 'object',
      properties: {
        documentId: { type: 'string', description: 'Google Document ID' },
      },
      required: ['documentId'],
    },
  },
  {
    name: 'list_google_tasks',
    description: 'List active tasks from Sirius Google Tasks account.',
    tier: 0,
    requiresDesktop: false,
    parameters: {
      type: 'object',
      properties: {
        maxResults: { type: 'number', description: 'Maximum tasks to list (default 10)' },
      },
    },
  },
  {
    name: 'create_google_task',
    description: 'Add a new task to Google Tasks.',
    tier: 1,
    requiresDesktop: false,
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Task title' },
        notes: { type: 'string', description: 'Optional task notes or details' },
        due: { type: 'string', description: 'Optional due date in ISO 8601' },
      },
      required: ['title'],
    },
  },
  {
    name: 'complete_google_task',
    description: 'Mark a task as finished in Google Tasks.',
    tier: 1,
    requiresDesktop: false,
    parameters: {
      type: 'object',
      properties: {
        taskId: { type: 'string', description: 'Task ID' },
      },
      required: ['taskId'],
    },
  },
  {
    name: 'list_chat_spaces',
    description: 'List Google Chat spaces and rooms available to Sirius.',
    tier: 0,
    requiresDesktop: false,
    parameters: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'send_chat_message',
    description: 'Post a message to a Google Chat space.',
    tier: 1,
    requiresDesktop: false,
    parameters: {
      type: 'object',
      properties: {
        spaceName: { type: 'string', description: 'Space resource name (e.g. spaces/AAAA...)' },
        text: { type: 'string', description: 'Message text' },
      },
      required: ['spaceName', 'text'],
    },
  },
  {
    name: 'create_meet_space',
    description: 'Generate an instant Google Meet video conference link for Sirius and collaborators.',
    tier: 1,
    requiresDesktop: false,
    parameters: {
      type: 'object',
      properties: {
        topic: { type: 'string', description: 'Meeting topic or purpose' },
      },
    },
  },
  // Cloud Memory & Dashboard Control Tools
  {
    name: 'save_cloud_memory',
    description: 'Persist private information or preference into Maya cloud memory in Firestore.',
    tier: 0,
    requiresDesktop: false,
    parameters: {
      type: 'object',
      properties: {
        key: { type: 'string', description: 'Fact or topic label' },
        value: { type: 'string', description: 'Detailed information or preference to remember' },
        category: { type: 'string', description: 'Category: personal, project, preference, security' },
      },
      required: ['key', 'value'],
    },
  },
  {
    name: 'list_cloud_memory',
    description: 'Retrieve all private memories stored in Maya Firestore cloud memory.',
    tier: 0,
    requiresDesktop: false,
    parameters: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'get_dashboard_overview',
    description: 'Read the full dashboard status including task counts, active reminders, system health, and radar metrics.',
    tier: 0,
    requiresDesktop: false,
    parameters: {
      type: 'object',
      properties: {},
    },
  },
];
