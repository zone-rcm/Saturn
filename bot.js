const axios = require('axios');
const moment = require('moment-jalaali');

// Configuration - replace these values with your actual data
const BOT_TOKEN = 'YOUR_BOT_TOKEN'; // Replace with your actual bot token
const API_URL = `https://tapi.bale.ai/bot${BOT_TOKEN}`;
const ADMIN_IDS = [1085839779, 844843541]; // Replace with your actual admin IDs
const USER_FEEDBACK_LIMIT = {};
const POLLING_INTERVAL = 3000; // 3 seconds

// Persian numerals
const persianNumbers = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];

function toPersianNumbers(num) {
    return num.toString().replace(/\d/g, d => persianNumbers[d]);
}

function getPersianDateTime() {
    const now = moment();
    const date = now.format('jYYYY/jMM/jDD');
    const time = now.format('HH:mm');
    return `${toPersianNumbers(date)} - ${toPersianNumbers(time)}`;
}

async function sendRequest(method, data) {
    try {
        const response = await axios.post(`${API_URL}/${method}`, data);
        return response.data;
    } catch (error) {
        console.error('Error in Telegram API request:', error.response?.data || error.message);
        return null;
    }
}

async function handleStart(chatId, messageId, userId, username, firstName) {
    const greeting = `*سلام ${firstName || 'کاربر'} عزیز!* 👋\n`
        + `🕒 *زمان:* ${getPersianDateTime()}\n\n`
        + `لطفاً رباتی که می‌خواهید به آن بازخورد دهید را انتخاب کنید:`;

    const keyboard = {
        inline_keyboard: [
            [{ text: 'ربات آپلود | uploadd_bot•', callback_data: 'select_uploader' }]
        ]
    };

    await sendRequest('sendMessage', {
        chat_id: chatId,
        text: greeting,
        parse_mode: 'Markdown',
        reply_markup: keyboard
    });
}

async function showUploaderInfo(chatId, messageId) {
    const infoText = `*نام:* •آ‌پــلــودر | 𝙪𝙥𝙡𝙤𝙖𝙙𝙚𝙧•\n`
        + `*آی‌دی:* @uploadd_bot\n`
        + `*هدف:* آپلود و مدیریت فایل‌ها به روشی آسان و مدرن!`;

    const keyboard = {
        inline_keyboard: [
            [{ text: 'ارسال بازخورد', callback_data: 'send_feedback_uploader' }],
            [{ text: 'بازگشت', callback_data: 'back_to_main' }]
        ]
    };

    await sendRequest('editMessageText', {
        chat_id: chatId,
        message_id: messageId,
        text: infoText,
        parse_mode: 'Markdown',
        reply_markup: keyboard
    });
}

async function askForFeedback(chatId, messageId) {
    await sendRequest('editMessageText', {
        chat_id: chatId,
        message_id: messageId,
        text: 'لطفاً بازخورد خود درباره این ربات را وارد کنید:',
        reply_markup: {
            inline_keyboard: [
                [{ text: 'بازگشت', callback_data: 'back_to_uploader_info' }]
            ]
        }
    });
}

async function processFeedback(chatId, userId, username, firstName, text, messageId) {
    // Check feedback limit
    const today = moment().format('YYYY-MM-DD');
    if (USER_FEEDBACK_LIMIT[userId] === today) {
        await sendRequest('sendMessage', {
            chat_id: chatId,
            text: 'شما امروز قبلاً بازخورد ارسال کرده‌اید. هر کاربر فقط می‌تواند یک بار در روز بازخورد ارسال کند.'
        });
        return;
    }

    USER_FEEDBACK_LIMIT[userId] = today;

    const feedbackInfo = `*بازخورد جدید دریافت شد!*\n\n`
        + ````\n${text}\n```\n\n`
        + `*ارسال کننده:* ${firstName}${username ? ` (@${username})` : ''}\n`
        + `*آی‌دی کاربر:* ${userId}\n`
        + `*زمان:* ${getPersianDateTime()}`;

    const keyboard = {
        inline_keyboard: [
            [{ text: 'ارسال بازخورد به کاربر', callback_data: `forward_${userId}_${messageId}` }]
        ]
    };

    // Send to all admins
    for (const adminId of ADMIN_IDS) {
        await sendRequest('sendMessage', {
            chat_id: adminId,
            text: feedbackInfo,
            parse_mode: 'Markdown',
            reply_markup: keyboard
        });
    }

    await sendRequest('sendMessage', {
        chat_id: chatId,
        text: 'بازخورد شما با موفقیت ثبت شد. از مشارکت شما متشکریم! 🙏'
    });
}

async function handleCallbackQuery(callbackQuery) {
    const { id, data, message } = callbackQuery;
    const chatId = message.chat.id;
    const messageId = message.message_id;
    const userId = callbackQuery.from.id;
    const username = callbackQuery.from.username;
    const firstName = callbackQuery.from.first_name;

    // Answer callback query first
    await sendRequest('answerCallbackQuery', { callback_query_id: id });

    switch (data) {
        case 'select_uploader':
            await showUploaderInfo(chatId, messageId);
            break;
        case 'back_to_main':
            await handleStart(chatId, messageId, userId, username, firstName);
            break;
        case 'send_feedback_uploader':
            await askForFeedback(chatId, messageId);
            break;
        case 'back_to_uploader_info':
            await showUploaderInfo(chatId, messageId);
            break;
        default:
            if (data.startsWith('forward_')) {
                const parts = data.split('_');
                const targetUserId = parts[1];
                const originalMessageId = parts[2];

                // Forward the original feedback message
                await sendRequest('forwardMessage', {
                    chat_id: targetUserId,
                    from_chat_id: chatId,
                    message_id: originalMessageId
                });
            }
            break;
    }
}

// Long polling implementation
let lastUpdateId = 0;

async function getUpdates() {
    try {
        const response = await axios.get(`${API_URL}/getUpdates`, {
            params: {
                offset: lastUpdateId + 1,
                timeout: 30
            }
        });

        if (response.data.ok && response.data.result.length > 0) {
            for (const update of response.data.result) {
                lastUpdateId = update.update_id;

                if (update.message) {
                    const { chat, text, from, message_id } = update.message;
                    
                    if (text === '/start') {
                        await handleStart(chat.id, message_id, from.id, from.username, from.first_name);
                    } else if (update.message.reply_to_message && update.message.reply_to_message.text === 'لطفاً بازخورد خود درباره این ربات را وارد کنید:') {
                        await processFeedback(chat.id, from.id, from.username, from.first_name, text, message_id);
                    }
                } else if (update.callback_query) {
                    await handleCallbackQuery(update.callback_query);
                }
            }
        }
    } catch (error) {
        console.error('Error in getUpdates:', error.message);
    } finally {
        setTimeout(getUpdates, POLLING_INTERVAL);
    }
}

// Start the bot
console.log('ربات بازخورد در حال اجراست...');
getUpdates();
