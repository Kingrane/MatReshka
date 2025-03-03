document.addEventListener('DOMContentLoaded', function() {
    // DOM Elements
    const tabs = document.querySelectorAll('.tab-btn');
    const tabPanes = document.querySelectorAll('.tab-pane');
    const uploadArea = document.getElementById('upload-area');
    const fileInput = document.getElementById('file-input');
    const previewContainer = document.querySelector('.image-preview-container');
    const previewImage = document.getElementById('preview-image');
    const removeImageBtn = document.getElementById('remove-image');
    const additionalText = document.getElementById('additional-text');
    const solveImageBtn = document.getElementById('solve-image-btn');
    const mathProblemText = document.getElementById('math-problem-text');
    const solveTextBtn = document.getElementById('solve-text-btn');
    const solutionContainer = document.getElementById('solution-container');
    const loadingIndicator = document.getElementById('loading-indicator');
    const solutionContent = document.getElementById('solution-content');
    const errorModal = document.getElementById('error-modal');
    const errorMessage = document.getElementById('error-message');
    const closeModalBtns = document.querySelectorAll('.close-modal, .close-modal-btn');
    const copySolutionBtn = document.getElementById('copy-solution');

    // Variables
    let selectedFile = null;

    // Tab switching
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            tabPanes.forEach(pane => pane.classList.remove('active'));

            tab.classList.add('active');
            const tabId = tab.dataset.tab;
            document.getElementById(tabId).classList.add('active');

            // Reset solution container when switching tabs
            solutionContainer.style.display = 'none';
        });
    });

    // File Upload Handling
    uploadArea.addEventListener('click', () => {
        fileInput.click();
    });

    fileInput.addEventListener('change', handleFileSelect);

    uploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadArea.classList.add('dragover');
    });

    uploadArea.addEventListener('dragleave', () => {
        uploadArea.classList.remove('dragover');
    });

    uploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadArea.classList.remove('dragover');

        if (e.dataTransfer.files.length) {
            fileInput.files = e.dataTransfer.files;
            handleFileSelect(e);
        }
    });

    function handleFileSelect(e) {
        const file = e.target.files[0] || e.dataTransfer.files[0];

        if (!file) return;

        // Check file type
        const fileType = file.type;
        if (!['image/jpeg', 'image/jpg', 'image/png', 'image/gif'].includes(fileType)) {
            showError('Пожалуйста, загрузите изображение в формате JPG, PNG или GIF.');
            return;
        }

        // Check file size (5MB max)
        if (file.size > 5 * 1024 * 1024) {
            showError('Размер файла превышает 5 MB. Пожалуйста, загрузите файл меньшего размера.');
            return;
        }

        selectedFile = file;
        const reader = new FileReader();

        reader.onload = function(e) {
            previewImage.src = e.target.result;
            uploadArea.style.display = 'none';
            previewContainer.style.display = 'block';
            solveImageBtn.disabled = false;
        };

        reader.readAsDataURL(file);
    }

    // Remove uploaded image
    removeImageBtn.addEventListener('click', () => {
        previewContainer.style.display = 'none';
        uploadArea.style.display = 'block';
        fileInput.value = '';
        selectedFile = null;
        solveImageBtn.disabled = true;
    });

    // Text input validation
    mathProblemText.addEventListener('input', () => {
        solveTextBtn.disabled = mathProblemText.value.trim() === '';
    });

    // Solve with image
    solveImageBtn.addEventListener('click', () => {
        if (!selectedFile) return;

        // Show loading and solution container
        solutionContainer.style.display = 'block';
        solutionContent.style.display = 'none';
        loadingIndicator.style.display = 'flex';

        // Create form data
        const formData = new FormData();
        formData.append('file', selectedFile);

        const additionalPrompt = additionalText.value.trim();
        if (additionalPrompt) {
            formData.append('message', additionalPrompt);
        }

        // Send request
        fetch('/solve', {
            method: 'POST',
            body: formData
        })
        .then(response => response.json())
        .then(data => {
            loadingIndicator.style.display = 'none';
            solutionContent.style.display = 'block';

            if (data.error) {
                showError(data.error);
                solutionContainer.style.display = 'none';
                return;
            }

            // Format and display solution
            solutionContent.innerHTML = formatSolution(data.solution);

            // Перезапускаем MathJax для обработки новых формул
            if (window.MathJax) {
                MathJax.typesetPromise([solutionContent]).catch(function (err) {
                    console.error('MathJax error:', err);
                });
            }

            // Scroll to solution
            solutionContainer.scrollIntoView({ behavior: 'smooth' });
        })
        .catch(error => {
            loadingIndicator.style.display = 'none';
            solutionContainer.style.display = 'none';
            showError('Произошла ошибка при обработке запроса. Пожалуйста, попробуйте еще раз.');
            console.error('Error:', error);
        });
    });

    // Solve with text
    solveTextBtn.addEventListener('click', () => {
        const problemText = mathProblemText.value.trim();
        if (!problemText) return;

        // Show loading and solution container
        solutionContainer.style.display = 'block';
        solutionContent.style.display = 'none';
        loadingIndicator.style.display = 'flex';

        // Send request
        fetch('/solve_text', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ message: problemText })
        })
        .then(response => response.json())
        .then(data => {
            loadingIndicator.style.display = 'none';
            solutionContent.style.display = 'block';

            if (data.error) {
                showError(data.error);
                solutionContainer.style.display = 'none';
                return;
            }

            // Format and display solution
            solutionContent.innerHTML = formatSolution(data.solution);

            // Перезапускаем MathJax для обработки новых формул
            if (window.MathJax) {
                MathJax.typesetPromise([solutionContent]).catch(function (err) {
                    console.error('MathJax error:', err);
                });
            }

            // Scroll to solution
            solutionContainer.scrollIntoView({ behavior: 'smooth' });
        })
        .catch(error => {
            loadingIndicator.style.display = 'none';
            solutionContainer.style.display = 'none';
            showError('Произошла ошибка при обработке запроса. Пожалуйста, попробуйте еще раз.');
            console.error('Error:', error);
        });
    });

    // Copy solution to clipboard
    copySolutionBtn.addEventListener('click', () => {
        const solutionText = solutionContent.innerText;

        navigator.clipboard.writeText(solutionText)
            .then(() => {
                // Show temporary success indicator
                const originalIcon = copySolutionBtn.innerHTML;
                copySolutionBtn.innerHTML = '<i class="fas fa-check"></i>';
                copySolutionBtn.style.color = '#28a745';

                setTimeout(() => {
                    copySolutionBtn.innerHTML = originalIcon;
                    copySolutionBtn.style.color = '';
                }, 2000);
            })
            .catch(err => {
                showError('Не удалось скопировать текст. Пожалуйста, выделите текст вручную и скопируйте его.');
                console.error('Error copying text: ', err);
            });
    });

    // Error modal handling
    function showError(message) {
        errorMessage.textContent = message;
        errorModal.style.display = 'block';
    }

    closeModalBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            errorModal.style.display = 'none';
        });
    });

    // Close modal when clicking outside of it
    window.addEventListener('click', (e) => {
        if (e.target === errorModal) {
            errorModal.style.display = 'none';
        }
    });

    // Format solution with markdown-like syntax and LaTeX
    function formatSolution(text) {
        // Преобразование LaTeX блоков
        text = text.replace(/\\\[([\s\S]*?)\\\]/g, '<div class="math-display">\\[$1\\]</div>');
        text = text.replace(/\\\(([\s\S]*?)\\\)/g, '<span class="math-inline">\\($1\\)</span>');

        // Сохраняем LaTeX выражения между $$ ... $$
        const mathExpressions = [];
        text = text.replace(/\$\$([\s\S]*?)\$\$/g, function(match, p1) {
            mathExpressions.push(p1);
            return `MATH_EXPR_${mathExpressions.length - 1}`;
        });

        // Конвертируем обычный текст
        text = text.replace(/\n/g, '<br>');
        text = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        text = text.replace(/\*(.*?)\*/g, '<em>$1</em>');
        text = text.replace(/```([\s\S]*?)```/g, '<pre>$1</pre>');
        text = text.replace(/`(.*?)`/g, '<code>$1</code>');

        // Возвращаем LaTeX выражения
        text = text.replace(/MATH_EXPR_(\d+)/g, function(match, p1) {
            return `$$${mathExpressions[parseInt(p1)]}$$`;
        });

        return text;
    }
});