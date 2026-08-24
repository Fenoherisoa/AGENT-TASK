import {
  TelegramChat,
  TelegramMessage,
  TelegramCapabilities,
  TelegramInlineButton,
  TelegramReplyKeyboard,
  TelegramReplyKeyboardButton,
  TelegramParsedKeyboard,
  TelegramBotCommand,
  TelegramBotMenuButton,
  TelegramStructuredControl,
  TelegramChatUIState
} from '../src/types/task.js';
import { telegramKeyboardParser } from './telegramKeyboardParser.js';

export class TelegramUIParser {
  /**
   * Parse MTProto / Telegram reply markup into structured Reply Keyboard
   */
  public parseReplyKeyboard(replyMarkup: any, sourceMessageId?: string, chatId = 'unknown'): TelegramReplyKeyboard | null {
    if (!replyMarkup) return null;

    const parsed = telegramKeyboardParser.parseMarkup(replyMarkup, chatId, sourceMessageId);
    if (parsed.replyKeyboard) {
      return telegramKeyboardParser.toReplyKeyboardModel(parsed.replyKeyboard);
    }
    return null;
  }

  /**
   * Extract active inline keyboards from message history
   */
  public parseInlineKeyboards(messages: TelegramMessage[]): Array<{ messageId: string; rows: TelegramInlineButton[][] }> {
    const list: Array<{ messageId: string; rows: TelegramInlineButton[][] }> = [];
    if (!Array.isArray(messages)) return list;

    // Search messages in reverse order (most recent first)
    for (const msg of messages) {
      if (msg.inlineButtons && msg.inlineButtons.length > 0) {
        list.push({
          messageId: msg.id,
          rows: msg.inlineButtons
        });
      }
    }
    return list;
  }

