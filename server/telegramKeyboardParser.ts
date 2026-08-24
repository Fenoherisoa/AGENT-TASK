import { logger } from './logger.js';
import { TelegramReplyKeyboard, TelegramReplyKeyboardButton, TelegramInlineButton } from '../src/types/task.js';

export interface TelegramNormalizedButton {
  label: string;
  type: 'text' | 'callback' | 'url' | 'web_app' | 'request_phone' | 'request_location' | 'request_poll' | 'switch_inline' | 'command' | 'other';
  actionId: string;
  payload?: string;
  url?: string;
  webAppUrl?: string;
  samePeer?: boolean;
}

export interface TelegramParsedKeyboard {
  chatId: string;
  messageId?: string;
  type: 'REPLY_KEYBOARD' | 'INLINE_KEYBOARD' | 'COMMAND_MENU' | 'NONE';
  rows: TelegramNormalizedButton[][];
  resize?: boolean;
  singleUse?: boolean;
  selective?: boolean;
  placeholder?: string;
  updatedAt: string;
}

export class TelegramKeyboardParser {
  /**
   * Inspect a real MTProto / Bot API message or replyMarkup and detect keyboard markup
   */
  public parseMarkup(
    replyMarkup: any,
    chatId: string,
    messageId?: string
  ): {
    replyKeyboard: TelegramParsedKeyboard | null;
    inlineKeyboard: TelegramParsedKeyboard | null;
    isRemove: boolean;
  } {
    if (!replyMarkup) {
      return { replyKeyboard: null, inlineKeyboard: null, isRemove: false };
    }

    const className = replyMarkup.className || replyMarkup.constructor?.name || '';

    // 1. Remove Keyboard Detection (GramJS: ReplyKeyboardHide, ReplyKeyboardRemove / Bot API: remove_keyboard)
    if (
      className.includes('ReplyKeyboardHide') ||
      className.includes('ReplyKeyboardRemove') ||
      replyMarkup.hide ||
      replyMarkup.remove ||
      replyMarkup.remove_keyboard
    ) {
      logger.info(`Telegram keyboard removed for chat ${chatId} (message #${messageId || 'unknown'})`, {
        module: 'TELEGRAM'
      });
      return { replyKeyboard: null, inlineKeyboard: null, isRemove: true };
    }

    // 2. Inline Keyboard Detection (GramJS: ReplyInlineMarkup, InlineKeyboardMarkup / Bot API: inline_keyboard)
    if (className.includes('InlineMarkup') || className.includes('InlineKeyboardMarkup') || replyMarkup.inline_keyboard) {
      const rawRows = replyMarkup.rows || replyMarkup.inline_keyboard || [];
      const inlineRows: TelegramNormalizedButton[][] = [];

      let totalButtons = 0;
      for (let rIdx = 0; rIdx < rawRows.length; rIdx++) {
        const row = rawRows[rIdx];
        const rawBtns = Array.isArray(row) ? row : (row.buttons || []);
        const rowBtns: TelegramNormalizedButton[] = [];

        for (let cIdx = 0; cIdx < rawBtns.length; cIdx++) {
          const btn = rawBtns[cIdx];
          if (!btn) continue;

          const label = String(btn.text || btn.label || 'Action');
          const btnClass = btn.className || btn.constructor?.name || '';
          let type: TelegramNormalizedButton['type'] = 'other';
          let payload: string | undefined;
          let url: string | undefined;
          let webAppUrl: string | undefined;
          let samePeer: boolean | undefined;

          if (btn.url) {
            type = 'url';
            url = btn.url;
          } else if (btn.webApp || btn.app || btnClass.includes('WebView')) {
            type = 'web_app';
            webAppUrl = btn.webApp?.url || btn.app?.url || btn.url;
          } else if (btn.data !== undefined || btn.callback_data !== undefined) {
            type = 'callback';
            const rawData = btn.data !== undefined ? btn.data : btn.callback_data;
            if (Buffer.isBuffer(rawData)) {
              payload = rawData.toString('base64');
            } else if (typeof rawData === 'string') {
              payload = rawData;
            } else {
              payload = Buffer.from(String(rawData)).toString('base64');
            }
          } else if (btn.query !== undefined || btn.switch_inline_query !== undefined) {
            type = 'switch_inline';
            payload = btn.query || btn.switch_inline_query;
            samePeer = Boolean(btn.samePeer || btn.switch_inline_query_current_chat);
          }

          const actionId = `inline_${messageId || 'msg'}_${rIdx}_${cIdx}`;
          rowBtns.push({
            label,
            type,
            actionId,
            payload,
            url,
            webAppUrl,
            samePeer
          });
          totalButtons++;
        }

        if (rowBtns.length > 0) {
          inlineRows.push(rowBtns);
        }
      }

      if (inlineRows.length > 0) {
        logger.info(`Telegram keyboard detected: Chat ID: ${chatId}, Type: INLINE_KEYBOARD, Rows: ${inlineRows.length}, Buttons: ${totalButtons}`, {
          module: 'TELEGRAM'
        });
        return {
          replyKeyboard: null,
          inlineKeyboard: {
            chatId,
            messageId,
            type: 'INLINE_KEYBOARD',
            rows: inlineRows,
            updatedAt: new Date().toISOString()
          },
          isRemove: false
        };
      }
    }

    // 3. Reply Keyboard Detection (GramJS: ReplyKeyboardMarkup / Bot API: keyboard)
    const rawRows = replyMarkup.rows || replyMarkup.keyboard || [];
    if (Array.isArray(rawRows) && rawRows.length > 0) {
      const replyRows: TelegramNormalizedButton[][] = [];
      let totalButtons = 0;

      for (let rIdx = 0; rIdx < rawRows.length; rIdx++) {
        const row = rawRows[rIdx];
        const rawBtns = Array.isArray(row) ? row : (row.buttons || []);
        const rowBtns: TelegramNormalizedButton[] = [];

        for (let cIdx = 0; cIdx < rawBtns.length; cIdx++) {
          const btn = rawBtns[cIdx];
          if (!btn) continue;

          const label = typeof btn === 'string' ? btn : String(btn.text || btn.label || '');
          if (!label) continue;

          const btnClass = typeof btn === 'object' ? (btn.className || btn.constructor?.name || '') : '';
          let type: TelegramNormalizedButton['type'] = 'text';
          let webAppUrl: string | undefined;

          if (typeof btn === 'object') {
            if (btnClass.includes('RequestPhone') || btn.request_contact || btn.requestPhone) {
              type = 'request_phone';
            } else if (btnClass.includes('RequestGeoLocation') || btn.request_location || btn.requestLocation) {
              type = 'request_location';
            } else if (btnClass.includes('RequestPoll') || btn.request_poll || btn.requestPoll) {
              type = 'request_poll';
            } else if (btnClass.includes('WebView') || btn.web_app || btn.webApp) {
              type = 'web_app';
              webAppUrl = btn.web_app?.url || btn.webApp?.url || btn.url;
            }
          }

          const actionId = `reply_${rIdx}_${cIdx}`;
          rowBtns.push({
            label,
            type,
            actionId,
            payload: label,
            webAppUrl
          });
          totalButtons++;
        }

        if (rowBtns.length > 0) {
          replyRows.push(rowBtns);
        }
      }

      if (replyRows.length > 0) {
        logger.info(`Telegram keyboard detected: Chat ID: ${chatId}, Type: REPLY_KEYBOARD, Rows: ${replyRows.length}, Buttons: ${totalButtons}`, {
          module: 'TELEGRAM'
        });
        return {
          replyKeyboard: {
            chatId,
            messageId,
            type: 'REPLY_KEYBOARD',
            rows: replyRows,
            resize: Boolean(replyMarkup.resize || replyMarkup.resize_keyboard),
            singleUse: Boolean(replyMarkup.singleUse || replyMarkup.one_time_keyboard),
            selective: Boolean(replyMarkup.selective),
            placeholder: replyMarkup.placeholder || replyMarkup.input_field_placeholder || undefined,
            updatedAt: new Date().toISOString()
          },
          inlineKeyboard: null,
          isRemove: false
        };
      }
    }

    return { replyKeyboard: null, inlineKeyboard: null, isRemove: false };
  }

