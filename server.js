const express = require('express');
const mongoose = require('mongoose');
const { usersModel, Question, Progress } = require('./db.js');
const jwt = require('jsonwebtoken');
const { authenticateJWT } = require('./auth.js');
const bcrypt = require('bcrypt');
const { z } = require('zod');
const path = require('path');
const axios = require('axios'); // Added for proxying to Flask

// Destructure env vars (undefined in Vercel if not set)
const JWT_SECRETE = process.env.JWT_SECRETE;
const mongooseClusterString = process.env.mongooseClusterString;

// Flask AI endpoint (set in env for security, fallback to hardcoded)
const FLASK_URL = process.env.FLASK_URL || 'https://chatbot-1-fsgx.onrender.com/webhook';

// Validate env vars early
if (!JWT_SECRETE || !mongooseClusterString) {
    console.error('Missing env vars: JWT_SECRETE or mongooseClusterString');
}

const app = express();

// Connect to MongoDB
mongoose.connect(mongooseClusterString)
    .then(() => console.log('Connected to MongoDB'))
    .catch(err => console.error('MongoDB connection error:', err));

// Middlewares
app.use(express.static(path.join(__dirname, '/public')));
app.use(express.json());

// Global error handler
app.use((err, req, res, next) => {
    console.error('Global error:', err);
    res.status(500).json({ error: 'Internal server error' });
});

// Signup endpoint (now under /api/)
app.post('/api/signup', async (req, res) => {
    console.log("Signup request body:", req.body);

    const validationSchema = z.object({
        fullname: z.string()
            .min(3, "Full name must be at least 3 characters"),
        email: z.string()
            .email("Invalid email format")
            .refine(email => email.endsWith('.edu'), "Email must be a school email ending with .edu"),
        password: z.string()
            .min(8, "Password must be at least 8 characters"),
        phone: z.string()
            .regex(/^\d{10}$/, "Phone number must be exactly 10 digits"),
        state: z.string()
            .min(3, "State is required"),
        username: z.string()
            .min(3, "Username must be at least 3 characters"),
        school10: z.string()
            .min(3, "10th school name must be at least 3 characters"),
        marks10: z.string()
            .regex(/^\d{1,3}(\.\d{1,2})?$/, "10th marks must be a valid percentage (e.g., 85 or 85.5)")
            .refine(val => parseFloat(val) <= 100, "10th marks cannot exceed 100%"),
        school12: z.string()
            .optional()
            .or(z.literal('')),
        stream12: z.string()
            .optional()
            .or(z.literal('')),
        marks12: z.string()
            .optional()
            .or(z.literal('')),
    });

    const parsed = validationSchema.safeParse(req.body);

    if (!parsed.success) {
        const formatted = parsed.error.issues.map(e => ({
            path: Array.isArray(e.path) ? e.path.join(".") : String(e.path || ""),
            message: e.message || "Invalid value"
        }));
        console.log("Validation failed:", formatted);
        return res.status(400).json({ errors: formatted });
    }

    const {
        fullname, email, password, phone, state,
        username, school10, marks10, school12, stream12, marks12
    } = parsed.data;

    try {
        const existingUser = await usersModel.findOne({
            $or: [{ email }, { username }]
        });
        if (existingUser) {
            return res.status(400).json({
                errors: [{
                    path: existingUser.email === email ? 'email' : 'username',
                    message: `This ${existingUser.email === email ? 'email' : 'username'} is already registered`
                }]
            });
        }

        const hashedPassword = await bcrypt.hash(password, 5);
        const marks10Num = parseFloat(marks10);
        const marks12Num = marks12 ? parseFloat(marks12) : undefined;

        await usersModel.create({
            fullname,
            email,
            password: hashedPassword,
            phone,
            state,
            username,
            school10,
            marks10: marks10Num,
            school12,
            stream12,
            marks12: marks12Num
        });

        return res.json({ message: "Successfully signed up" });
    } catch (e) {
        console.error("DB/create error:", e);
        if (e.code === 11000) {
            const field = Object.keys(e.keyValue)[0];
            return res.status(400).json({
                errors: [{
                    path: field,
                    message: `This ${field} is already registered`
                }]
            });
        }
        return res.status(500).json({ message: "Database error while signing up" });
    }
});

// Signin endpoint (now under /api/)
app.post('/api/signin', async (req, res) => {
    const { username, password } = req.body;
    console.log("Signin request:", username);

    try {
        const user = await usersModel.findOne({ username });
        if (!user) {
            return res.status(403).json({
                errors: [{ path: 'username', message: 'Invalid username' }]
            });
        }

        const match = await bcrypt.compare(password, user.password);
        if (!match) {
            return res.status(403).json({
                errors: [{ path: 'password', message: 'Invalid password' }]
            });
        }

        if (!JWT_SECRETE) {
            return res.status(500).json({ error: 'Server configuration error' });
        }

        const token = jwt.sign({ id: user._id.toString() }, JWT_SECRETE);
        return res.json({ token });
    } catch (e) {
        console.error("Signin error:", e);
        return res.status(500).json({
            errors: [{ path: 'server', message: 'An unexpected error occurred' }]
        });
    }
});

