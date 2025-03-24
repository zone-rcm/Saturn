const axios = require('axios');
const moment = require('moment');

// Your Telegram Bot Token here
const token = '1355028807:h4DAqn1oPtnjpnLVyFaqIXISgjNrJH3l497fBs9w';
const botApiUrl = `https://tapi.bale.ai/bot${token}`;

// Special user IDs for feedback
const specialUsers = [1085839779, 844843541]; // Replace with your special user IDs
const feedbacks = {}; // To store feedbacks and manage user daily limits

// Persian numerals function
const PersianNumbers = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];

function toPersianNumber(number) {
    return number.toString().split('').map(char => PersianNumbers[parseInt(char)]).join('');
}

// Get formatted date and time in Persian
function getFormattedDate() {
    const now = moment();
    const day = toPersianNumber(now.date());
    const month = toPersianNumber(now.month() + 1); // Month is zero-indexed
    const year = toPersianNumber(now.year());
    const hours = toPersianNumber(now.hours());
    const minutes = toPersianNumber(now.minutes());
    const seconds = toPersianNumber(now.seconds());
    
    return `${day} / ${month} / ${year} - ${hours}:${minutes}:${seconds}`;
}

// Send message via Telegram Bot API
function sendMessage(chatId, text, replyMarkup = null) {
    const params = {
        chat_id: chatId,
        text: text,
        parse_mode: 'HTML',
        reply_markup: replyMarkup,
    };

    return axios.post(`${botApiUrl}/sendMessage`, params);
}

// Handle start command
async function handleStart(msg) {
    const chatId = msg.chat.id;
    const greetingText = `سلام! خوش آمدید.
    تاریخ و ساعت: ${getFormattedDate()}
    
    لطفاً رباتی که می‌خواهید بازخورد بدهید را انتخاب کنید.`;

    const replyMarkup = {
        inline_keyboard: [
            [{ text: 'ربات آپلود | uploadd_bot', callback_data: 'uploader_bot' }],
        ],
    };

    await sendMessage(chatId, greetingText, replyMarkup);
}

// Handle callback queries
async function handleCallbackQuery(query) {
    const chatId = query.message.chat.id;
    const messageId = query.message.message_id;
    
    if (query.data === 'uploader_bot') {
        const botInfoText = `نام: •آ‌پــلــودر | 𝙪𝙥𝙡𝙤𝙖𝙙𝙚𝙧•
آیدی: @uploadd_bot
هدف: آپلود و مدیریت فایل به روشی آسان و مدرن!`;

        const replyMarkup = {
            inline_keyboard: [
                [{ text: 'ارسال بازخورد', callback_data: 'send_feedback' }],
                [{ text: 'بازگشت', callback_data: 'back_to_start' }],
            ],
        };

        await axios.post(`${botApiUrl}/editMessageText`, {
            chat_id: chatId,
            message_id: messageId,
            text: botInfoText,
            parse_mode: 'HTML',
            reply_markup: replyMarkup,
        });
    }

    if (query.data === 'send_feedback') {
        const feedbackText = `لطفاً بازخورد خود را در مورد این ربات وارد کنید.`;

        const replyMarkup = {
            inline_keyboard: [
                [{ text: 'بازگشت', callback_data: 'back_to_bot_info' }],
            ],
        };

        await axios.post(`${botApiUrl}/editMessageText`, {
            chat_id: chatId,
            message_id: messageId,
            text: feedbackText,
            parse_mode: 'HTML',
            reply_markup: replyMarkup,
        });

        // Listening for feedback from user
        // For simplicity, using setTimeout to simulate message collection (this is a basic placeholder approach)
        setTimeout(() => collectFeedback(chatId, msg.from), 1000);
    }

    if (query.data === 'back_to_start') {
        await handleStart(query.message);
    }

    if (query.data === 'back_to_bot_info') {
        const botInfoText = `نام: •آ‌پــلــودر | 𝙪𝙥𝙡𝙤𝙖𝙙𝙚𝙧•
آیدی: @uploadd_bot
هدف: آپلود و مدیریت فایل به روشی آسان و مدرن`;

        const replyMarkup = {
            inline_keyboard: [
                [{ text: 'ارسال بازخورد', callback_data: 'send_feedback' }],
                [{ text: 'بازگشت', callback_data: 'back_to_start' }],
            ],
        };

        await axios.post(`${botApiUrl}/editMessageText`, {
            chat_id: chatId,
            message_id: messageId,
            text: botInfoText,
            parse_mode: 'HTML',
            reply_markup: replyMarkup,
        });
    }
}

// Collect feedback
async function collectFeedback(chatId, user) {
    // Ensure the user can only send feedback once a day
    const currentDate = moment().format('YYYY-MM-DD');
    if (!feedbacks[user.id]) {
        feedbacks[user.id] = {};
    }

    if (feedbacks[user.id][currentDate]) {
        await sendMessage(chatId, 'شما قبلاً بازخوردی ارسال کرده‌اید.');
    } else {
        // Store feedback (simulate user input)
        feedbacks[user.id][currentDate] = "This is the user's feedback"; // Replace with actual feedback collection

        // Send feedback to special users
        const feedbackMessage = `
بازخورد جدید:

از طرف: ${user.username} (${user.first_name})
متن بازخورد: This is the user's feedback
تاریخ: ${getFormattedDate()}`;

        for (const specialUserId of specialUsers) {
            await sendMessage(specialUserId, feedbackMessage);
        }

        await sendMessage(chatId, 'بازخورد شما ارسال شد!');
    }
}

// Handle updates (messages and callback queries)
function handleUpdates(update) {
    if (update.message) {
        if (update.message.text === '/start') {
            handleStart(update.message);
        }
    }

    if (update.callback_query) {
        handleCallbackQuery(update.callback_query);
    }
}

// Poll for updates (using long polling)
async function getUpdates() {
    try {
        const response = await axios.get(`${botApiUrl}/getUpdates`);
        const updates = response.data.result;

        for (const update of updates) {
            handleUpdates(update);
        }

        // Keep polling for new updates
        setTimeout(getUpdates, 1000);
    } catch (error) {
        console.error('Error fetching updates:', error);
        setTimeout(getUpdates, 5000); // Retry after 5 seconds on error
    }
}

// Start polling for updates
getUpdates();
      
