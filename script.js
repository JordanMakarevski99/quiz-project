'use strict';


const body = document.body;
const appContainer = document.querySelector('.app-container');
const darkModeToggle = document.getElementById('dark-mode-toggle');
const darkModeIcon = darkModeToggle.querySelector('i');

const startScreen = document.getElementById('start-screen');
const quizScreen = document.getElementById('quiz-screen');
const resultsScreen = document.getElementById('results-screen');

const startButton = document.getElementById('start-button');
const retryButton = document.getElementById('retry-button');
const nextButton = document.getElementById('next-button');

const questionTextEl = document.getElementById('question-text');
const answerOptionsEl = document.getElementById('answer-options');
const feedbackEl = document.getElementById('feedback');

const progressBar = document.getElementById('progress-bar');
const progressBarContainer = document.querySelector('.progress-container');
const timerEl = document.getElementById('timer');

const finalScoreEl = document.getElementById('final-score');
const totalQuestionsResultsEl = document.getElementById('total-questions-results');
const bestScoreStartEl = document.getElementById('best-score-start');
const bestScoreEndEl = document.getElementById('best-score-end');
const timePerQuestionDisplay = document.getElementById('time-per-question-display');
const apiErrorEl = document.getElementById('api-error');

const correctQuestionsListEl = document.getElementById('correct-questions-list');
const incorrectQuestionsListEl = document.getElementById('incorrect-questions-list');
const correctCountSpan = document.getElementById('correct-count');
const incorrectCountSpan = document.getElementById('incorrect-count');

const categorySelectEl = document.getElementById('category-select');
const categoryErrorEl = document.getElementById('category-error');
const totalQuestionsDisplay = document.getElementById('total-questions-display');
const CATEGORY_API_URL = 'https://opentdb.com/api_category.php';



let currentQuestionIndex = 0;
let score = 0;
let questions = [];
let timerInterval;
let timeLeft = 15;
const TIME_PER_QUESTION = 15;
const TOTAL_QUESTIONS = 10;
const BASE_API_URL = `https://opentdb.com/api.php?amount=${TOTAL_QUESTIONS}&type=multiple&encode=url3986`;

let bestScore = localStorage.getItem('quizBestScore') || 0;
let isDarkMode = localStorage.getItem('quizDarkMode') === 'true';
let hintTimeout;
let hintShownThisQuestion = false;
let quizResults = [];

const HINT_DELAY = 7000;

const API_URL = `https://opentdb.com/api.php?amount=${TOTAL_QUESTIONS}&type=multiple&encode=url3986`;



async function fetchCategories() {
    categorySelectEl.disabled = true;
    categoryErrorEl.style.display = 'none';
    try {
        const response = await fetch(CATEGORY_API_URL);
        if (!response.ok) {
            throw new Error(`Network response was not ok (Status: ${response.status})`);
        }
        const data = await response.json();
        if (!data.trivia_categories || data.trivia_categories.length === 0) {
             throw new Error("No categories found in API response.");
        }
        populateCategoryDropdown(data.trivia_categories);

    } catch (error) {
        console.error("Failed to fetch categories:", error);
        categoryErrorEl.textContent = `Error loading categories: ${error.message}. Please try again later.`;
        categoryErrorEl.style.display = 'block';

        startButton.textContent = 'Error Loading Categories';
        startButton.disabled = true;
    } finally {
         categorySelectEl.disabled = false;
    }
}
function populateCategoryDropdown(categories) {
    categorySelectEl.innerHTML = '';


    const defaultOption = document.createElement('option');
    defaultOption.value = '';
    defaultOption.textContent = 'Any Category';
    categorySelectEl.appendChild(defaultOption);


    categories.sort((a, b) => a.name.localeCompare(b.name));


    categories.forEach(category => {
        const option = document.createElement('option');
        option.value = category.id;
        option.textContent = category.name;
        categorySelectEl.appendChild(option);
    });


    startButton.disabled = false;
    startButton.textContent = 'Start Quiz';
}



function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}


function showScreen(screenToShow) {
    [startScreen, quizScreen, resultsScreen].forEach(screen => {
        screen.classList.remove('active');
    });
    screenToShow.classList.add('active');
}


function applyDarkMode(state) {
    isDarkMode = state;
    body.classList.toggle('dark-mode', isDarkMode);
    darkModeIcon.className = isDarkMode ? 'fas fa-sun' : 'fas fa-moon';
    localStorage.setItem('quizDarkMode', isDarkMode);
}

function toggleDarkMode() {
    applyDarkMode(!isDarkMode);
}


function updateBestScore() {
    if (score > bestScore) {
        bestScore = score;
        localStorage.setItem('quizBestScore', bestScore);
    }
    bestScoreStartEl.textContent = bestScore;
    bestScoreEndEl.textContent = bestScore;
}