  /**
   * Build complete Chat UI State model and normalize structured controls for Automation Engine
   */
  public parseChatUIState(
    chat: TelegramChat,
    messages: TelegramMessage[],
    options?: {
      replyKeyboard?: TelegramReplyKeyboard | null;
      parsedKeyboard?: TelegramParsedKeyboard | null;
      botCommands?: TelegramBotCommand[];
      botMenuButton?: TelegramBotMenuButton;
      linkedDiscussionChatId?: string;
    }
  ): TelegramChatUIState {
    const isChannel = chat.type === 'channel';
    const isBot = chat.type === 'bot';
    const capabilities = chat.capabilities || {
      canSend: true,
      canReply: true,
      canEdit: true,
      canDelete: false,
      canForward: true,
      canPin: false,
      canReact: true,
      canInvite: false,
      canManageTopics: false,
      isChannel,
      isGroup: chat.type === 'group',
      isSupergroup: chat.type === 'supergroup',
      isPrivate: chat.type === 'private',
      isBot,
      isServiceChat: false,
      isAdmin: false
    };

    const canSend = Boolean(capabilities.canSend);
    const canReply = Boolean(capabilities.canReply);
    const canAttach = Boolean(canSend);
    const isReadOnly = !canSend;
    const hasDiscussion = Boolean(options?.linkedDiscussionChatId);

    // 1. Reply keyboard resolution: explicit option or extracted from latest messages
    let replyKeyboard: TelegramReplyKeyboard | undefined = options?.replyKeyboard || undefined;
    let parsedKeyboard: TelegramParsedKeyboard | undefined = options?.parsedKeyboard || undefined;

    if (replyKeyboard === undefined && messages.length > 0) {
      // Find latest message with reply keyboard
      for (let i = messages.length - 1; i >= 0; i--) {
        const m = messages[i];
        if ((m as any).replyKeyboard) {
          replyKeyboard = (m as any).replyKeyboard;
          break;
        }
      }
    }

    // 2. Inline Keyboards (associated per message ID)
    const activeInlineButtons = this.parseInlineKeyboards(messages.slice(-15));

    // 3. Bot commands and Bot Menu Button
    const botCommands = options?.botCommands && options.botCommands.length > 0 ? options.botCommands : undefined;
    const botMenuButton = options?.botMenuButton;

    // Detect if bot exposes a persistent OPEN / Web App / Menu interface (RFC 2.3)
    let botHasOpenInterface = false;
    let openButtonType: string | undefined;
    let openButtonAction: string | undefined;

    if (isBot) {
      if (botMenuButton && (botMenuButton.url || botMenuButton.type === 'web_app')) {
        botHasOpenInterface = true;
        openButtonType = botMenuButton.type;
        openButtonAction = botMenuButton.url || undefined;
      } else {
        // Search in messages for web_app / start app button
        for (const m of messages) {
          if (m.inlineButtons) {
            for (const row of m.inlineButtons) {
              for (const btn of row) {
                if (btn.type === 'web_app' && btn.webAppUrl) {
                  botHasOpenInterface = true;
                  openButtonType = 'web_app';
                  openButtonAction = btn.webAppUrl;
                  break;
                }
              }
              if (botHasOpenInterface) break;
            }
          }
          if (botHasOpenInterface) break;
        }

        // Also check if reply keyboard contains web_app button
        if (!botHasOpenInterface && replyKeyboard?.rows) {
          for (const row of replyKeyboard.rows) {
            for (const btn of row) {
              if (btn.type === 'web_app' && btn.webAppUrl) {
                botHasOpenInterface = true;
                openButtonType = 'web_app';
                openButtonAction = btn.webAppUrl;
                break;
              }
            }
            if (botHasOpenInterface) break;
          }
        }
      }
    }

    // 4. Structured Controls Extraction (Strictly typed for Automation Engine)
    const structuredControls: TelegramStructuredControl[] = [];

    // Add persistent Bot Open Action if available
    if (botHasOpenInterface) {
      structuredControls.push({
        id: 'bot_open_action',
        type: 'web_app',
        label: botMenuButton?.text || 'OPEN',
        url: openButtonAction,
        payload: openButtonAction,
        callbackDataAvailable: false,
        enabled: true,
        visible: true
      });
    }

    // Add Reply Keyboard buttons
    if (replyKeyboard && replyKeyboard.rows) {
      replyKeyboard.rows.forEach((row, rIdx) => {
        row.forEach((btn, cIdx) => {
          structuredControls.push({
            id: `reply_${rIdx}_${cIdx}`,
            type: btn.type === 'request_phone'
              ? 'phone_request'
              : btn.type === 'request_location'
              ? 'location_request'
              : btn.type === 'web_app'
              ? 'web_app'
              : 'reply_button',
            label: btn.text,
            sourceMessageId: replyKeyboard?.sourceMessageId,
            callbackDataAvailable: false,
            url: btn.webAppUrl,
            payload: btn.text,
            enabled: true,
            visible: true,
            row: rIdx,
            col: cIdx
          });
        });
      });
    }

    // Add Inline buttons attached to specific messages
    for (const group of activeInlineButtons) {
      group.rows.forEach((row, rIdx) => {
        row.forEach((btn, cIdx) => {
          structuredControls.push({
            id: `inline_${group.messageId}_${rIdx}_${cIdx}`,
            type: btn.type === 'url'
              ? 'url'
              : btn.type === 'web_app'
              ? 'web_app'
              : 'inline_button',
            label: btn.text,
            sourceMessageId: group.messageId,
            callbackDataAvailable: Boolean(btn.callbackData),
            url: btn.url || btn.webAppUrl,
            payload: btn.callbackData,
            enabled: true,
            visible: true,
            row: rIdx,
            col: cIdx
          });
        });
      });
    }

    // Add Bot Commands
    if (botCommands) {
      for (const cmd of botCommands) {
        structuredControls.push({
          id: `cmd_${cmd.command.replace(/^\//, '')}`,
          type: 'command',
          label: cmd.command,
          command: cmd.command,
          payload: cmd.command,
          callbackDataAvailable: false,
          enabled: canSend,
          visible: true
        });
      }
    }

    // Add Channel Discussion Control
    if (hasDiscussion && options?.linkedDiscussionChatId) {
      structuredControls.push({
        id: 'channel_discussion_action',
        type: 'discussion',
        label: 'Ouvrir la discussion',
        payload: options.linkedDiscussionChatId,
        callbackDataAvailable: false,
        enabled: true,
        visible: true
      });
    }

    return {
      chatId: chat.id,
      chatType: chat.type,
      title: chat.title,
      canSend,
      canReply,
      canAttach,
      isReadOnly,
      isChannel,
      hasDiscussion,
      discussionChatId: options?.linkedDiscussionChatId,
      replyKeyboard: replyKeyboard || undefined,
      parsedKeyboard: parsedKeyboard || undefined,
      botCommands,
      botMenuButton,
      botHasOpenInterface,
      openButtonVisible: botHasOpenInterface,
      openButtonType,
      openButtonAction,
      activeInlineButtons: activeInlineButtons.length > 0 ? activeInlineButtons : undefined,
      structuredControls,
      updatedAt: new Date().toISOString()
    };
  }
}

export const telegramUIParser = new TelegramUIParser();
export { telegramKeyboardParser };

