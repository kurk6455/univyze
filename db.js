const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const usersSchema = new Schema({
    fullname: String,
    email: { type: String, unique: true },
    password: String,
    phone: String,
    state: String,
    username: { type: String, unique: true },
    school10: String,
    marks10: Number,
    school12: String,
    stream12: String,
    marks12: Number
});

const questionSchema = new Schema({
    id: { type: String, unique: true },
    type: { type: String, enum: ['fill-in-the-blanks', 'multiple-choice', 'visual'] },
    prompt: String,
    options: [{
        value: String,
        description: { type: String, default: '' },
        imageUrl: { type: String, default: '' }
    }],
    correctAnswer: String,
    feedback: String,
    topic: String
});

const progressSchema = new Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'users' },
    questionId: String,
    xp: Number,
    isCorrect: Boolean,
    brains: Number,
    userAnswer: String,
    timestamp: { type: Date, default: Date.now }
});

const usersModel = mongoose.model('users', usersSchema);
const Question = mongoose.model('Question', questionSchema);
const Progress = mongoose.model('Progress', progressSchema);

module.exports = {
    usersModel,
    Question,
    Progress
};