function startTimer() {
    timeLeft = TIME_PER_QUESTION;
    timerEl.textContent = timeLeft;
    timerEl.classList.remove('warning');
    hintShownThisQuestion = false;
    clearTimeout(hintTimeout);
    clearInterval(timerInterval);

    timerInterval = setInterval(() => {
        timeLeft--;
        timerEl.textContent = timeLeft;

        if (timeLeft <= 5 && timeLeft > 0) {
            timerEl.classList.add('warning');
        } else {
             timerEl.classList.remove('warning');
        }

        if (timeLeft <= 0) {
            clearInterval(timerInterval);
            clearTimeout(hintTimeout);
            timerEl.classList.remove('warning');
            handleTimeout();
        }
    }, 1000);


    hintTimeout = setTimeout(() => {
        const options = Array.from(answerOptionsEl.children);

        const isAnswered = options.some(btn => btn.disabled || btn.classList.contains('correct') || btn.classList.contains('incorrect'));
        if (!isAnswered) {
             showHint();
        }
    }, HINT_DELAY);
}

function showHint() {
    if (hintShownThisQuestion) return;

    const currentQ = questions[currentQuestionIndex];
    const correctAnswer = currentQ.correct_answer;
    const incorrectOptions = Array.from(answerOptionsEl.children).filter(
        button => button.textContent !== correctAnswer && !button.disabled && !button.classList.contains('option-hint-removed')
    );

    if (incorrectOptions.length > 1) {
        const randomIndex = Math.floor(Math.random() * incorrectOptions.length);
        const buttonToRemove = incorrectOptions[randomIndex];
        buttonToRemove.classList.add('option-hint-removed');
        hintShownThisQuestion = true;


        feedbackEl.textContent = "Hint: One incorrect option faded.";
        feedbackEl.className = 'feedback hint-message';
        feedbackEl.style.display = 'block';

        setTimeout(() => {
             if (feedbackEl.classList.contains('hint-message')) {
                feedbackEl.textContent = '';
                feedbackEl.style.display = 'none';
                feedbackEl.className = 'feedback';
             }
        }, 2000);
    }
}

function handleTimeout() {

    recordResult('TIMEOUT', false);


    const correctAnswer = questions[currentQuestionIndex].correct_answer;
    feedbackEl.textContent = `Time's up! The correct answer was: ${correctAnswer}`;
    feedbackEl.className = 'feedback incorrect';
    feedbackEl.style.display = 'block';


    disableOptions();

    highlightCorrectAnswer(correctAnswer);
    nextButton.classList.remove('hidden');
}



function updateProgressBar() {
    if (questions.length > 0) {
        const progress = ((currentQuestionIndex + 1) / questions.length) * 100;
        progressBar.style.width = `${progress}%`;
        progressBarContainer.setAttribute('aria-valuenow', progress.toFixed(0));
    } else {

        progressBar.style.width = `0%`;
        progressBarContainer.setAttribute('aria-valuenow', '0');
    }
}


function displayQuestion() {
    if (currentQuestionIndex >= questions.length) {
        showResults();
        return;
    }


    clearInterval(timerInterval);
    clearTimeout(hintTimeout);
    hintShownThisQuestion = false;
    feedbackEl.textContent = '';
    feedbackEl.style.display = 'none';
    feedbackEl.className = 'feedback';
    nextButton.classList.add('hidden');
    timerEl.classList.remove('warning');


    const currentQ = questions[currentQuestionIndex];
    questionTextEl.textContent = currentQ.question;
    answerOptionsEl.innerHTML = '';

    const options = shuffleArray([...currentQ.incorrect_answers, currentQ.correct_answer]);

    options.forEach(optionText => {
        const button = document.createElement('button');
        button.textContent = optionText;
        button.classList.add('option');
        button.addEventListener('click', () => selectAnswer(button, currentQ.correct_answer));
        answerOptionsEl.appendChild(button);
    });

    updateProgressBar();
    startTimer();
}

function disableOptions() {
    Array.from(answerOptionsEl.children).forEach(button => {
        button.disabled = true;
    });
}

function highlightCorrectAnswer(correctAnswer) {
     Array.from(answerOptionsEl.children).forEach(button => {
        if (button.textContent === correctAnswer) {
            button.classList.add('correct');
            button.classList.remove('option-hint-removed');
        }
    });
}

function selectAnswer(selectedButton, correctAnswer) {
    clearInterval(timerInterval);
    clearTimeout(hintTimeout);
    disableOptions();

    const userAnswer = selectedButton.textContent;
    const isCorrect = userAnswer === correctAnswer;

    recordResult(userAnswer, isCorrect);

    if (isCorrect) {
        score++;
        selectedButton.classList.add('correct');
        feedbackEl.textContent = "Correct!";
        feedbackEl.className = 'feedback correct';
    } else {
        selectedButton.classList.add('incorrect');
        feedbackEl.textContent = `Incorrect! The answer was: ${correctAnswer}`;
        feedbackEl.className = 'feedback incorrect';
        highlightCorrectAnswer(correctAnswer);
    }
    timerEl.classList.remove('warning');
    feedbackEl.style.display = 'block';
    nextButton.classList.remove('hidden');
}

