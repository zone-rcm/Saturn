import requests

# Replace with your bot's token
TOKEN = '1355028807:PUU8dvVl7HqnqdSaIzjYXLI5NwxpbOdrQPm7DFWS'

# Base URL for the Telegram Bot API
BASE_URL = f'https://tapi.bale.ai/bot{TOKEN}/'

# Function to get updates
def get_updates():
    url = BASE_URL + 'getUpdates'
    response = requests.get(url)
    return response.json()

# Function to send a message
def send_message(chat_id, text):
    url = BASE_URL + 'sendMessage'
    params = {'chat_id': chat_id, 'text': text}
    response = requests.get(url, params=params)
    return response.json()

# Main function to process updates
def main():
    updates = get_updates()
    
    for update in updates['result']:
        message = update['message']
        chat_id = message['chat']['id']
        text = message['text']
        
        # Check if the message is the /start command
        if text == '/start':
            send_message(chat_id, 'Hi')

if __name__ == '__main__':
    main()
