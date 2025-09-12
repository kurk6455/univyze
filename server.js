const express = require('express');
const mongoose = require('mongoose');
const { usersModel, Question, Progress } = require('./db.js');
const jwt = require('jsonwebtoken');
const { authenticateJWT } = require('./auth.js');
const bcrypt = require('bcrypt');
const { z } = require('zod');
const path = require('path');
const axios = require('axios');

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

// Dynamic topic questions endpoint
app.post('/api/topic/:topic', authenticateJWT, async (req, res) => {
    const { xp, isCorrect, brains, questionId, userAnswer, questionNumber = 0 } = req.body;
    const topic = req.params.topic.toLowerCase();

    try {
        // Validate input data
        const progressValidation = z.object({
            xp: z.number().optional(),
            isCorrect: z.boolean().nullable(),
            brains: z.number().optional(),
            questionId: z.string().optional().nullable(),
            userAnswer: z.string().optional().nullable(),
            questionNumber: z.number().min(0).optional()
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
                topic
            });
        }

        // Fetch questions for the topic
        const questions = await Question.find({ topic });
        if (!questions.length) {
            return res.status(404).json({ errors: [{ path: 'questions', message: 'No questions available for this topic' }] });
        }

        // Track completed questions for this session (simple in-memory for demo; use DB for persistence)
        const totalQuestions = 10;
        if (questionNumber >= totalQuestions) {
            return res.json({
                completed: true,
                message: 'Congratulations!',
                totalXp: xp || 0
            });
        }

        // Filter out previously answered questions (basic approach; improve with DB tracking)
        const answeredQuestions = await Progress.find({ userId: req.userId, topic }).distinct('questionId');
        let availableQuestions = questions.filter(q => !answeredQuestions.includes(q.id));
        if (availableQuestions.length === 0) {
            availableQuestions = questions; // Reset if all answered, for demo simplicity
        }

        const randomIndex = Math.floor(Math.random() * availableQuestions.length);
        const question = availableQuestions[randomIndex];

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
    const topics = ['magnetism', 'electricity', 'waves', 'optics', 'thermodynamics', 'biology', 'genetics', 'evolution', 'chemistry', 'organic chemistry', 'algebra', 'geometry', 'trigonometry', 'calculus', 'probability', 'history', 'geography', 'civics', 'economics', 'philosophy'];
    
    // Topic-specific question templates
    const topicTemplates = {
        magnetism: [
            { type: 'fill-in-the-blanks', prompt: 'A magnet has two poles: the _____ pole and the south pole.', correctAnswer: 'north', feedback: 'Magnets always have a north and south pole. Like poles repel, and unlike poles attract.' },
            { type: 'multiple-choice', prompt: 'What happens when two north poles of magnets are brought close together?', options: ["They attract", "They repel", "They become neutral", "They create a spark"], correctAnswer: "They repel", feedback: 'Like poles repel each other due to magnetic fields.' },
            { type: 'fill-in-the-blanks', prompt: 'An electromagnet is created by passing an electric current through a coil of _____.', correctAnswer: 'wire', feedback: 'Wrapping wire around a core and passing current creates an electromagnet.' },
            { type: 'multiple-choice', prompt: 'Which material is most likely to be attracted to a magnet?', options: ["Wood", "Iron", "Plastic", "Glass"], correctAnswer: "Iron", feedback: 'Iron is ferromagnetic and strongly attracted to magnets.' },
            { type: 'fill-in-the-blanks', prompt: 'The study of magnetism involves understanding _____ fields.', correctAnswer: 'magnetic', feedback: 'Magnetic fields are invisible forces around magnets.' },
            { type: 'multiple-choice', prompt: 'What is the unit of magnetic field strength?', options: ["Volt", "Tesla", "Ampere", "Ohm"], correctAnswer: "Tesla", feedback: 'Tesla (T) measures magnetic flux density.' },
            { type: 'fill-in-the-blanks', prompt: 'A compass needle aligns with the Earth\'s _____ field.', correctAnswer: 'magnetic', feedback: 'The Earth acts like a giant bar magnet.' },
            { type: 'multiple-choice', prompt: 'Which device uses magnetism to store data?', options: ["Capacitor", "Hard Drive", "Resistor", "Diode"], correctAnswer: "Hard Drive", feedback: 'Hard drives use magnetic platters for data storage.' },
            { type: 'fill-in-the-blanks', prompt: 'The force between magnets decreases with _____ distance.', correctAnswer: 'increasing', feedback: 'Magnetic force follows an inverse-square law.' },
            { type: 'multiple-choice', prompt: 'What material can block magnetic fields?', options: ["Copper", "Iron", "Mu-metal", "Aluminum"], correctAnswer: "Mu-metal", feedback: 'Mu-metal is a nickel-iron alloy used for magnetic shielding.' }
        ],
        electricity: [
            { type: 'fill-in-the-blanks', prompt: 'Electric current is the flow of _____.', correctAnswer: 'electrons', feedback: 'Electrons are negatively charged particles that carry current.' },
            { type: 'multiple-choice', prompt: 'What is Ohm\'s Law?', options: ["V = IR", "P = VI", "I = VR", "R = VI"], correctAnswer: "V = IR", feedback: 'Voltage (V) equals current (I) times resistance (R).' },
            { type: 'fill-in-the-blanks', prompt: 'A material that allows electric current to flow easily is called a _____.', correctAnswer: 'conductor', feedback: 'Metals like copper are good conductors.' },
            { type: 'multiple-choice', prompt: 'What unit measures electric current?', options: ["Volt", "Ampere", "Ohm", "Watt"], correctAnswer: "Ampere", feedback: 'Ampere (A) is the SI unit for current.' },
            { type: 'fill-in-the-blanks', prompt: 'The opposition to current flow in a circuit is called _____.', correctAnswer: 'resistance', feedback: 'Measured in ohms (Ω).' },
            { type: 'multiple-choice', prompt: 'What device converts electrical energy to light?', options: ["Motor", "Battery", "Bulb", "Switch"], correctAnswer: "Bulb", feedback: 'An electric bulb uses filament to produce light.' },
            { type: 'fill-in-the-blanks', prompt: 'A complete path for current to flow is called a closed _____.', correctAnswer: 'circuit', feedback: 'Open circuits break the flow of current.' },
            { type: 'multiple-choice', prompt: 'What causes a short circuit?', options: ["High resistance", "Direct connection between power source", "Broken wire", "Insulator"], correctAnswer: "Direct connection between power source", feedback: 'Bypassing components causes excessive current.' },
            { type: 'fill-in-the-blanks', prompt: 'Electric power is measured in _____.', correctAnswer: 'watts', feedback: 'Power = Voltage × Current (P = VI).' },
            { type: 'multiple-choice', prompt: 'Which is a source of electricity?', options: ["Resistor", "Battery", "Wire", "Switch"], correctAnswer: "Battery", feedback: 'Batteries store chemical energy as electrical energy.' }
        ]
    };
    
    for (const topic of topics) {
        const count = await Question.countDocuments({ topic });
        if (count === 0) {
            const initialQuestions = topicTemplates[topic].map((q, index) => ({
                id: `${topic}-q${index + 1}`,
                type: q.type,
                prompt: q.prompt,
                options: q.options ? q.options.map(opt => ({ value: opt })) : undefined,
                correctAnswer: q.correctAnswer,
                feedback: q.feedback,
                topic
            }));
            await Question.insertMany(initialQuestions);
            console.log(`Initialized ${topic} questions`);
        }
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