// Magnetism questions endpoint (unchanged)
app.post('/api/topic/magnetism', authenticateJWT, async (req, res) => {
    const { xp, isCorrect, brains, questionId, userAnswer } = req.body;

    try {
        // Validate input data
        const progressValidation = z.object({
            xp: z.number().optional(),
            isCorrect: z.boolean().nullable(),
            brains: z.number().optional(),
            questionId: z.string().optional().nullable(),
            userAnswer: z.string().optional().nullable()
        });

        const parsed = progressValidation.safeParse(req.body);
        if (!parsed.success) {
            const formatted = parsed.error.issues.map(e => ({
                path: e.path.join("."),
                message: e.message
            }));
            return res.status(400).json({ errors: formatted });
        }

        // Store progress if not a skip (i.e., isCorrect is not null)
        if (isCorrect !== null && questionId) {
            await Progress.create({
                userId: req.userId,
                questionId,
                xp,
                isCorrect,
                brains,
                userAnswer,
            });
        }

        // Fetch a random question
        const questions = await Question.find({ topic: 'magnetism' });
        if (!questions.length) {
            return res.status(404).json({ errors: [{ path: 'questions', message: 'No questions available' }] });
        }

        // Simple randomization (can improve with history tracking)
        const randomIndex = Math.floor(Math.random() * questions.length);
        const question = questions[randomIndex];

        // Format response to match frontend expectations
        const responseQuestion = {
            id: question.id,
            type: question.type,
            prompt: question.prompt,
            options: question.options.map(opt => ({
                value: opt.value,
                description: opt.description || '',
                imageUrl: opt.imageUrl || ''
            })),
            correctAnswer: question.correctAnswer,
            feedback: question.feedback
        };

        return res.json(responseQuestion);
    } catch (e) {
        console.error('Questions endpoint error:', e);
        return res.status(500).json({ errors: [{ path: 'server', message: 'Failed to fetch question' }] });
    }
});

// New: AI Chat endpoint (proxies to Flask webhook)
app.post('/api/chat', authenticateJWT, async (req, res) => {
    const { message } = req.body;

    if (!message) {
        return res.status(400).json({ errors: [{ path: 'message', message: 'Message is required' }] });
    }

    try {
        // Proxy to Flask webhook
        const flaskResponse = await axios.post(FLASK_URL, {
            queryResult: {
                queryText: message
            }
        });

        const aiResponse = flaskResponse.data.fulfillmentText || 'No response from AI.';

        return res.json({ response: aiResponse });
    } catch (e) {
        console.error('Chat proxy error:', e.message);
        return res.status(500).json({ errors: [{ path: 'server', message: 'Failed to get AI response' }] });
    }
});

// Initialize questions (run once or on startup if collection is empty)
async function initializeQuestions() {
    const count = await Question.countDocuments({ topic: 'magnetism' });
    if (count === 0) {
        const initialQuestions = [
            {
                id: 'q1',
                type: 'fill-in-the-blanks',
                prompt: 'A magnet has two poles: the _____ pole and the south pole.',
                correctAnswer: 'north',
                feedback: 'Magnets always have a north and south pole. Like poles repel, and unlike poles attract.',
                topic: 'magnetism'
            },
            {
                id: 'q2',
                type: 'multiple-choice',
                prompt: 'What happens when two north poles of magnets are brought close together?',
                options: [
                    { value: 'They attract' },
                    { value: 'They repel' },
                    { value: 'They become neutral' },
                    { value: 'They create a spark' }
                ],
                correctAnswer: 'They repel',
                feedback: 'Like poles of magnets (e.g., north-north) repel each other due to their magnetic fields.',
                topic: 'magnetism'
            },
            {
                id: 'q4',
                type: 'fill-in-the-blanks',
                prompt: 'An electromagnet is created by passing an electric current through a coil of _____.',
                correctAnswer: 'wire',
                feedback: 'An electromagnet is made by wrapping a coil of wire around a magnetic core and passing current through it.',
                topic: 'magnetism'
            },
            {
                id: 'q5',
                type: 'multiple-choice',
                prompt: 'Which material is most likely to be attracted to a magnet?',
                options: [
                    { value: 'Wood' },
                    { value: 'Iron' },
                    { value: 'Plastic' },
                    { value: 'Glass' }
                ],
                correctAnswer: 'Iron',
                feedback: 'Iron is a ferromagnetic material, strongly attracted to magnets, unlike wood, plastic, or glass.',
                topic: 'magnetism'
            }
        ];

        await Question.insertMany(initialQuestions);
        console.log('Initialized magnetism questions');
    }
}

// Run initialization on startup
initializeQuestions().catch(err => console.error('Failed to initialize questions:', err));

// Listen (for local dev; Vercel ignores PORT)
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

// Export for Vercel serverless
module.exports = (req, res) => {
    app(req, res);
};
