const axios = require('axios');
const jalaali = require('jalaali-js'); // Library for Persian date

// Main bot configuration
const BOT_TOKEN = '300397267:ISqcdyhrCIOaB5q272FNocKXF8jUa3rniop6Jz9V';
const API_URL = `https://tapi.bale.ai/bot{TOKEN}`;

// Whitelist of authorized users
const WHITELIST = [
  'username1', // First username without @
  'username2', // Second username without @
  // Add more usernames as needed
];

// User state management
const userStates = {};

// Check if user is whitelisted
function isWhitelisted(message) {
  if (!message || !message.from || !message.from.username) return false;
  return WHITELIST.includes(message.from.username.toLowerCase());
}

// Convert date to Persian format
function getPersianDateTime() {
  const now = new Date();
  const jalali = jalaali.toJalaali(now);
  
  const year = jalali.jy;
  const month = jalali.jm;
  const day = jalali.jd;
  
  const hour = now.getHours().toString().padStart(2, '0');
  const minute = now.getMinutes().toString().padStart(2, '0');
  
  const persianMonths = [
    'فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور',
    'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'
  ];
  
  return `${day} ${persianMonths[month-1]} ${year} | ${hour}:${minute}`;
}

// Start polling for updates
async function startPolling(offset = 0) {
  try {
    // Get updates with long polling
    const response = await axios.get(`${API_URL}/getUpdates`, {
      params: {
        offset,
        timeout: 30, // Long polling timeout in seconds
      }
    });

    const updates = response.data.result;
    
    if (updates && updates.length > 0) {
      // Process each update
      for (const update of updates) {
        await processUpdate(update);
        offset = update.update_id + 1;
      }
    }
    
    // Continue polling
    setTimeout(() => startPolling(offset), 100); // Minimal delay for near-instant responses
  } catch (error) {
    console.error('Polling error:', error.message);
    setTimeout(() => startPolling(offset), 3000); // Retry after 3 seconds on error
  }
}

// Send message using Telegram API
async function sendMessage(chatId, text, options = {}) {
  try {
    const response = await axios.post(`${API_URL}/sendMessage`, {
      chat_id: chatId,
      text: text,
      parse_mode: 'HTML',
      ...options
    });
    return response.data;
  } catch (error) {
    console.error('Error sending message:', error.response?.data || error.message);
    return null;
  }
}

// Handle the panel command
async function handlePanelCommand(chatId) {
  const keyboard = {
    inline_keyboard: [
      [{ text: '🔴 گزارش رید', callback_data: 'raid_report' }]
      // Add more buttons as needed
    ]
  };
  
  await sendMessage(
    chatId,
    '<b>🌟 سلام کاربر گرامی</b>\n\n' +
    'به پنل مدیریت خوش آمدید. لطفاً یکی از گزینه‌های زیر را انتخاب کنید:',
    { reply_markup: JSON.stringify(keyboard) }
  );
}

// Handle raid report callback
async function handleRaidReport(chatId, messageId) {
  await sendMessage(
    chatId,
    '<b>🔴 گزارش رید</b>\n\n' +
    'لطفاً لینک کانال مورد نظر برای گزارش را ارسال کنید:',
    { reply_markup: JSON.stringify({ force_reply: true }) }
  );
  
  // Store state for this user
  userStates[chatId] = { 
    step: 'waiting_channel_link',
    report: {}
  };
}

// Process incoming update
async function processUpdate(update) {
  try {
    // Handle callback queries (inline keyboard buttons)
    if (update.callback_query) {
      const callbackQuery = update.callback_query;
      const chatId = callbackQuery.message.chat.id;
      const messageId = callbackQuery.message.message_id;
      const data = callbackQuery.data;
      
      if (!isWhitelisted(chatId)) return;
      
      if (data === 'raid_report') {
        await handleRaidReport(chatId, messageId);
      }
      
      // Answer callback query to remove loading state
      await axios.post(`${API_URL}/answerCallbackQuery`, {
        callback_query_id: callbackQuery.id
      });
      
      return;
    }
    
    // Handle messages
    if (update.message) {
      const message = update.message;
      const chatId = message.chat.id;
      const text = message.text;
      
      // Check if user is whitelisted
      if (!isWhitelisted(chatId)) return;
      
      // Handle commands
      if (text === 'پنل') {
        await handlePanelCommand(chatId);
        return;
      }
      
      // Handle conversation flow based on user state
      if (userStates[chatId]) {
        const state = userStates[chatId];
        
        if (state.step === 'waiting_channel_link') {
          state.report.channelLink = text;
          state.step = 'waiting_reason';
          
          await sendMessage(
            chatId,
            '<b>🔴 گزارش رید</b>\n\n' +
            'لینک کانال ثبت شد. لطفاً دلیل گزارش را بنویسید:',
            { reply_markup: JSON.stringify({ force_reply: true }) }
          );
          return;
        }
        
        if (state.step === 'waiting_reason') {
          state.report.reason = text;
          
          // Get current Persian date and time
          const dateTime = getPersianDateTime();
          
          // Format and send the final report
          const reportMessage = 
            '<b>🔴 گزارش رید</b>\n\n' +
            `<b>📌 کانال:</b> ${state.report.channelLink}\n` +
            `<b>📝 دلیل:</b> ${state.report.reason}\n` +
            `<b>🕒 زمان ثبت:</b> ${dateTime}`;
          
          await sendMessage(chatId, reportMessage);
          
          // Clear user state
          delete userStates[chatId];
          return;
        }
      }
    }
  } catch (error) {
    console.error('Error processing update:', error);
  }
}

// Start the bot
console.log('Bot is starting...');
startPolling();
console.log('Bot is running with polling...');