  /**
   * Convert normalized TelegramParsedKeyboard to classic TelegramReplyKeyboard
   */
  public toReplyKeyboardModel(parsed: TelegramParsedKeyboard): TelegramReplyKeyboard {
    const rows: TelegramReplyKeyboardButton[][] = parsed.rows.map(row =>
      row.map(btn => ({
        text: btn.label,
        type: btn.type === 'request_phone'
          ? 'request_phone'
          : btn.type === 'request_location'
          ? 'request_location'
          : btn.type === 'request_poll'
          ? 'request_poll'
          : btn.type === 'web_app'
          ? 'web_app'
          : 'text',
        webAppUrl: btn.webAppUrl
      }))
    );

    return {
      rows,
      resize: parsed.resize,
      singleUse: parsed.singleUse,
      selective: parsed.selective,
      placeholder: parsed.placeholder,
      sourceMessageId: parsed.messageId
    };
  }

  /**
   * Convert normalized TelegramParsedKeyboard to classic TelegramInlineButton[][]
   */
  public toInlineButtonsModel(parsed: TelegramParsedKeyboard): TelegramInlineButton[][] {
    return parsed.rows.map(row =>
      row.map(btn => ({
        text: btn.label,
        type: btn.type === 'url'
          ? 'url'
          : btn.type === 'web_app'
          ? 'web_app'
          : btn.type === 'switch_inline'
          ? 'switch_inline'
          : 'callback',
        url: btn.url,
        callbackData: btn.payload,
        webAppUrl: btn.webAppUrl,
        samePeer: btn.samePeer
      }))
    );
  }
}

export const telegramKeyboardParser = new TelegramKeyboardParser();
