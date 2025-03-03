from flask import Flask, request, render_template, jsonify
from mistralai import Mistral
import base64
import os
import logging
from dotenv import load_dotenv
from werkzeug.utils import secure_filename

# Загрузка переменных окружения
load_dotenv()

# Настройка логирования
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
app.secret_key = os.getenv("SECRET_KEY", "default_secret_key_for_development")

# Получение API ключа из переменных окружения (или используем предоставленный)
MISTRAL_API_KEY = os.getenv("MISTRAL_API_KEY", "cnYW87vD671nFClyTHkFEVOFYSz4FE3m")

# Системный промпт для Mistral
SYSTEM_PROMPT = """
Ты — математический помощник для решения задач. 
Твоя задача — внимательно проанализировать математическую задачу на изображении или в тексте,
шаг за шагом решить её, и предоставить подробное объяснение решения.
Обязательно укажи все промежуточные шаги и окончательный ответ.

Используй LaTeX для всех математических выражений, заключая формулы в двойные доллары: $$...$$
Для отображения на отдельной строке используй \\[ ... \\]
Для встроенных в текст формул используй \\( ... \\)

Примеры:
1. "Упростим дробь $$\\frac{a^2 + 2ab + b^2}{a + b} = \\frac{(a+b)^2}{a+b} = a + b$$"
2. "\\[ P = \\frac{1}{4} + \\frac{1}{2} + 1 = \\frac{1}{4} + \\frac{2}{4} + \\frac{4}{4} = \\frac{7}{4} \\]"

Поддерживай решение задач по алгебре, геометрии, тригонометрии, математическому анализу и статистике.
Если изображение не содержит математическую задачу, сообщи об этом.
Четко и структурированно отвечай на русском языке.
"""

# Настройки для изображений
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif'}
MAX_CONTENT_LENGTH = 5 * 1024 * 1024  # 5 MB

# Инициализация клиента Mistral
MODEL = "pixtral-12b-2409"


def get_mistral_client():
    """Функция для получения клиента Mistral"""
    try:
        return Mistral(api_key=MISTRAL_API_KEY)
    except Exception as e:
        logger.error(f"Ошибка при инициализации клиента Mistral: {e}")
        return None


def allowed_file(filename):
    """Проверка, что файл имеет разрешенное расширение"""
    return '.' in filename and \
        filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


@app.route('/')
def index():
    """Главная страница"""
    return render_template('index.html')


@app.route('/solve', methods=['POST'])
def solve():
    """Обработка изображения с математической задачей"""
    # Проверяем наличие файла
    if 'file' not in request.files:
        return jsonify({"error": "Файл не найден"}), 400

    file = request.files['file']

    # Проверяем, что файл выбран
    if file.filename == '':
        return jsonify({"error": "Файл не выбран"}), 400

    # Проверяем расширение файла
    if not allowed_file(file.filename):
        return jsonify({"error": f"Допустимые форматы файлов: {', '.join(ALLOWED_EXTENSIONS)}"}), 400

    try:
        # Считываем файл и кодируем в base64
        file_content = file.read()

        # Проверка размера файла
        if len(file_content) > MAX_CONTENT_LENGTH:
            return jsonify({
                               "error": f"Размер файла превышает максимально допустимый ({MAX_CONTENT_LENGTH // (1024 * 1024)} MB)"}), 400

        base64_image = base64.b64encode(file_content).decode('utf-8')
        data_url = f"data:{file.content_type};base64,{base64_image}"

        # Получаем текст запроса или используем значение по умолчанию
        prompt_text = request.form.get('message',
                                       "Пожалуйста, реши математическую задачу на этом изображении и объясни решение шаг за шагом.")

        # Создаем мультимодальный запрос к Pixtral
        client = get_mistral_client()
        if not client:
            return jsonify({"error": "Не удалось подключиться к API Mistral"}), 500

        try:
            logger.info("Отправка запроса к Mistral API")
            chat_response = client.chat.complete(
                model=MODEL,
                messages=[
                    {
                        "role": "system",
                        "content": SYSTEM_PROMPT,
                    },
                    {
                        "role": "user",
                        "content": [
                            {"type": "text", "text": prompt_text},
                            {"type": "image_url", "image_url": {"url": data_url}}
                        ]
                    },
                ]
            )
            solution = chat_response.choices[0].message.content
            logger.info("Получен ответ от Mistral API")

            return jsonify({
                "success": True,
                "message": "Задача обработана успешно",
                "solution": solution
            })
        except Exception as e:
            logger.error(f"Неизвестная ошибка: {e}")
            return jsonify({"error": "Произошла ошибка при обработке запроса"}), 500
    except Exception as e:
        logger.error(f"Ошибка при обработке файла: {e}")
        return jsonify({"error": "Ошибка при обработке файла"}), 500


@app.route('/solve_text', methods=['POST'])
def solve_text():
    """Обработка текстовой математической задачи"""
    data = request.get_json()
    if not data or 'message' not in data:
        return jsonify({"error": "Текст задачи не предоставлен"}), 400

    problem_text = data['message']
    if not problem_text.strip():
        return jsonify({"error": "Текст задачи не может быть пустым"}), 400

    client = get_mistral_client()
    if not client:
        return jsonify({"error": "Не удалось подключиться к API Mistral"}), 500

    try:
        logger.info("Отправка текстового запроса к Mistral API")
        chat_response = client.chat.complete(
            model=MODEL,
            messages=[
                {
                    "role": "system",
                    "content": SYSTEM_PROMPT,
                },
                {
                    "role": "user",
                    "content": problem_text
                },
            ]
        )

        solution = chat_response.choices[0].message.content
        logger.info("Получен ответ от Mistral API")

        return jsonify({
            "success": True,
            "solution": solution
        })
    except Exception as e:
        logger.error(f"Неизвестная ошибка: {e}")
        return jsonify({"error": "Произошла ошибка при обработке запроса"}), 500


@app.errorhandler(413)
def request_entity_too_large(error):
    return jsonify(
        {"error": f"Размер файла превышает максимально допустимый ({MAX_CONTENT_LENGTH // (1024 * 1024)} MB)"}), 413


if __name__ == '__main__':
    app.config['MAX_CONTENT_LENGTH'] = MAX_CONTENT_LENGTH
    app.run(debug=True)