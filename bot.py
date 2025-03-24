import requests
from datetime import datetime
from persiantools.jdatetime import JalaliDateTime
from persiantools import digits

# Configuration
BOT_TOKEN = "1355028807:h4DAqn1oPtnjpnLVyFaqIXISgjNrJH3l497fBs9w"
ADMIN_IDS = [844843541, 1085839779]  # Replace with your admin IDs
BASE_URL = f"https://tapi.bale.ai/bot{BOT_TOKEN}"
USER_FEEDBACKS = {}  # {user_id: last_feedback_date}

def get_persian_date():
    now = JalaliDateTime.now()
    persian_date = now.strftime("%Y/%m/%d")
    persian_time = now.strftime("%H:%M")
    return digits.en_to_fa(persian_date), digits.en_to_fa(persian_time)

def send_message(chat_id, text, reply_markup=None):
    url = f"{BASE_URL}/sendMessage"
    payload = {
        "chat_id": chat_id,
        "text": text,
        "parse_mode": "HTML",
        "reply_markup": reply_markup
    }
    requests.post(url, json=payload)

def edit_message(chat_id, message_id, text, reply_markup=None):
    url = f"{BASE_URL}/editMessageText"
    payload = {
        "chat_id": chat_id,
        "message_id": message_id,
        "text": text,
        "parse_mode": "HTML",
        "reply_markup": reply_markup
    }
    requests.post(url, json=payload)

def send_feedback_to_admin(user, feedback_text, message_id):
    for admin_id in ADMIN_IDS:
        text = f"""
📬 <b>فیدبک جدید دریافت شد!</b>

📝 <b>متن فیدبک:</b>
<code>{feedback_text}</code>

👤 <b>اطلاعات کاربر:</b>
• نام: {user.get('first_name', 'نامشخص')}
• نام کاربری: @{user.get('username', 'نامشخص')}
• آیدی عددی: <code>{user.get('id')}</code>
        """
        
        keyboard = {
            "inline_keyboard": [
                [{"text": "↪️ ارسال فیدبک", "callback_data": f"forward_{message_id}_{user.get('id')}"}]
            ]
        }
        
        send_message(admin_id, text, keyboard)

def handle_start(chat_id, user):
    date, time = get_persian_date()
    
    greeting = f"""
✨ <b>سلام {user.get('first_name', 'کاربر')} عزیز!</b>

🕰 <b>تاریخ:</b> {date}
⏰ <b>ساعت:</b> {time}

لطفاً یک ربات را برای ارسال فیدبک انتخاب کنید:
    """
    
    keyboard = {
        "inline_keyboard": [
            [{"text": "ربات آپلود | uploadd_bot•", "callback_data": "select_uploader"}]
        ]
    }
    
    send_message(chat_id, greeting, keyboard)

def handle_uploader_info(chat_id, message_id):
    info = """
<b>🔍 اطلاعات ربات:</b>

<b>• نام:</b> <code>آپــلــودر | 𝙪𝙥𝙡𝙤𝙖𝙙𝙚𝙧</code>
<b>• آیدی:</b> @uploadd_bot
<b>• هدف:</b> آپلود و مدیریت فایل‌ها به روشی آسان و مدرن!
    """
    
    keyboard = {
        "inline_keyboard": [
            [{"text": "📝 ارسال فیدبک", "callback_data": "send_feedback"}],
            [{"text": "🔙 بازگشت", "callback_data": "back_to_start"}]
        ]
    }
    
    edit_message(chat_id, message_id, info, keyboard)

def handle_feedback_request(chat_id, message_id):
    text = "✍️ لطفاً نظر خود را درباره این ربات وارد کنید:"
    
    keyboard = {
        "inline_keyboard": [
            [{"text": "🔙 بازگشت", "callback_data": "back_to_uploader"}]
        ]
    }
    
    edit_message(chat_id, message_id, text, keyboard)

def process_updates():
    offset = 0
    while True:
        url = f"{BASE_URL}/getUpdates?offset={offset}&timeout=30"
        response = requests.get(url).json()
        
        if not response.get("ok"):
            continue
            
        for update in response.get("result", []):
            offset = update["update_id"] + 1
            
            if "message" in update:
                message = update["message"]
                chat_id = message["chat"]["id"]
                user = message["from"]
                
                if "text" in message:
                    if message["text"].startswith("/start"):
                        handle_start(chat_id, user)
                    elif USER_FEEDBACKS.get(chat_id) == "awaiting_feedback":
                        date = datetime.now().date()
                        if USER_FEEDBACKS.get(user["id"], datetime.min) < date:
                            USER_FEEDBACKS[user["id"]] = date
                            send_feedback_to_admin(user, message["text"], message["message_id"])
                            send_message(chat_id, "✅ فیدبک شما با موفقیت ثبت شد!")
                            USER_FEEDBACKS[chat_id] = None
                        else:
                            send_message(chat_id, "⚠️ شما امروز قبلاً فیدبک ارسال کرده‌اید!")
            
            elif "callback_query" in update:
                query = update["callback_query"]
                chat_id = query["message"]["chat"]["id"]
                message_id = query["message"]["message_id"]
                data = query["data"]
                user = query["from"]
                
                if data == "select_uploader":
                    handle_uploader_info(chat_id, message_id)
                
                elif data == "back_to_start":
                    handle_start(chat_id, user)
                
                elif data == "send_feedback":
                    USER_FEEDBACKS[chat_id] = "awaiting_feedback"
                    handle_feedback_request(chat_id, message_id)
                
                elif data == "back_to_uploader":
                    handle_uploader_info(chat_id, message_id)
                
                elif data.startswith("forward_"):
                    _, feedback_message_id, user_id = data.split("_")
                    requests.post(f"{BASE_URL}/forwardMessage", json={
                        "chat_id": chat_id,
                        "from_chat_id": user_id,
                        "message_id": feedback_message_id
                    })

if __name__ == "__main__":
    print("Bot is running...")
    process_updates()
