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
    marks12: Number,
    crowns: { type: Number, default: 0 },
    streak: { type: Number, default: 0 },
    gems: { type: Number, default: 0 },
    totalXP: { type: Number, default: 0 },
    dailyXP: { type: Number, default: 0 },
    xpGoal: { type: Number, default: 50 },
    avatar: { type: String, default: '' },
    lastProgressDate: { type: Date, default: null },
    role: { type: String, enum: ['Student', 'Teacher'], default: 'Student' },
    rating: { type: Number, default: 0.0 }
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

const coursesSchema = new Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'users' },
    title: String,
    progress: Number
});

const studentAssignmentSchema = new Schema({
    teacherId: { type: mongoose.Schema.Types.ObjectId, ref: 'users' },
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'users' },
    subject: { type: String, required: true },
    assignedAt: { type: Date, default: Date.now }
});

const reviewSchema = new Schema({
    teacherId: { type: mongoose.Schema.Types.ObjectId, ref: 'users' },
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'users' },
    rating: { type: Number, min: 1, max: 5, required: true },
    comment: { type: String, default: '' },
    createdAt: { type: Date, default: Date.now }
});

const usersModel = mongoose.model('users', usersSchema);
const Question = mongoose.model('Question', questionSchema);
const Progress = mongoose.model('Progress', progressSchema);
const Courses = mongoose.model('Courses', coursesSchema);
const StudentAssignment = mongoose.model('StudentAssignment', studentAssignmentSchema);
const Review = mongoose.model('Review', reviewSchema);

module.exports = {
    usersModel,
    Question,
    Progress,
    Courses,
    StudentAssignment,
    Review
};