function recordResult(userAnswer, isCorrect) {
     quizResults.push({
        questionText: questions[currentQuestionIndex].question,
        userAnswer: userAnswer,
        correctAnswer: questions[currentQuestionIndex].correct_answer,
        isCorrect: isCorrect
    });
}

function nextQuestion() {
    currentQuestionIndex++;
    if (currentQuestionIndex < questions.length) {
        displayQuestion();
    } else {
        showResults();
    }
}


async function fetchQuestions() {
    startButton.disabled = true;
    startButton.textContent = 'Loading Questions...';
    apiErrorEl.style.display = 'none';


    const selectedCategoryId = categorySelectEl.value;
    let currentApiUrl = BASE_API_URL;


    if (selectedCategoryId) {
        currentApiUrl += `&category=${selectedCategoryId}`;
    }

    try {
        const response = await fetch(currentApiUrl);
        if (!response.ok) {
            throw new Error(`Network response was not ok (Status: ${response.status})`);
        }
        const data = await response.json();


        if (data.response_code !== 0) {
            let errorMsg = `API Error: Could not fetch questions (Code ${data.response_code}).`;
            if (data.response_code === 1) {
                errorMsg = `Not enough questions found for the selected topic. Try 'Any Category' or choose another.`;
            } else if (data.response_code === 2) {
                errorMsg = `Invalid parameter in request. Check category ID.`;
            }
            throw new Error(errorMsg);
        }


        questions = data.results.map(q => ({
            question: decodeURIComponent(q.question),
            correct_answer: decodeURIComponent(q.correct_answer),
            incorrect_answers: q.incorrect_answers.map(decodeURIComponent)
        }));

        if (questions.length === 0) {
            throw new Error("API returned 0 questions for this topic.");
        }

        startQuiz();

    } catch (error) {
        console.error("Failed to fetch questions:", error);
        apiErrorEl.textContent = `Error: ${error.message}`;
        apiErrorEl.style.display = 'block';

        startButton.disabled = false;
        startButton.textContent = 'Start Quiz';
    }
}

function startQuiz() {
    score = 0;
    currentQuestionIndex = 0;
    quizResults = [];
    progressBar.style.width = '0%';
    progressBarContainer.setAttribute('aria-valuenow', '0');
    showScreen(quizScreen);
    displayQuestion();
}

function showResults() {
    finalScoreEl.textContent = score;
    totalQuestionsResultsEl.textContent = questions.length;
    updateBestScore();


    correctQuestionsListEl.innerHTML = '';
    incorrectQuestionsListEl.innerHTML = '';
    let correctCount = 0;
    let incorrectCount = 0;

    quizResults.forEach(result => {
        const li = document.createElement('li');
        li.innerHTML = `<span class="q-text">Q: ${result.questionText}</span>`;

        if (result.isCorrect) {
            li.innerHTML += `<br><span class="answer-detail correct-detail"><strong>Your Answer:</strong> ${result.userAnswer}</span>`;
            correctQuestionsListEl.appendChild(li);
            correctCount++;
        } else {
            let details = `<strong>Correct:</strong> ${result.correctAnswer}`;
            if (result.userAnswer === 'TIMEOUT') {
                details += ` | <strong class="user-answer-label">Your Answer:</strong> (Time ran out)`;
            } else {
                details += ` | <strong class="user-answer-label">Your Answer:</strong> <span class="user-answer-text">${result.userAnswer}</span>`;
            }
            li.innerHTML += `<br><span class="answer-detail incorrect-detail">${details}</span>`;
            incorrectQuestionsListEl.appendChild(li);
            incorrectCount++;
        }
    });


    correctCountSpan.textContent = correctCount;
    incorrectCountSpan.textContent = incorrectCount;


    showScreen(resultsScreen);
}


function retryQuiz() {

    startButton.disabled = false;
    startButton.textContent = 'Start Quiz';
    clearInterval(timerInterval);
    clearTimeout(hintTimeout);
    showScreen(startScreen);

}


function initApp() {
    applyDarkMode(isDarkMode);
    bestScoreStartEl.textContent = bestScore;
    timePerQuestionDisplay.textContent = TIME_PER_QUESTION;
    totalQuestionsDisplay.textContent = TOTAL_QUESTIONS;


    fetchCategories();


    darkModeToggle.addEventListener('click', toggleDarkMode);
    startButton.addEventListener('click', fetchQuestions);
    nextButton.addEventListener('click', nextQuestion);
    retryButton.addEventListener('click', retryQuiz);

    showScreen(startScreen);
}


document.addEventListener('DOMContentLoaded', initApp);