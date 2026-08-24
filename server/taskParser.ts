import { Task, TaskStatus } from '../src/types/task.js';

export interface ParseResult {
  success: boolean;
  task?: Omit<Task, 'id' | 'createdAt' | 'updatedAt' | 'attemptCount'>;
  error?: string;
  missingFields?: string[];
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export class TaskParser {
  /**
   * Determine if a Telegram message is a task candidate
   */
  public detect(text: string, _chatId?: string): boolean {
    if (!text || typeof text !== 'string' || text.trim().length < 5) {
      return false;
    }

    const clean = text.trim();

    // Check JSON
    if (clean.startsWith('{') && clean.endsWith('}')) {
      return clean.includes('password') || clean.includes('motDePasse') || clean.includes('taskId') || clean.includes('prenom');
    }

    // Check standard keywords (French, English)
    const taskKeywordPattern = /(?:TASK|TÂCHE|TACHE|PRÉNOM|PRENOM|FIRST\s*NAME|MOT\s*DE\s*PASSE|PASSWORD)/i;
    return taskKeywordPattern.test(clean);
  }

  /**
   * Parse message text into structured candidate fields
   */
  public parse(text: string, customRegex?: string): ParseResult {
    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return {
        success: false,
        error: 'Empty message text'
      };
    }

    const cleanText = text.trim();

    // 1. JSON Format
    if (cleanText.startsWith('{') && cleanText.endsWith('}')) {
      try {
        const json = JSON.parse(cleanText);
        const rawTaskId = json.taskId || json.id || json.task_id || '';
        const rawFirstName = json.firstName || json.prenom || json.first_name || '';
        const rawLastName = json.lastName || json.nom || json.last_name || '';
        const rawPassword = json.password || json.motDePasse || json.mot_de_passe || '';
        const rawPhone = json.phone || json.telephone || json.tel;
        const rawNotes = json.notes || json.remarques;

        const normalized = this.normalize({
          taskId: rawTaskId,
          firstName: rawFirstName,
          lastName: rawLastName,
          password: rawPassword,
          phone: rawPhone,
          notes: rawNotes,
          rawMessage: text
        });

        const validation = this.validate(normalized);
        if (!validation.valid) {
          return {
            success: false,
            error: `Missing required field(s): ${validation.errors.join(', ')}`,
            missingFields: validation.errors
          };
        }

        return {
          success: true,
          task: normalized
        };
      } catch {
        // Fallback to text parsing
      }
    }

    // 2. Custom Regex if provided
    if (customRegex) {
      try {
        const reg = new RegExp(customRegex, 'i');
        const match = cleanText.match(reg);
        if (match && match.groups) {
          const normalized = this.normalize({
            taskId: match.groups.taskId,
            firstName: match.groups.firstName,
            lastName: match.groups.lastName,
            password: match.groups.password,
            phone: match.groups.phone,
            notes: match.groups.notes,
            rawMessage: text
          });
          const validation = this.validate(normalized);
          if (validation.valid) {
            return { success: true, task: normalized };
          }
        }
      } catch {
        // Fallback to standard
      }
    }

    // 3. Multi-line Text Parser (Line-by-line & Regex extraction)
    let taskId = '';
    let firstName = '';
    let lastName = '';
    let password = '';
    let phone: string | undefined;
    let notes: string | undefined;

    // Extract Task ID header
    const taskIdMatch =
      cleanText.match(/(?:TASK|TÂCHE|TACHE|ID|RÉFÉRENCE|REF)\s*[:#\-]?\s*([A-Za-z0-9_\-]+)/i) ||
      cleanText.match(/^#([A-Za-z0-9_\-]+)/m);
    if (taskIdMatch && taskIdMatch[1]) {
      taskId = taskIdMatch[1].trim();
    }

    const lines = cleanText.split(/\r?\n/);

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      // Prénom / First Name
      const fnMatch = trimmed.match(/^(?:Prénom|Prenom|First\s*Name|FirstName)\s*[:=\-]\s*(.+)$/i);
      if (fnMatch) {
        firstName = fnMatch[1].trim();
        continue;
      }

      // Nom / Last Name
      const lnMatch = trimmed.match(/^(?:Nom|Last\s*Name|LastName|Family\s*Name)\s*[:=\-]\s*(.+)$/i);
      if (lnMatch) {
        lastName = lnMatch[1].trim();
        continue;
      }

      // Mot de passe / Password
      const pwMatch = trimmed.match(/^(?:Mot\s*de\s*passe|Password|Pass|MDP|Mdp)\s*[:=\-]\s*(.+)$/i);
      if (pwMatch) {
        password = pwMatch[1].trim();
        continue;
      }

      // Phone / Téléphone
      const phMatch = trimmed.match(/^(?:Téléphone|Telephone|Tel|Phone|Mobile|Numéro|Numero)\s*[:=\-]\s*(.+)$/i);
      if (phMatch) {
        phone = phMatch[1].trim();
        continue;
      }

      // Notes / Remarques
      const noteMatch = trimmed.match(/^(?:Notes?|Remarques?|Commentaires?|Info)\s*[:=\-]\s*(.+)$/i);
      if (noteMatch) {
        notes = noteMatch[1].trim();
        continue;
      }
    }

    // Fallback for Task ID if not explicitly labeled
    if (!taskId) {
      const directNumMatch = cleanText.match(/\b\d{4,8}\b/);
      if (directNumMatch) {
        taskId = directNumMatch[0];
      } else {
        taskId = `TG-${Date.now().toString().slice(-5)}`;
      }
    }

    const normalized = this.normalize({
      taskId,
      firstName,
      lastName,
      password,
      phone,
      notes,
      rawMessage: text
    });

    const validation = this.validate(normalized);
    if (!validation.valid) {
      return {
        success: false,
        error: `Invalid task format: Missing required field(s): ${validation.errors.join(', ')}`,
        missingFields: validation.errors
      };
    }

    return {
      success: true,
      task: normalized
    };
  }

  /**
   * Validate extracted fields
   */
  public validate(task: Partial<Task>): ValidationResult {
    const errors: string[] = [];

    if (!task.telegramTaskId || String(task.telegramTaskId).trim().length === 0) {
      errors.push('Task ID');
    }
    if (!task.firstName || String(task.firstName).trim().length === 0) {
      errors.push('First Name (Prénom)');
    }
    if (!task.lastName || String(task.lastName).trim().length === 0) {
      errors.push('Last Name (Nom)');
    }
    if (!task.password || String(task.password).trim().length === 0) {
      errors.push('Password (Mot de passe)');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Normalize input into standard Task representation
   */
  public normalize(raw: {
    taskId?: string;
    firstName?: string;
    lastName?: string;
    password?: string;
    phone?: string;
    notes?: string;
    rawMessage?: string;
    telegramChatId?: string;
    telegramMessageId?: string;
  }): Omit<Task, 'id' | 'createdAt' | 'updatedAt' | 'attemptCount'> {
    return {
      telegramTaskId: String(raw.taskId || '').trim(),
      telegramChatId: raw.telegramChatId ? String(raw.telegramChatId) : '',
      telegramMessageId: raw.telegramMessageId ? String(raw.telegramMessageId) : '',
      sourceType: 'TELEGRAM',
      firstName: String(raw.firstName || '').trim(),
      lastName: String(raw.lastName || '').trim(),
      password: String(raw.password || '').trim(),
      phone: raw.phone && String(raw.phone).trim().length > 0 ? String(raw.phone).trim() : undefined,
      notes: raw.notes && String(raw.notes).trim().length > 0 ? String(raw.notes).trim() : undefined,
      rawTelegramMessage: raw.rawMessage || undefined,
      status: 'PENDING' as TaskStatus
    };
  }
}

export const taskParser = new TaskParser();

// Backward compatibility helper
export function parseTelegramTaskMessage(text: string, customRegex?: string): ParseResult {
  return taskParser.parse(text, customRegex);
}
